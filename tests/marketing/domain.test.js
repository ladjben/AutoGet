import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAudience,
  filterAudience,
  validateFilters,
  normalizePhone,
  templateFields,
  renderTemplate,
  nextStatus,
} from '../../server/marketing/domain.js'
import { verifySignature } from '../../server/marketing/webhook.js'
import { createHmac } from 'node:crypto'
import { validSession } from '../../server/marketing/auth.js'
import { metaClient } from '../../server/marketing/meta.js'
const item = {
  phone: '0551234567',
  customer_name: 'Amine',
  order_id: '1',
  product_id: 'a',
  product_name: 'Sneakers',
  ordered_at: '2026-09-01',
  status: 'livré',
  size: '42',
  variant: 'Noir',
  marketing_opt_in: true,
}

test('normalise les formats algériens et internationaux, rejette les invalides', () => {
  for (const phone of ['0551234567', '+213551234567', '00213 551 23 45 67'])
    assert.equal(normalizePhone(phone), '+213551234567')
  assert.equal(normalizePhone('+33612345678'), '+33612345678')
  assert.equal(normalizePhone('abc'), null)
})
test('déduplique les téléphones et commandes en conservant les variantes', () => {
  const result = buildAudience([
    item,
    item,
    { ...item, phone: '+213551234567', size: '43' },
    { ...item, order_id: '2' },
    { ...item, status: 'returned' },
    { ...item, phone: 'bad' },
  ])
  assert.equal(result.customers.length, 1)
  assert.equal(result.customers[0].orderCount, 2)
  assert.equal(result.customers[0].purchases.length, 3)
  assert.equal(result.invalidPhones, 1)
})
test('produit et pointure doivent correspondre à la même ligne, historique complet conservé', () => {
  const { customers } = buildAudience([
    item,
    { ...item, product_id: 'b', size: '44', order_id: '2' },
  ])
  assert.equal(
    filterAudience(customers, validateFilters({ product: 'a', size: '44' }))
      .length,
    0,
  )
  assert.equal(
    filterAudience(
      customers,
      validateFilters({
        product: 'b',
        size: '44',
        from: '2026-09-01',
        to: '2026-09-01',
      }),
    )[0].purchases.length,
    2,
  )
  assert.equal(
    filterAudience(customers, validateFilters({ minOrders: '3' })).length,
    0,
  )
  assert.throws(() => validateFilters({ minOrders: '-1' }))
  assert.throws(() => validateFilters({ from: '2026-10-01', to: '2026-09-01' }))
})
test('consentement contradictoire ou désinscription exclut le contact', () => {
  assert.equal(
    buildAudience([item, { ...item, marketing_opt_in: false }]).customers[0]
      .eligible,
    false,
  )
  assert.equal(
    buildAudience([item], 'DZ', new Set(['+213551234567'])).customers[0]
      .eligible,
    false,
  )
})
test('variables nommées et positionnelles, champs vides et médias', () => {
  const template = {
    name: 'offer',
    language: 'fr',
    components: [{ type: 'BODY', text: 'Bonjour {{1}}, {{2}}' }],
  }
  const c = buildAudience([item]).customers[0]
  assert.equal(
    renderTemplate(
      template,
      { 'BODY.1': { source: 'name' }, 'BODY.2': { source: 'sizes' } },
      c,
    ).components[0].parameters[1].text,
    '42',
  )
  assert.throws(() => renderTemplate(template, {}, c))
  const named = {
    ...template,
    parameter_format: 'NAMED',
    components: [{ type: 'BODY', text: '{{name}}' }],
  }
  assert.equal(
    renderTemplate(named, { 'BODY.name': { source: 'name' } }, c).components[0]
      .parameters[0].parameter_name,
    'name',
  )
  assert.throws(() =>
    templateFields({ components: [{ type: 'HEADER', format: 'IMAGE' }] }),
  )
  assert.throws(() =>
    templateFields({ components: [{ type: 'BODY', text: '{{2}}' }] }),
  )
})
test('webhooks hors ordre : échec après acceptation, jamais de régression après lecture', () => {
  assert.equal(nextStatus('sent', 'failed'), 'failed')
  assert.equal(nextStatus('failed', 'sent'), 'failed')
  assert.equal(nextStatus('failed', 'delivered'), 'delivered')
  assert.equal(nextStatus('read', 'failed'), 'read')
  assert.equal(nextStatus('read', 'sent'), 'read')
})
test('signature webhook vérifie les octets originaux et rejette les altérations', () => {
  const body = Buffer.from('{"test":true}')
  const sig =
    'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex')
  assert.equal(verifySignature(body, sig, 'secret'), true)
  assert.equal(verifySignature(Buffer.from('{}'), sig, 'secret'), false)
  assert.equal(verifySignature(body, '', 'secret'), false)
})
test('session signée : expiration et falsification', () => {
  const expiry = '2000',
    sig = createHmac('sha256', 'secret').update(expiry).digest('hex')
  assert.equal(
    validSession(`marketing_session=${expiry}.${sig}`, 'secret', 1000),
    true,
  )
  assert.equal(
    validSession(`marketing_session=${expiry}.${sig}`, 'secret', 3000),
    false,
  )
  assert.equal(
    validSession(`marketing_session=9000.${sig}`, 'secret', 1000),
    false,
  )
})
test('Meta pagine sans suivre une URL externe et garde le token en en-tête', async () => {
  const calls = []
  const meta = metaClient(
    {
      env: {
        WHATSAPP_GRAPH_VERSION: 'v25.0',
        WHATSAPP_ACCESS_TOKEN: 'private',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '123',
      },
    },
    async (url, options) => {
      calls.push(url)
      assert.equal(options.headers.Authorization, 'Bearer private')
      return {
        ok: true,
        json: async () =>
          calls.length === 1
            ? {
                data: [{ id: 'a' }],
                paging: {
                  next: 'https://evil.test/',
                  cursors: { after: 'cursor' },
                },
              }
            : { data: [{ id: 'b' }] },
      }
    },
  )
  assert.equal((await meta.templates()).length, 2)
  assert.match(calls[1], /^https:\/\/graph.facebook.com\//)
  assert.equal(
    calls.some((url) => url.includes('private')),
    false,
  )
})
test('une interruption réseau lors d’un envoi est incertaine et non relançable', async () => {
  const meta = metaClient(
    { env: { WHATSAPP_GRAPH_VERSION: 'v25.0' } },
    async () => {
      throw new Error('timeout')
    },
  )
  await assert.rejects(
    () => meta.send('+213551234567', {}, 'id'),
    (e) => e.ambiguous && !e.retryable,
  )
})

test('repli sur le téléphone principal quand le téléphone normalisé est invalide', () => {
  const c = buildAudience([
    { ...item, phone: 'bad', phone_fallback: '0551234567' },
  ]).customers[0]
  assert.equal(c.phone, '+213551234567')
})
test('consentement actuel du registre prime sur ERP, STOP prime sur le registre', () => {
  const phone = '+213551234567'
  assert.equal(
    buildAudience(
      [{ ...item, marketing_opt_in: false }],
      'DZ',
      new Set(),
      new Map([[phone, true]]),
    ).customers[0].eligible,
    true,
  )
  assert.equal(
    buildAudience([item], 'DZ', new Set(), new Map([[phone, false]]))
      .customers[0].eligible,
    false,
  )
  assert.equal(
    buildAudience([item], 'DZ', new Set([phone]), new Map([[phone, true]]))
      .customers[0].eligible,
    false,
  )
})
test('les sources et lignes distinctes sont conservées sans inventer de pointure', () => {
  const c = buildAudience([
    { ...item, item_id: 'woo:1', item_source: 'woo', size: '', quantity: '2' },
    { ...item, item_id: 'woo:2', item_source: 'woo', size: '', quantity: '1' },
  ]).customers[0]
  assert.equal(c.orderCount, 1)
  assert.equal(c.purchases.length, 2)
  assert.equal(c.purchases[0].size, '')
  assert.equal(c.purchases[0].source, 'woo')
  assert.equal(c.purchases[0].quantity, '2')
})
