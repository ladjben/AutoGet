import { campaignAnalytics, recipientsCsv, validateCostConfig } from './analytics.js'
import { createMarketingTemplate } from './template-create.js'
import { sendingEnabled } from './sending.js'
import { isDeepStrictEqual } from 'node:util'
import { randomUUID } from 'node:crypto'
import { audience, transaction } from './db.js'
import {
  filterAudience,
  validateFilters,
  templateFields,
  renderTemplate,
  normalizePhone,
} from './domain.js'
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 })
}
const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value || '',
  )
export function installApi(app, db, erp, cfg, meta) {
  app.get('/api/marketing/status', async (req, res) => {
    const result = await db.query(
      'SELECT * FROM marketing.worker_health WHERE id=1',
    )
    const sync = await db.query("SELECT *, completed_at > now()-interval '48 hours' AS fresh FROM marketing.sync_state WHERE id=1")
    res.json({
      sync: sync.rows[0] || null,
      sendingEnabled: sendingEnabled(cfg),
      serverless: Boolean(cfg.env.VERCEL),
      worker: result.rows[0] || null,
    })
  })
  app.get('/api/marketing/audience', async (req, res) => {
    let filters
    try {
      filters = validateFilters(req.query)
    } catch (e) {
      fail(e.message)
    }
    const data = await audience(erp, db, cfg)
    const filtered = filterAudience(data.customers, filters)
    const page = Math.max(1, Number(req.query.page) || 1)
    const products = new Map(
      data.customers.flatMap((c) =>
        c.purchases.map((p) => [p.productId, p.product]),
      ),
    )
    res.json({
      total: filtered.length,
      eligible: filtered.filter((c) => c.eligible).length,
      invalidPhones: data.invalidPhones,
      page,
      customers: filtered.slice((page - 1) * 50, page * 50),
      facets: {
        statuses: [...new Set(data.customers.flatMap((c) => c.purchases.map((p) => p.status)))].sort(),
        products: [...products].map(([id, name]) => ({ id, name })),
        sizes: [
          ...new Set(
            data.customers
              .flatMap((c) => c.purchases.map((p) => p.size))
              .filter(Boolean),
          ),
        ].sort(),
        variants: [
          ...new Set(
            data.customers
              .flatMap((c) => c.purchases.map((p) => p.variant))
              .filter(Boolean),
          ),
        ].sort(),
        cities: [
          ...new Set(data.customers.map((c) => c.city).filter(Boolean)),
        ].sort(),
      },
    })
  })
  app.get('/api/marketing/templates', async (req, res) => {
    const templates = await meta.templates()
    res.json(
      templates.map((t) => {
        try {
          return { ...t, fields: templateFields(t), supported: true }
        } catch (e) {
          return { ...t, fields: [], supported: false, reason: e.message }
        }
      }),
    )
  })
  app.post('/api/marketing/templates', async (req, res) => {
    res.status(201).json(await createMarketingTemplate(req.body, meta))
  })
  app.post('/api/marketing/campaigns', async (req, res) => {
    const { requestKey, name, templateId, bindings, selection } = req.body
    if (
      !uuid(requestKey) ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 120
    )
      fail('Nom ou identifiant de campagne invalide.')
    const existing = await db.query(
      'SELECT id FROM marketing.campaigns WHERE request_key=$1',
      [requestKey],
    )
    if (existing.rowCount) return res.json(existing.rows[0])
    let filters
    try {
      filters = validateFilters(req.body.filters)
    } catch (e) {
      fail(e.message)
    }
    if (
      !selection ||
      !['all', 'explicit'].includes(selection.mode) ||
      !Array.isArray(selection.phones) ||
      selection.phones.length > 60000 ||
      selection.phones.some((p) => typeof p !== 'string')
    )
      fail('Sélection invalide.')
    const data = await audience(erp, db, cfg)
    const selected = new Set(selection.phones)
    const recipients = filterAudience(data.customers, filters).filter(
      (c) =>
        c.eligible &&
        (selection.mode === 'all'
          ? !selected.has(c.phone)
          : selected.has(c.phone)),
    )
    if (!recipients.length || recipients.length > 60000)
      fail('Sélectionnez entre 1 et 60 000 contacts éligibles.')
    const template = (await meta.templates()).find(
      (t) => t.id === templateId && t.status === 'APPROVED',
    )
    if (!template)
      fail('Ce modèle n’est pas approuvé ou n’est plus disponible.')
    let messages
    try {
      messages = recipients.map((c) => ({
        name: c.name,
        phone: c.phone,
        payload: renderTemplate(template, bindings, c),
      }))
    } catch (e) {
      fail(e.message)
    }
    const id = await transaction(db, async (client) => {
      const id = randomUUID()
      const inserted = await client.query(
        'INSERT INTO marketing.campaigns(id,request_key,name,template,bindings,filters) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(request_key) DO NOTHING RETURNING id',
        [id, requestKey, name.trim(), template, bindings || {}, filters],
      )
      if (!inserted.rowCount)
        return (
          await client.query(
            'SELECT id FROM marketing.campaigns WHERE request_key=$1',
            [requestKey],
          )
        ).rows[0].id
      for (let offset = 0; offset < messages.length; offset += 500) {
        await client.query(
          `INSERT INTO marketing.recipients(id,campaign_id,phone,customer_name,payload) SELECT x.id,$1,x.phone,x.name,x.payload FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,phone text,name text,payload jsonb)`,
          [
            id,
            JSON.stringify(
              messages.slice(offset, offset + 500).map((c) => ({
                id: randomUUID(),
                phone: c.phone,
                name: c.name,
                payload: c.payload,
              })),
            ),
          ],
        )
      }
      return id
    })
    res.status(201).json({ id })
  })
  app.get('/api/marketing/campaigns', async (req, res) => {
    const result =
      await db.query(`SELECT c.id,c.name,c.state,c.created_at,c.template->>'name' AS template_name,count(r.id)::int AS total,
      count(*) FILTER(WHERE r.status='queued')::int AS queued,
      count(*) FILTER(WHERE r.status='sending')::int AS sending,
      count(*) FILTER(WHERE r.status='sent')::int AS sent,
      count(*) FILTER(WHERE r.status='delivered')::int AS delivered,
      count(*) FILTER(WHERE r.status='read')::int AS read,
      count(*) FILTER(WHERE r.status='failed')::int AS failed,
      count(*) FILTER(WHERE r.status='unknown')::int AS unknown,
      count(*) FILTER(WHERE r.status='skipped')::int AS skipped
      FROM marketing.campaigns c LEFT JOIN marketing.recipients r ON r.campaign_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`)
    res.json(result.rows)
  })
  app.get('/api/marketing/campaigns/:id', async (req, res) => {
    if (!uuid(req.params.id)) fail('Identifiant invalide.')
    const campaign = await db.query(
      'SELECT * FROM marketing.campaigns WHERE id=$1',
      [req.params.id],
    )
    if (!campaign.rowCount) return res.sendStatus(404)
    const page = Math.max(1, Number(req.query.page) || 1)
    const recipients = await db.query(
      'SELECT * FROM marketing.recipients WHERE campaign_id=$1 ORDER BY phone LIMIT 50 OFFSET $2',
      [req.params.id, (page - 1) * 50],
    )
    const events = await db.query(
      'SELECT e.* FROM marketing.events e JOIN marketing.recipients r ON r.id=e.recipient_id WHERE r.campaign_id=$1 ORDER BY e.id DESC LIMIT 100',
      [req.params.id],
    )
    const count = await db.query(
      'SELECT count(*)::int AS total FROM marketing.recipients WHERE campaign_id=$1',
      [req.params.id],
    )
    res.json({
      total: count.rows[0].total,
      ...campaign.rows[0],
      recipients: recipients.rows,
      events: events.rows,
    })
  })
  app.get('/api/marketing/campaigns/:id/meta-insights', async (req, res) => {
    if (!uuid(req.params.id)) fail('Identifiant invalide.')
    const campaign = (await db.query('SELECT template FROM marketing.campaigns WHERE id=$1', [req.params.id])).rows[0]
    if (!campaign) return res.sendStatus(404)
    const start = Number(req.query.start), end = Number(req.query.end)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end-start > 31*86400 || end > Date.now()/1000+86400)
      fail('Choisissez une période de 31 jours maximum.')
    const insights = await meta.insights({ start, end, templateId: campaign.template.id })
    res.set('Cache-Control', 'no-store').json({ ...insights, templateName: campaign.template.name })
  })
  app.get('/api/marketing/campaigns/:id/analytics', async (req, res) => {
    if (!uuid(req.params.id)) fail('Identifiant invalide.')
    const campaign = (await db.query('SELECT * FROM marketing.campaigns WHERE id=$1', [req.params.id])).rows[0]
    if (!campaign) return res.sendStatus(404)
    const report = await campaignAnalytics(db, campaign)
    const page = Math.min(1000000, Math.max(1, Math.floor(Number(req.query.page) || 1)))
    const q = String(req.query.q || '').slice(0,200).toLowerCase()
    const status = String(req.query.status || '')
    const filtered = report.recipients.filter((r) => (!status || r.status === status) &&
      (!q || `${r.phone} ${r.customer_name} ${r.error_code || ''}`.toLowerCase().includes(q)))
    if (req.query.format === 'csv') {
      res.set('Content-Disposition', `attachment; filename="campaign-${campaign.id}.csv"`)
      return res.type('text/csv').send(recipientsCsv(filtered))
    }
    res.json({ ...report, recipients: filtered.slice((page-1)*50,page*50),
      page, filteredTotal: filtered.length, costConfig: campaign.cost_config,
      template: { name: campaign.template.name, language: campaign.template.language, category: campaign.template.category },
      filters: campaign.filters, createdAt: campaign.created_at })
  })
  app.post('/api/marketing/campaigns/:id/costs', async (req, res) => {
    if (!uuid(req.params.id)) fail('Identifiant invalide.')
    const costs = validateCostConfig(req.body)
    const result = await db.query('UPDATE marketing.campaigns SET cost_config=$2 WHERE id=$1 RETURNING id', [req.params.id,costs])
    if (!result.rowCount) return res.sendStatus(404)
    res.json({ ok: true })
  })
  app.post('/api/marketing/campaigns/:id/:action', async (req, res) => {
    const { id, action } = req.params
    if (!uuid(id) || !['start', 'pause', 'retry'].includes(action))
      fail('Action invalide.')
    if (action === 'start' && !sendingEnabled(cfg))
      fail('Les envois sont désactivés sur le serveur.')
    const campaign = (
      await db.query('SELECT * FROM marketing.campaigns WHERE id=$1', [id])
    ).rows[0]
    if (!campaign) return res.sendStatus(404)
    if (action === 'start') {
      if (cfg.env.VERCEL) {
        const healthy = await db.query(
          "SELECT id FROM marketing.worker_health WHERE id=1 AND last_finished_at>now()-interval '20 minutes' AND last_error IS NULL",
        )
        if (!cfg.env.CRON_SECRET || !healthy.rowCount)
          fail(
            'Activez le workflow GitHub WhatsApp et exécutez-le une première fois avant de lancer une campagne.',
          )
      }

      const current = (await meta.templates()).find(
        (t) => t.id === campaign.template.id && t.status === 'APPROVED',
      )
      if (
        !current ||
        !isDeepStrictEqual(current.components, campaign.template.components) ||
        current.language !== campaign.template.language ||
        current.parameter_format !== campaign.template.parameter_format
      )
        fail('Modèle modifié ou non approuvé. Préparez une nouvelle campagne.')
      await db.query(
        "UPDATE marketing.campaigns SET state='running' WHERE id=$1",
        [id],
      )
    } else if (action === 'pause')
      await db.query(
        "UPDATE marketing.campaigns SET state='paused' WHERE id=$1",
        [id],
      )
    else
      await db.query(
        "UPDATE marketing.recipients SET status='queued',next_attempt_at=now(),attempts=0,error_code=NULL WHERE campaign_id=$1 AND status='failed' AND retryable=true AND message_id IS NULL",
        [id],
      )
    res.json({ ok: true })
  })
  app.post('/api/marketing/suppressions', async (req, res) => {
    const phone = normalizePhone(req.body.phone, cfg.country)
    if (!phone) fail('Téléphone invalide.')
    await db.query(
      "INSERT INTO marketing.suppressions(phone,reason) VALUES($1,'manual') ON CONFLICT(phone) DO NOTHING",
      [phone],
    )
    res.json({ ok: true })
  })
}
