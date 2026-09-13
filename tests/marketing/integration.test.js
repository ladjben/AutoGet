import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { randomUUID, scryptSync, createHmac } from 'node:crypto'
import { createApp } from '../../server/marketing/index.js'
import { workOnce } from '../../server/marketing/worker.js'

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
  },
)
