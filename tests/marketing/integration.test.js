import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { randomUUID, scryptSync, createHmac } from 'node:crypto'
import { createApp } from '../../server/marketing/index.js'
import { syncAudience } from '../../server/marketing/sync.js'
import { audience as cachedAudience, contactEligibility } from '../../server/marketing/db.js'
import { dispatchBatch, workOnce } from '../../server/marketing/worker.js'

// Dedicated disposable database ONLY: the suite truncates its marketing tables.
const url = process.env.MARKETING_TEST_DATABASE_URL

test(
  'PostgreSQL réel : migration, auth, audience, brouillon, file, reprise et webhooks',
  { skip: !url },
  async (t) => {
    const db = new pg.Pool({ connectionString: url, max: 8 })
    t.after(() => db.end())
    await db.query(
      await readFile(
        new URL('../../sql/whatsapp-marketing.sql', import.meta.url),
        'utf8',
      ),
    )
    await db.query(
      await readFile(
        new URL('../../sql/whatsapp-marketing.sql', import.meta.url),
        'utf8',
      ),
    )
    await db.query(
      'TRUNCATE marketing.events,marketing.recipients,marketing.campaigns,marketing.suppressions RESTART IDENTITY CASCADE',
    )
    await db.query('CREATE SCHEMA IF NOT EXISTS autoget_marketing')
    await db.query(
      `CREATE TABLE IF NOT EXISTS autoget_marketing.delivered_items(order_id text, ordered_at timestamptz, status text, phone text, customer_name text, product_id text,product_name text,variant text,size text,city text,marketing_opt_in boolean)`,
    )
    await db.query(
      await readFile(
        new URL('../../sql/whatsapp-marketing-consents.sql', import.meta.url),
        'utf8',
      ),
    )
    await db.query(
      'TRUNCATE marketing.consents, marketing.login_limits, marketing.worker_health',
    )
    await db.query('TRUNCATE autoget_marketing.delivered_items')
    await db.query(
      `INSERT INTO autoget_marketing.delivered_items VALUES ('o1','2026-09-01','livré','0551234567','Amine','p1','Sneakers','Noir','42','Alger',true),('o2','2026-09-02','delivered','+213551234567','Amine','p2','Runner','Blanc','43','Alger',true),('o3','2026-09-02','pending','0661234567','Exclu','p1','Sneakers','Noir','42','Alger',true)`,
    )
    await db.query(await readFile(new URL('../../sql/whatsapp-supabase-sync.sql', import.meta.url), 'utf8'))
    await db.query(await readFile(new URL('../../sql/whatsapp-throughput.sql', import.meta.url), 'utf8'))
    await db.query('TRUNCATE marketing.source_items,marketing.sync_state')
    await syncAudience(db, db, { query: "SELECT * FROM autoget_marketing.delivered_items WHERE status IN ('livré','delivered')", pauseMs: 0 })
    await db.query("INSERT INTO marketing.consents(phone,opted_in,evidence,captured_at) VALUES('+213551234567',true,'Consentement de test',now())")
    const salt = '12345678901234567890123456789012'
    const cfg = {
      view: 'autoget_marketing.delivered_items',
      country: 'DZ',
      interval: 1,
      secure: false,
      origin: 'http://localhost:5173',
      env: {
        MARKETING_ADMIN_PASSWORD_HASH:
          salt +
          ':' +
          scryptSync('test-only-password', salt, 64).toString('hex'),
        MARKETING_SESSION_SECRET: 'test-only-session-secret-32-characters',
        WHATSAPP_SENDING_ENABLED: 'true',
        WHATSAPP_VERIFY_TOKEN: 'test-verify',
        WHATSAPP_APP_SECRET: 'test-app',
        WHATSAPP_PHONE_NUMBER_ID: '123',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '456',
      },
    }
    const template = {
      id: 't1',
      name: 'bonjour',
      language: 'fr',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Bonjour {{1}}' }],
    }
    let sends = 0,
      mode = 'success'
    const meta = {
      templates: async () => [template],
      send: async () => {
        sends++
        if (mode === 'transient')
          throw Object.assign(new Error(), { code: '130429', retryable: true })
        if (mode === 'unknown')
          throw Object.assign(new Error(), {
            code: 'NETWORK_UNCERTAIN',
            ambiguous: true,
          })
        return { messages: [{ id: 'wamid.' + sends }] }
      },
    }
    const server = createApp(cfg, db, db, meta).listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    t.after(() => new Promise((resolve) => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}`
    let cookie = ''
    async function req(path, body, extra = {}) {
      return fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: cfg.origin,
          Cookie: cookie,
          'Content-Type': 'application/json',
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    assert.equal((await req('/api/marketing/audience')).status, 401)
    assert.equal(
      (await req('/api/marketing/login', { password: 'bad' })).status,
      401,
    )
    assert.equal(
      (
        await req(
          '/api/marketing/login',
          { password: 'test-only-password' },
          { Origin: 'https://evil.test' },
        )
      ).status,
      403,
    )
    const login = await req('/api/marketing/login', {
      password: 'test-only-password',
    })
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie').split(';')[0]
    const audience = await (await req('/api/marketing/audience')).json()
    assert.equal(audience.total, 1)
    assert.equal(audience.customers[0].orderCount, 2)
    assert.equal(
      (await req('/api/marketing/audience?minOrders=-1')).status,
      400,
    )
    const prepare = () => ({
      requestKey: randomUUID(),
      name: 'Test',
      templateId: 't1',
      bindings: { 'BODY.1': { source: 'name' } },
      filters: {},
      selection: { mode: 'all', phones: [] },
    })
    const request = prepare()
    const results = await Promise.all([
      req('/api/marketing/campaigns', request),
      req('/api/marketing/campaigns', request),
    ])
    const [a, b] = await Promise.all(results.map((r) => r.json()))
    assert.equal(a.id, b.id)
    assert.equal(
      (await db.query('SELECT * FROM marketing.recipients')).rowCount,
      1,
    )
    await workOnce(db, db, cfg, meta)
    assert.equal(sends, 0, 'draft cannot send')
    cfg.env.WHATSAPP_SENDING_ENABLED = 'false'
    assert.equal(
      (await req(`/api/marketing/campaigns/${a.id}/start`, {})).status,
      400,
    )
    cfg.env.WHATSAPP_SENDING_ENABLED = 'true'
    assert.equal(
      (await req(`/api/marketing/campaigns/${a.id}/start`, {})).status,
      200,
    )
    await Promise.all([
      workOnce(db, db, cfg, meta),
      workOnce(db, db, cfg, meta),
    ])
    assert.equal(sends, 1, 'two workers send only once')
    let recipient = (await db.query('SELECT * FROM marketing.recipients'))
      .rows[0]
    assert.equal(recipient.status, 'sent')
    async function webhook(status) {
      const body = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '456',
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '123' },
                  statuses: [
                    {
                      id: recipient.message_id,
                      status,
                      timestamp: '1000',
                      biz_opaque_callback_data: recipient.id,
                    },
                  ],
                },
              },
            ],
          },
        ],
      }
      const signature =
        'sha256=' +
        createHmac('sha256', 'test-app')
          .update(JSON.stringify(body))
          .digest('hex')
      return req('/api/whatsapp/webhook', body, {
        'x-hub-signature-256': signature,
      })
    }
    assert.equal((await req('/api/whatsapp/webhook', {})).status, 403)
    assert.equal((await webhook('failed')).status, 200)
    assert.equal(
      (await db.query('SELECT status FROM marketing.recipients')).rows[0]
        .status,
      'failed',
    )
    await webhook('read')
    await webhook('delivered')
    await webhook('read')
    assert.equal(
      (await db.query('SELECT status FROM marketing.recipients')).rows[0]
        .status,
      'read',
    )
    assert.equal(
      (await db.query("SELECT * FROM marketing.events WHERE kind='read'"))
        .rowCount,
      1,
    )
    const second = await (
      await req('/api/marketing/campaigns', prepare())
    ).json()
    await req(`/api/marketing/campaigns/${second.id}/start`, {})
    mode = 'transient'
    await workOnce(db, db, cfg, meta)
    recipient = (
      await db.query(
        'SELECT * FROM marketing.recipients WHERE campaign_id=$1',
        [second.id],
      )
    ).rows[0]
    assert.equal(recipient.status, 'queued')
    assert.equal(recipient.attempts, 1)
    assert.equal(recipient.error_code, '130429')
    assert.ok(recipient.next_attempt_at > new Date())
    await db.query(
      'UPDATE marketing.recipients SET next_attempt_at=now() WHERE campaign_id=$1',
      [second.id],
    )
    await db.query('UPDATE marketing.worker_health SET rate_limit_until=NULL')
    mode = 'unknown'
    await workOnce(db, db, cfg, meta)
    await req(`/api/marketing/campaigns/${second.id}/retry`, {})
    assert.equal(
      (
        await db.query(
          'SELECT status FROM marketing.recipients WHERE campaign_id=$1',
          [second.id],
        )
      ).rows[0].status,
      'unknown',
    )
    const third = await (
      await req('/api/marketing/campaigns', prepare())
    ).json()
    await req(`/api/marketing/campaigns/${third.id}/start`, {})
    await db.query("UPDATE marketing.sync_state SET completed_at=now()-interval '49 hours'")
    const beforeStale = sends
    await workOnce(db, { query() { throw new Error('ERP accessed') } }, cfg, meta)
    assert.equal(sends, beforeStale, 'stale snapshot never sends')
    assert.equal((await db.query('SELECT status FROM marketing.recipients WHERE campaign_id=$1',[third.id])).rows[0].status, 'queued')
    await db.query('UPDATE marketing.sync_state SET completed_at=now()')
    await req('/api/marketing/suppressions', { phone: '0551234567' })
    const before = sends
    await workOnce(db, db, cfg, meta)
    assert.equal(sends, before)
    assert.equal(
      (
        await db.query(
          'SELECT status FROM marketing.recipients WHERE campaign_id=$1',
          [third.id],
        )
      ).rows[0].status,
      'skipped',
    )
    assert.equal(
      (await (await req('/api/marketing/audience')).json()).eligible,
      0,
    )
    assert.equal((await req('/api/marketing/campaigns', prepare())).status, 400)
    // All audience reads work with an ERP object that must never be called.
    const unavailableErp = { query() { throw new Error('ERP MUST NOT BE USED') }, connect() { throw new Error('ERP MUST NOT BE USED') } }
    assert.equal((await cachedAudience(unavailableErp, db, cfg)).customers.length, 1)
    assert.equal((await contactEligibility(db, '+213551234567')).eligible, false)
    await db.query("UPDATE marketing.sync_state SET completed_at=now()-interval '49 hours'")
    assert.equal((await contactEligibility(db, '+213551234567')).fresh, false)
    const oldCount = (await db.query('SELECT count(*)::int n FROM marketing.source_items')).rows[0].n
    await assert.rejects(syncAudience(db, db, {
      query: 'SELECT * FROM autoget_marketing.delivered_items', maxRows: 1, batchSize: 1, pauseMs: 0,
    }))
    assert.equal((await db.query('SELECT count(*)::int n FROM marketing.source_items')).rows[0].n, oldCount, 'failed import rolls back partial replacement')
    assert.equal((await contactEligibility(db, '+213551234567')).fresh, false, 'failure never renews freshness')
    await assert.rejects(syncAudience(db, db, { query: 'DELETE FROM autoget_marketing.delivered_items RETURNING *', pauseMs: 0 }))
    assert.equal((await db.query('SELECT count(*)::int n FROM autoget_marketing.delivered_items')).rows[0].n, 3, 'source remains unchanged')
    await db.query("DELETE FROM autoget_marketing.delivered_items WHERE order_id='o2'")
    await syncAudience(db, db, { query: "SELECT * FROM autoget_marketing.delivered_items WHERE status IN ('livré','delivered')", pauseMs: 0 })
    assert.equal((await cachedAudience(unavailableErp, db, cfg)).customers[0].orderCount, 1, 'deleted orders disappear from next complete snapshot')
    assert.equal((await syncAudience(db, unavailableErp)).reason, 'RECENT_SYNC', 'hourly guard avoids ERP connection')
    cfg.env.CRON_SECRET = 'test-cron-secret-at-least-32-characters'
    assert.equal((await req('/api/marketing/worker', {})).status, 401)
    cfg.env.VERCEL = '1'
    cfg.env.VERCEL_ENV = 'preview'
    const authorization = { Authorization: 'Bearer ' + cfg.env.CRON_SECRET }
    assert.equal(
      (await req('/api/marketing/worker', {}, authorization)).status,
      403,
    )
    cfg.env.VERCEL_ENV = 'production'
    cfg.env.WHATSAPP_SENDING_ENABLED = 'false'
    assert.equal(
      (await req('/api/marketing/worker', {}, authorization)).status,
      200,
    )
    const service = await (await req('/api/marketing/status')).json()
    assert.ok(service.worker.last_finished_at)
    assert.equal(service.sendingEnabled, false)
    await db.query(
      "UPDATE marketing.login_limits SET attempts=10 WHERE bucket='marketing-admin'",
    )
    const other = createApp(cfg, db, db, meta).listen(0, '127.0.0.1')
    await new Promise((resolve) => other.once('listening', resolve))
    const limited = await fetch(
      `http://127.0.0.1:${other.address().port}/api/marketing/login`,
      {
        method: 'POST',
        headers: { Origin: cfg.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-only-password' }),
      },
    )
    assert.equal(limited.status, 429)
    await new Promise((resolve) => other.close(resolve))
    await t.test('60 000 contacts : préparation réelle par blocs et envois concurrents cadencés', async () => {
      await db.query("UPDATE marketing.campaigns SET state='paused'")
      await db.query('TRUNCATE marketing.source_items,marketing.consents,marketing.suppressions')
      await db.query(`INSERT INTO marketing.source_items(phone,data)
        SELECT '+21355'||lpad(i::text,7,'0'),jsonb_build_object(
          'order_id','bulk-'||i,'ordered_at','2026-09-01','status','delivered',
          'phone','+21355'||lpad(i::text,7,'0'),'customer_name','Client fictif '||i,
          'product_id','p1','product_name','Sneakers','variant','Noir','size','42',
          'marketing_opt_in',false)
        FROM generate_series(1,60000) i`)
      await db.query("INSERT INTO marketing.consents(phone,opted_in,evidence,captured_at) SELECT phone,true,'Test fictif local',now() FROM marketing.source_items")
      await db.query('UPDATE marketing.sync_state SET completed_at=now()')
      const created = await req('/api/marketing/campaigns', prepare())
      assert.equal(created.status, 201)
      const large = await created.json()
      assert.equal((await db.query('SELECT count(*)::int n FROM marketing.recipients WHERE campaign_id=$1',[large.id])).rows[0].n, 60000)
      await db.query("UPDATE marketing.campaigns SET state='running' WHERE id=$1",[large.id])
      let inFlight = 0, peak = 0
      const starts = [], ids = new Set()
      const fastCfg = { ...cfg, interval: 20, concurrency: 3, env: { ...cfg.env, WHATSAPP_SENDING_ENABLED: 'true', VERCEL: '' } }
      const simulated = { send: async (_phone,_payload,id) => {
        assert.ok(!ids.has(id),'recipient never dispatched twice')
        ids.add(id)
        starts.push(Date.now())
        peak = Math.max(peak,++inFlight)
        await new Promise(resolve => setTimeout(resolve,80))
        inFlight--
        return { messages: [{ id:'bulk.'+id }] }
      } }
      const batches = await Promise.all([
        dispatchBatch(db,fastCfg,simulated,{maxMessages:12}),
        dispatchBatch(db,fastCfg,simulated,{maxMessages:12}),
      ])
      assert.equal(batches.reduce((sum,b) => sum+b.processed,0),12)
      assert.equal(ids.size,12)
      assert.ok(peak>1 && peak<=3,'overlapping HTTP requests respect concurrency cap')
      assert.equal(inFlight,0,'all requests settled before returning')
      for(let i=1;i<starts.length;i++) assert.ok(starts[i]-starts[i-1]>=18,'actual request starts paced')
      assert.equal((await db.query("SELECT count(*)::int n FROM marketing.recipients WHERE campaign_id=$1 AND status='sent'",[large.id])).rows[0].n,12)
      await db.query("UPDATE marketing.campaigns SET state='paused' WHERE id=$1",[large.id])
      assert.equal((await dispatchBatch(db,fastCfg,simulated,{maxMessages:12})).processed,0)
      await db.query("UPDATE marketing.campaigns SET state='running' WHERE id=$1",[large.id])
      let rateCalls=0
      const throttled = { send:async () => { rateCalls++; throw Object.assign(new Error('test'),{code:'130429',retryable:true}) } }
      const serialCfg = { ...fastCfg, concurrency:1 }
      assert.equal((await dispatchBatch(db,serialCfg,throttled)).processed,1)
      assert.equal((await dispatchBatch(db,serialCfg,throttled)).processed,0,'cooldown persists across invocations')
      assert.equal(rateCalls,1)
      await db.query("UPDATE marketing.campaigns SET state='paused' WHERE id=$1",[large.id])
    })
    // Fresh installer and privileges are checked only in this disposable test DB.
    const installer = await readFile(new URL('../../sql/whatsapp-supabase-install.sql', import.meta.url), 'utf8')
    const admin = await db.connect()
    try {
      await admin.query('DROP SCHEMA marketing CASCADE')
      await admin.query('DROP ROLE IF EXISTS autoget_marketing_app')
      await admin.query(installer)
      await assert.rejects(admin.query(installer), /already exists/)
      await admin.query('ROLLBACK')
      await admin.query('SET ROLE autoget_marketing_app')
      await admin.query("INSERT INTO marketing.sync_state(id,row_count) VALUES(1,7)")
      assert.equal((await admin.query('SELECT row_count FROM marketing.sync_state')).rows[0].row_count, 7)
      await assert.rejects(admin.query('DELETE FROM autoget_marketing.delivered_items'), /permission denied/)
      await admin.query('RESET ROLE')
      await admin.query('CREATE ROLE marketing_test_browser NOLOGIN')
      await admin.query('SET ROLE marketing_test_browser')
      await assert.rejects(admin.query('SELECT * FROM marketing.source_items'), /permission denied/)
      await admin.query('RESET ROLE')
      await admin.query('DROP ROLE marketing_test_browser')
    } finally {
      await admin.query('RESET ROLE')
      admin.release()
    }
  },
)
