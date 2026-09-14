import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeCampaign, validateCostConfig, recipientsCsv } from '../../server/marketing/analytics.js'
import { statusMetadata } from '../../server/marketing/webhook.js'
const row = (extra = {}) => ({ phone: '+213551234567', status: 'read', attempts: 1, message_id: 'm1', sent_at: '2026-09-01T10:00:00Z', delivered_at: '2026-09-01T10:00:10Z', read_at: '2026-09-01T10:01:00Z', has_webhook: true, ...extra })
const config = { currency: 'EUR', rates: [{ country: 'DZ', category: 'marketing', unit: 0.05 }] }
test('analytics counts recipients once, preserves delivery in read, estimates free and unknown separately', () => {
  const { summary: s } = summarizeCampaign([row({ pricing: { billable: true, category: 'marketing', pricing_model: 'PMP' } }), row({ pricing: { type: 'free_entry_point' } }), row({ pricing: null })], config)
  assert.equal(s.delivered, 3); assert.equal(s.read, 3); assert.equal(s.accepted, 3)
  assert.equal(s.estimatedTotal, 0.1); assert.equal(s.free, 1); assert.equal(s.billable, 1); assert.equal(s.pricingUnknown, 1)
  assert.equal(s.deliveryRate, 100); assert.equal(s.readRate, 100)
  assert.equal(s.deliverySeconds, 10); assert.equal(s.readSeconds, 50)
  assert.equal(s.timeline[0].read, 3); assert.equal(s.clicks, null)
})
test('missing tariffs and conversation pricing never produce a false zero', () => {
  const { summary: s } = summarizeCampaign([row(), row({ pricing: { pricing_model: 'CBP', billable: true } })], config)
  assert.equal(s.estimatedTotal, null); assert.equal(s.knownEstimate, 0.05); assert.equal(s.missingRates, 1)
  assert.equal(summarizeCampaign([row()], {}).summary.estimatedTotal, null)
  const free = summarizeCampaign([row({ pricing: { billable: false } })], {})
  assert.equal(free.summary.estimatedTotal, 0)
})
test('country/category priority and retries do not multiply delivered charges', () => {
  const { summary: s } = summarizeCampaign([row({ attempts: 4, pricing: { category: 'utility' } })], { rates: [...config.rates, { country: '*', category: 'utility', unit: 0.02 }] })
  assert.equal(s.estimatedTotal, 0.02); assert.equal(s.retried, 1); assert.equal(s.attempts, 4)
  const draft = summarizeCampaign([row({ status: 'queued', attempts: 0, message_id: null, sent_at: null, delivered_at: null, read_at: null })], config)
  assert.equal(draft.summary.accepted, 0); assert.equal(draft.summary.deliveryRate, null); assert.equal(draft.recipients[0].estimatedCost, null)
})
test('cost input validates currency, duplicates, precision and invoice source', () => {
  assert.equal(validateCostConfig({ ...config, actualTotal: '12.50', note: 'Facture 123' }).actualTotal, 12.5)
  for (const value of [{ ...config, currency: 'USD' }, { ...config, rates: [...config.rates,...config.rates] }, { ...config, actualTotal: 1 }, { ...config, rates: [{ ...config.rates[0], unit: -1 }] }]) assert.throws(() => validateCostConfig(value))
})
test('CSV escapes formulas and quotes, and metadata retains only billing fields', () => {
  const csv = recipientsCsv([row({ customer_name: '=HYPERLINK("x")' })])
  assert.ok(csv.includes("'=")); assert.ok(csv.includes('""x""')); assert.ok(csv.startsWith('\ufeff'))
  const meta = statusMetadata({ timestamp: '1000', pricing: { billable: false, pricing_model: 'PMP', secret: 'never persist' } })
  assert.equal(meta.occurredAt, '1970-01-01T00:16:40.000Z'); assert.deepEqual(meta.pricing, { billable: false, pricing_model: 'PMP' })
})

test('Meta insights reads costs and templates, paginates safely and keeps partial failures', async () => {
  const { metaClient } = await import('../../server/marketing/meta.js')
  const calls = []
  const client = metaClient({ env: { WHATSAPP_GRAPH_VERSION: 'v25.0', WHATSAPP_BUSINESS_ACCOUNT_ID: '123', WHATSAPP_ACCESS_TOKEN: 'test-only' } }, async (url, options) => {
    calls.push(url)
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer test-only')
    const body = url.includes('fields=') ? { currency: 'EUR', name: 'Test' } : url.includes('/template_analytics') ? { error: { code: 200 } } : url.includes('after=') ? { data: [{ data_points: [{ cost: 2, volume: 20 }] }] } : { data: [{ data_points: [{ cost: 1, volume: 10 }] }], paging: { next: 'https://untrusted.invalid', cursors: { after: 'next' } } }
    return { ok: !body.error, json: async () => body }
  })
  const data = await client.insights({ start: 1000, end: 2000, templateId: '456' })
  assert.equal(data.account.currency, 'EUR'); assert.equal(data.pricing.length, 2)
  assert.equal(data.template, null); assert.equal(data.errors.template, '200')
  assert.ok(calls.every((url) => url.startsWith('https://graph.facebook.com/v25.0/123')))
  await assert.rejects(client.insights({ start: 0, end: 32*86400, templateId: '456' }))
})
