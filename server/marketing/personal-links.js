import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { normalizePhone } from './domain.js'
import wilayas from './personal-wilayas.json' with { type: 'json' }

export const linkHash = token => createHash('sha256').update(token).digest('hex')
export const newPersonalLink = () => {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: linkHash(token), requestId: randomUUID() }
}
export function personalLinksEnabled(cfg) {
  return cfg.env.PERSONAL_LINKS_ENABLED === 'true' &&
    (!cfg.env.VERCEL || cfg.env.VERCEL_ENV === 'production') &&
    /^https:\/\//.test(cfg.env.PERSONAL_LANDING_URL || '') &&
    Boolean(cfg.env.PERSONAL_SHOPIFY_SHOP && cfg.env.PERSONAL_SHOPIFY_CLIENT_ID &&
      cfg.env.PERSONAL_SHOPIFY_CLIENT_SECRET && cfg.env.PERSONAL_ORDER_WEBHOOK_URL)
}
export function validatePersonalBindings(template, bindings, cfg) {
  const used = Object.entries(bindings || {}).filter(([, b]) => b?.source === 'personalLink')
  if (!used.length) return false
  if (!personalLinksEnabled(cfg)) throw new Error('Les liens personnels ne sont pas encore configurés.')
  const buttons = template.components?.find(c => c.type === 'BUTTONS')?.buttons || []
  const canonical = value => { try { return new URL(value).href } catch { return null } }
  for (const [key] of used) {
    const match = /^BUTTON\.(\d+)$/.exec(key)
    if (!match || canonical(buttons[Number(match[1])]?.url) !== canonical(cfg.env.PERSONAL_LANDING_URL + '?access={{1}}'))
      throw new Error('Le lien personnel nécessite le bouton approuvé de la landing COSMOS, terminé par ?access={{1}}.')
  }
  return true
}

// No customer resource access: use the most recent matching Shopify order address.
export async function previousContact(phone, cfg, fetcher = fetch) {
  if (!phone || normalizePhone(phone) !== phone) throw new Error('PHONE_INVALID')
  const shop = cfg.env.PERSONAL_SHOPIFY_SHOP
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(shop || '')) throw new Error('SHOP_CONFIG')
  const tokenResponse = await fetcher(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials',
      client_id: cfg.env.PERSONAL_SHOPIFY_CLIENT_ID, client_secret: cfg.env.PERSONAL_SHOPIFY_CLIENT_SECRET }),
  })
  const token = await tokenResponse.json()
  if (!tokenResponse.ok || !token.access_token) throw new Error('SHOP_AUTH')
  const response = await fetcher(`https://${shop}/admin/api/2026-07/graphql.json`, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token.access_token },
    body: JSON.stringify({ query: `query Previous($q:String!) { orders(first:10,sortKey:CREATED_AT,reverse:true,query:$q) { nodes { id phone cancelledAt shippingAddress { firstName lastName phone address1 address2 city } billingAddress { firstName lastName phone address1 address2 city } } } }`,
      // Orders has no documented phone filter: broad text search, then exact verification below.
      variables: { q: [phone, phone.slice(1), ...(phone.startsWith('+213') ? ['0' + phone.slice(4)] : [])].map(p => JSON.stringify(p)).join(' OR ') } }),
  })
  const data = await response.json()
  if (!response.ok || data.errors) throw new Error('SHOP_READ')
  const order = data.data?.orders?.nodes?.find(o => !o.cancelledAt &&
    [o.phone, o.shippingAddress?.phone, o.billingAddress?.phone].some(p => normalizePhone(p) === phone))
  // Do not silently substitute an older address when the latest order is incomplete.
  const a = order?.shippingAddress || order?.billingAddress
  const name = [a?.firstName, a?.lastName].filter(Boolean).join(' ').trim()
  const address = [a?.address1, a?.address2].filter(Boolean).join(', ').trim()
  if (name.length < 2 || !a?.address1 || address.length < 4 || address.length > 220 || !wilayas.includes(a?.city)) return null
  // Never reuse somebody else's delivery address from a gift/order paid by this phone.
  if (normalizePhone(a.phone) !== phone) return null
  return { name, phone, address, wilaya: a.city, sourceOrderId: order.id }
}
export function contactPreview(c) {
  // The opaque personal link grants access to these delivery details.
  // Keep phoneEnding for already-installed older landing templates.
  return { phoneEnding: c.phone.slice(-4), phone: c.phone, wilaya: c.wilaya, address: c.address }
}

