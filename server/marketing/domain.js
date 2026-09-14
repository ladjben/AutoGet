import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function normalizePhone(value, country = 'DZ') {
  let input = String(value || '').trim()
  if (input.startsWith('00')) input = '+' + input.slice(2)
  const parsed = parsePhoneNumberFromString(input, country)
  return parsed?.isValid() ? parsed.number : null
}

export function buildAudience(
  rows,
  country = 'DZ',
  suppressed = new Set(),
  consents = new Map(),
) {
  const customers = new Map()
  let invalidPhones = 0
  for (const row of rows) {
    if (
      !['livré', 'livre', 'delivered'].includes(
        String(row.status).trim().toLowerCase(),
      )
    )
      continue
    const phone =
      normalizePhone(row.phone, country) ||
      normalizePhone(row.phone_fallback, country)
    if (!phone) {
      invalidPhones++
      continue
    }
    if (
      !row.order_id ||
      !row.product_id ||
      !row.ordered_at ||
      !Number.isFinite(Date.parse(row.ordered_at))
    ) {
      throw new Error(
        'Contrat ERP invalide : commande, produit ou date manquants.',
      )
    }
    if (!customers.has(phone))
      customers.set(phone, {
        phone,
        name: '',
        orders: new Set(),
        purchases: [],
        consent: true,
        lastOrder: '',
        city: '',
      })
    const c = customers.get(phone)
    const orderedAt = new Date(row.ordered_at).toISOString()
    if (orderedAt >= c.lastOrder) {
      c.name = String(row.customer_name || '')
      c.city = String(row.city || '')
      c.lastOrder = orderedAt
    }
    c.consent &&= row.marketing_opt_in === true
    c.orders.add(String(row.order_id))
    // Preserve separate lines / variants, while ignoring identical join duplicates.
    const purchase = {
      itemId: row.item_id ? String(row.item_id) : undefined,
      source: row.item_source || undefined,
      quantity: row.quantity == null ? null : String(row.quantity),
      orderId: String(row.order_id),
      productId: String(row.product_id),
      product: String(row.product_name || row.product_id),
      variant: String(row.variant || ''),
      size: String(row.size || ''),
      orderedAt,
    }
    if (
      !c.purchases.some((p) => JSON.stringify(p) === JSON.stringify(purchase))
    )
      c.purchases.push(purchase)
  }
  return {
    invalidPhones,
    customers: [...customers.values()]
      .map((c) => ({
        ...c,
        orders: undefined,
        orderCount: c.orders.size,
        consent: consents.has(c.phone)
          ? consents.get(c.phone) === true
          : c.consent,
        eligible:
          (consents.has(c.phone)
            ? consents.get(c.phone) === true
            : c.consent) && !suppressed.has(c.phone),
        suppressed: suppressed.has(c.phone),
      }))
      .sort((a, b) => a.phone.localeCompare(b.phone)),
  }
}

export function validateFilters(f = {}) {
  if (!f || typeof f !== 'object' || Array.isArray(f))
    throw new Error('Filtres invalides.')
  const out = {}
  for (const key of ['q', 'product', 'variant', 'size', 'city', 'from', 'to']) {
    if (f[key] != null && (typeof f[key] !== 'string' || f[key].length > 200))
      throw new Error('Filtre invalide : ' + key)
    out[key] = f[key] || ''
  }
  for (const key of ['from', 'to'])
    if (
      out[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(out[key]) ||
        !Number.isFinite(Date.parse(out[key])))
    )
      throw new Error('Date invalide.')
  if (out.from && out.to && out.from > out.to)
    throw new Error('La date de début doit précéder la date de fin.')
  for (const key of ['minOrders', 'maxOrders']) {
    const n = f[key] === '' || f[key] == null ? null : Number(f[key])
    if (n !== null && (!Number.isInteger(n) || n < 1))
      throw new Error('Nombre de commandes invalide.')
    out[key] = n
  }
  if (out.minOrders && out.maxOrders && out.minOrders > out.maxOrders)
    throw new Error('Intervalle de commandes invalide.')
  out.eligibleOnly = f.eligibleOnly === true || f.eligibleOnly === 'true'
  return out
}

export function filterAudience(customers, f) {
  return customers.filter(
    (c) =>
      (!f.eligibleOnly || c.eligible) &&
      (!f.q ||
        `${c.name} ${c.phone}`.toLowerCase().includes(f.q.toLowerCase())) &&
      (!f.city || c.city === f.city) &&
      (!f.minOrders || c.orderCount >= f.minOrders) &&
      (!f.maxOrders || c.orderCount <= f.maxOrders) &&
      // All purchase filters must match the SAME purchased item; keep complete history in output.
      c.purchases.some(
        (p) =>
          (!f.product || p.productId === f.product) &&
          (!f.variant || p.variant === f.variant) &&
          (!f.size || p.size === f.size) &&
          (!f.from || p.orderedAt.slice(0, 10) >= f.from) &&
          (!f.to || p.orderedAt.slice(0, 10) <= f.to),
      ),
  )
}

