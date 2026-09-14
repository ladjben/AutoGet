import { parsePhoneNumberFromString } from 'libphonenumber-js'
const invalid = (message) => { throw Object.assign(new Error(message), { status: 400 }) }
const money = (value, maximum = 1000) => {
  const text = String(value)
  if (!/^\d+(\.\d{1,6})?$/.test(text) || Number(text) > maximum) invalid('Montant positif ou nul, avec six décimales maximum.')
  return Math.round(Number(text) * 1e6)
}
export function validateCostConfig(input) {
  if (!input || input.currency !== 'EUR' || !Array.isArray(input.rates) || input.rates.length > 500)
    invalid('Renseignez les tarifs en EUR.')
  const keys = new Set()
  const rates = input.rates.map((r) => {
    if (!r || !/^(\*|[A-Z]{2})$/.test(r.country) || !['marketing','utility','authentication','service'].includes(r.category))
      invalid('Pays ou catégorie de tarif invalide.')
    const key = r.country + ':' + r.category
    if (keys.has(key)) invalid('Un seul tarif par pays et catégorie.')
    keys.add(key)
    return { country: r.country, category: r.category, unit: money(r.unit) / 1e6 }
  })
  const actual = input.actualTotal === '' || input.actualTotal == null ? null : money(input.actualTotal, 1e9) / 1e6
  const note = String(input.note || '').trim()
  if (note.length > 500 || (actual !== null && !note)) invalid('Indiquez la source du montant facturé saisi (500 caractères maximum).')
  return { currency: 'EUR', rates, actualTotal: actual, note, updatedAt: new Date().toISOString() }
}
export function classifyPricing(pricing) {
  if (!pricing) return null
  if (typeof pricing.billable === 'boolean') return pricing.billable
  if (pricing.type === 'regular') return true
  if (['free_customer_service','free_entry_point'].includes(pricing.type)) return false
  return null
}
const iso = (date) => date ? new Date(date).toISOString() : null
const average = (a) => a.length ? a.reduce((x,y) => x+y,0) / a.length : null
export function summarizeCampaign(rows, config = {}, category = 'marketing') {
  const rates = config.rates || []
  const summary = { total: rows.length, accepted: 0, delivered: 0, read: 0, attempted: 0,
    attempts: 0, retried: 0, billable: 0, free: 0, pricingUnknown: 0,
    missingRates: 0, budgetMissingRates: 0, knownEstimate: 0, estimatedBudget: 0,
    observedWebhookRecipients: 0, states: {}, countries: [], errors: [], timeline: [],
    currency: 'EUR', actualTotal: config.actualTotal ?? null, costNote: config.note || '',
    clicks: null, conversions: null, revenue: null }
  const countries = new Map(), errors = new Map(), timeline = new Map()
  const deliveryLag = [], readLag = []
  let costMicros = 0, budgetMicros = 0
  const enriched = rows.map((r) => {
    const country = parsePhoneNumberFromString(r.phone)?.country || '??'
    const accepted = Boolean(r.message_id || r.sent_at || r.delivered_at || r.read_at)
    const delivered = Boolean(r.delivered_at || r.read_at || ['delivered','read'].includes(r.status))
    const read = Boolean(r.read_at || r.status === 'read')
    const billing = classifyPricing(r.pricing)
    const pricingCategory = r.pricing?.category || category.toLowerCase()
    const rate = rates.find((v) => v.country === country && v.category === pricingCategory)
      || rates.find((v) => v.country === '*' && v.category === pricingCategory)
    const unit = rate ? Math.round(Number(rate.unit) * 1e6) : null
    // Legacy conversation pricing cannot be priced as an individual message.
    const incompatible = r.pricing?.pricing_model && r.pricing.pricing_model !== 'PMP'
    const estimate = !delivered ? null : billing === false ? 0 : unit !== null && !incompatible ? unit : null
    summary.states[r.status] = (summary.states[r.status] || 0) + 1
    summary.accepted += Number(accepted); summary.delivered += Number(delivered); summary.read += Number(read)
    summary.attempted += Number(r.attempts > 0 || accepted)
    summary.attempts += Number(r.attempts); summary.retried += Number(r.attempts > 1)
    summary.observedWebhookRecipients += Number(r.has_webhook)
    if (delivered) {
      if (billing === true) summary.billable++
      else if (billing === false) summary.free++
      else summary.pricingUnknown++
      if (estimate === null) summary.missingRates++
      else costMicros += estimate
    }
    if (unit === null) summary.budgetMissingRates++
    else budgetMicros += unit
    const group = countries.get(country) || { country, total: 0, delivered: 0, read: 0, failed: 0 }
    group.total++; group.delivered += Number(delivered); group.read += Number(read); group.failed += Number(r.status === 'failed')
    countries.set(country, group)
    if (r.error_code) errors.set(r.error_code, (errors.get(r.error_code) || 0) + 1)
    for (const [key, date] of [['accepted', r.accepted_at || r.sent_at], ['delivered', r.delivered_at || r.read_at], ['read', r.read_at], ['failed', r.failed_at]]) {
      if (!date) continue
      const day = iso(date).slice(0,10), point = timeline.get(day) || { day, accepted: 0, delivered: 0, read: 0, failed: 0 }
      point[key]++; timeline.set(day, point)
    }
    if (r.sent_at && (r.delivered_at || r.read_at)) {
      const seconds = (new Date(r.delivered_at || r.read_at) - new Date(r.sent_at)) / 1000
      if (seconds >= 0) deliveryLag.push(seconds)
    }
    if (r.delivered_at && r.read_at) {
      const seconds = (new Date(r.read_at) - new Date(r.delivered_at)) / 1000
      if (seconds >= 0) readLag.push(seconds)
    }
    return { ...r, country, accepted, delivered, read, billable: billing,
      estimatedCost: estimate === null ? null : estimate / 1e6,
      unitPrice: unit === null ? null : unit / 1e6,
      costBasis: !delivered ? 'not_delivered' : billing === false ? 'meta_free' : estimate === null ? 'unavailable' : billing === true ? 'meta_billable_x_rate' : 'assumed_billable_x_rate' }
  })
  summary.knownEstimate = costMicros / 1e6
  summary.estimatedBudget = summary.budgetMissingRates ? null : budgetMicros / 1e6
  summary.estimatedTotal = summary.missingRates ? null : costMicros / 1e6
  summary.costPerAccepted = summary.accepted && summary.estimatedTotal !== null ? summary.estimatedTotal / summary.accepted : null
  summary.costPerDelivered = summary.delivered && summary.estimatedTotal !== null ? summary.estimatedTotal / summary.delivered : null
  summary.deliveryRate = summary.accepted ? summary.delivered / summary.accepted * 100 : null
  summary.readRate = summary.delivered ? summary.read / summary.delivered * 100 : null
  summary.failureRate = summary.attempted ? (summary.states.failed || 0) / summary.attempted * 100 : null
  summary.deliverySeconds = average(deliveryLag); summary.readSeconds = average(readLag)
  summary.deliverySamples = deliveryLag.length; summary.readSamples = readLag.length
  summary.countries = [...countries.values()].sort((a,b) => b.total-a.total)
  summary.errors = [...errors].map(([code,count]) => ({ code,count })).sort((a,b) => b.count-a.count)
  summary.timeline = [...timeline.values()].sort((a,b) => a.day.localeCompare(b.day))
  return { summary, recipients: enriched }
}
export async function campaignAnalytics(db, campaign) {
  const result = await db.query(`WITH history AS (
    SELECT e.recipient_id,
      min(e.created_at) FILTER (WHERE e.kind='accepted') AS accepted_at,
      min(COALESCE(e.occurred_at,e.created_at)) FILTER (WHERE e.kind='sent') AS sent_at,
      min(COALESCE(e.occurred_at,e.created_at)) FILTER (WHERE e.kind='delivered') AS delivered_at,
      min(COALESCE(e.occurred_at,e.created_at)) FILTER (WHERE e.kind='read') AS read_at,
      min(COALESCE(e.occurred_at,e.created_at)) FILTER (WHERE e.kind='failed') AS failed_at,
      bool_or(e.event_key IS NOT NULL) AS has_webhook,
      (array_agg(e.pricing ORDER BY COALESCE(e.occurred_at,e.created_at) DESC,e.id DESC)
        FILTER (WHERE e.pricing IS NOT NULL AND e.kind IN ('delivered','read')))[1] AS pricing
    FROM marketing.events e JOIN marketing.recipients r ON r.id=e.recipient_id
    WHERE r.campaign_id=$1 GROUP BY e.recipient_id
  ) SELECT r.id,r.phone,r.customer_name,r.status,r.attempts,r.message_id,r.error_code,r.retryable,
    r.updated_at,r.next_attempt_at,h.accepted_at,h.sent_at,h.delivered_at,h.read_at,h.failed_at,h.has_webhook,h.pricing
    FROM marketing.recipients r LEFT JOIN history h ON h.recipient_id=r.id
    WHERE r.campaign_id=$1 ORDER BY r.phone`, [campaign.id])
  return summarizeCampaign(result.rows, campaign.cost_config, campaign.template.category || 'marketing')
}
export function recipientsCsv(rows) {
  const columns = ['phone','customer_name','country','status','attempts','message_id','error_code','accepted_at','sent_at','delivered_at','read_at','failed_at','updated_at','retryable','next_attempt_at','billable','unitPrice','estimatedCost','costBasis']
  const cell = (v) => {
    let text = v == null ? '' : v instanceof Date ? v.toISOString() : String(v)
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"','""') + '"'
  }
  return '\ufeff' + [columns.join(';'), ...rows.map((r) => columns.map((c) => cell(r[c])).join(';'))].join('\r\n')
}