export function installPersonalLinks(app, db, cfg, fetcher = fetch) {
  const path = '/api/marketing/personal'
  app.use(path, (req, res, next) => {
    res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer')
    const origin = 'https://cosmos-algerie.com'
    if (req.headers.origin !== origin) return res.status(403).json({ error: 'Origine refusée.' })
    res.set('Access-Control-Allow-Origin', origin).set('Vary', 'Origin')
    res.set('Access-Control-Allow-Headers', 'Content-Type').set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    if (!personalLinksEnabled(cfg)) return res.status(503).json({ error: 'Service non disponible.' })
    next()
  })
  const lookup = async token => {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
    const result = await db.query(`UPDATE marketing.personal_links l SET views=views+1
      FROM marketing.recipients r WHERE l.recipient_id=r.id AND l.token_hash=$1
      AND l.expires_at>now() AND l.revoked_at IS NULL AND l.views<60
      AND NOT EXISTS(SELECT 1 FROM marketing.suppressions s WHERE s.phone=r.phone)
      RETURNING l.*,r.phone`, [linkHash(token)])
    return result.rows[0]
  }
  app.post(path + '/preview', async (req, res) => {
    const row = await lookup(req.body?.token)
    if (!row) return res.status(404).json({ error: 'Lien expiré ou indisponible.' })
    if (row.state !== 'ready') return res.json({ state: row.state, result: row.result })
    let contact = row.contact
    if (!contact) {
      contact = await previousContact(row.phone, cfg, fetcher)
      if (!contact) return res.status(422).json({ error: 'Saisissez vos coordonnées dans le formulaire.' })
      const saved = await db.query(`UPDATE marketing.personal_links SET contact=COALESCE(contact,$2::jsonb)
        WHERE token_hash=$1 AND state='ready' RETURNING contact`, [row.token_hash, JSON.stringify(contact)])
      if (!saved.rowCount) return res.status(409).json({ error: 'Demande déjà en cours.' })
      contact = saved.rows[0].contact
    }
    res.json({ state: 'ready', ...contactPreview(contact) })
  })
  app.post(path + '/confirm', async (req, res) => {
    const { token, model, delivery } = req.body || {}
    if (!['p20', 'p44n'].includes(model) || !['home', 'stop_desk'].includes(delivery))
      return res.status(400).json({ error: 'Choisissez un modèle et une livraison.' })
    const row = await lookup(token)
    if (!row) return res.status(404).json({ error: 'Lien expiré ou indisponible.' })
    if (row.state === 'created') return res.json(row.result)
    if (row.state !== 'ready') return res.status(202).json({ pending: true })
    if (!row.contact) return res.status(409).json({ error: 'Ouvrez d’abord le récapitulatif.' })
    const claim = await db.query(`UPDATE marketing.personal_links SET state='processing'
      WHERE token_hash=$1 AND state='ready' RETURNING request_id`, [row.token_hash])
    if (!claim.rowCount) return res.status(202).json({ pending: true })
    let result, state = 'review'
    try {
      const endpoint = new URL(cfg.env.PERSONAL_ORDER_WEBHOOK_URL)
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('WEBHOOK_CONFIG')
      const response = await fetcher(endpoint, {
        method: 'POST', signal: AbortSignal.timeout(80000),
        headers: { 'Content-Type': 'application/json', Origin: 'https://cosmos-algerie.com' },
        body: JSON.stringify({ ...row.contact, sourceOrderId: undefined, model, delivery,
          quantity: 1, requestId: row.request_id }),
      })
      const data = await response.json()
      if (response.ok && data.ok === true && typeof data.orderName === 'string') {
        state = 'created'
        result = { ok: true, orderName: data.orderName, total: data.total }
      } else if ([400,403,409].includes(response.status) && !data.pending) {
        state = 'failed'; result = { ok: false, error: 'Coordonnées ou offre indisponibles. Contactez COSMOS.' }
      }
    } catch { /* An uncertain order must never trigger an automatic second attempt. */ }
    result ||= { pending: true }
    await db.query('UPDATE marketing.personal_links SET state=$2,result=$3 WHERE token_hash=$1',
      [row.token_hash, state, result])
    res.status(state === 'created' ? 200 : state === 'failed' ? 409 : 202).json(result)
  })
}