export function templateFields(template) {
  const fields = []
  for (const c of template.components || []) {
    if (c.type === 'FOOTER') continue
    if (c.type === 'HEADER' && c.format === 'IMAGE') {
      fields.push({ key: 'HEADER.image', component: 'HEADER', kind: 'image',
        label: 'Image du message · lien HTTPS public' })
      continue
    }
    if (c.type === 'BUTTONS') {
      for (const [index, button] of (c.buttons || []).entries()) {
        if (button.type === 'PHONE_NUMBER') continue
        if (button.type !== 'URL')
          throw new Error('Ce type de bouton n’est pas encore pris en charge : ' + button.type)
        const tokens = [...String(button.url || '').matchAll(/\{\{(\w+)\}\}/g)]
        if (tokens.length > 1 || (tokens.length &&
          (tokens[0][1] !== '1' || !button.url.endsWith('{{1}}'))))
          throw new Error('Le bouton doit utiliser une seule variable {{1}} en fin de lien.')
        if (tokens.length) fields.push({ key: `BUTTON.${index}`, component: 'BUTTON',
          index, kind: 'url', label: `Fin du lien · ${button.text}`, url: button.url })
      }
      continue
    }
    if (
      !['HEADER', 'BODY'].includes(c.type) ||
      (c.type === 'HEADER' && c.format !== 'TEXT')
    )
      throw new Error(
        'Ce format n’est pas encore pris en charge. Utilisez du texte, une image ou des boutons avec lien.',
      )
    const tokens = [
      ...new Set(
        [...String(c.text || '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
      ),
    ]
    if (
      template.parameter_format !== 'NAMED' &&
      tokens.some((t, i) => t !== String(i + 1))
    )
      throw new Error('Variables positionnelles invalides.')
    fields.push(
      ...tokens.map((token) => ({
        key: `${c.type}.${token}`,
        component: c.type,
        token,
      })),
    )
  }
  if (!(template.components || []).some((c) => c.type === 'BODY'))
    throw new Error('Corps du modèle manquant.')
  return fields
}

export function renderTemplate(template, bindings, customer) {
  const fields = templateFields(template)
  const values = {
    name: customer.name,
    phone: customer.phone,
    city: customer.city,
    orderCount: String(customer.orderCount),
    products: [...new Set(customer.purchases.map((p) => p.product))].join(', '),
    sizes: [
      ...new Set(customer.purchases.map((p) => p.size).filter(Boolean)),
    ].join(', '),
  }
  const resolved = Object.fromEntries(
    fields.map((f) => {
      const b = bindings?.[f.key]
      const value = b?.source === 'literal' ? b.value : values[b?.source]
      if (typeof value !== 'string' || !value.trim() || value.length > (f.kind === 'image' ? 2048 : 1000))
        throw new Error(
          `Variable ${f.key} vide ou invalide pour ${customer.phone}.`,
        )
      if (f.kind === 'image') {
        let url
        try { url = new URL(value) } catch { throw new Error('Lien de l’image invalide.') }
        if (b.source !== 'literal' || url.protocol !== 'https:' || url.username || url.password)
          throw new Error('L’image nécessite un lien HTTPS public, sans identifiants.')
      }
      return [f.key, value]
    }),
  )
  return {
    name: template.name,
    language: { code: template.language },
    components: ['HEADER', 'BODY'].flatMap((type) => {
      const tokens = fields.filter((f) => f.component === type)
      if (tokens.some((f) => f.kind === 'image')) return [{ type: 'header',
        parameters: [{ type: 'image', image: { link: resolved['HEADER.image'] } }] }]
      return tokens.length
        ? [
            {
              type: type.toLowerCase(),
              parameters: tokens.map((f) => ({
                type: 'text',
                text: resolved[f.key],
                ...(template.parameter_format === 'NAMED'
                  ? { parameter_name: f.token }
                  : {}),
              })),
            },
          ]
        : []
    }).concat(fields.filter((f) => f.component === 'BUTTON').map((f) => ({
      type: 'button', sub_type: 'url', index: String(f.index),
      parameters: [{ type: 'text', text: resolved[f.key] }],
    }))),
  }
}

export function nextStatus(current, incoming) {
  const ranks = {
    queued: 0,
    sending: 1,
    unknown: 1,
    failed: 4,
    sent: 3,
    delivered: 5,
    read: 6,
    skipped: 7,
  }
  if (!['sent', 'delivered', 'read', 'failed'].includes(incoming))
    return current
  return ranks[incoming] > (ranks[current] ?? 0) ? incoming : current
}
