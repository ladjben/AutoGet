import test from 'node:test'
import assert from 'node:assert/strict'
import { createMarketingTemplate } from '../../server/marketing/template-create.js'
import { metaClient } from '../../server/marketing/meta.js'
const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='
const input = { name: 'collection', language: 'fr', body: 'Bonjour {{1}}', examples: ['Amine'],
  image: { type: 'image/png', data }, buttonText: 'Voir la collection', buttonUrl: 'https://shop.example/collection' }
test('image upload session, binary bytes and header handle precede template submission', async () => {
  const calls = []
  const meta = metaClient({ env: { WHATSAPP_GRAPH_VERSION: 'v25.0', WHATSAPP_ACCESS_TOKEN: 'test-secret', WHATSAPP_BUSINESS_ACCOUNT_ID: '123' } }, async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => [{ id: 'upload:session?sig=abc' }, { h: 'opaque-media-handle' }, { id: 'template-id', status: 'PENDING' }][calls.length - 1] }
  })
  assert.equal((await createMarketingTemplate(input, meta)).status, 'PENDING')
  assert.match(calls[0].url, /\/app\/uploads\?file_length=\d+&file_type=image%2Fpng$/)
  assert.equal(calls[1].options.headers.file_offset, '0')
  assert.equal(calls[1].options.headers.Authorization, 'OAuth test-secret')
  assert.deepEqual(calls[1].options.body, Buffer.from(data, 'base64'))
  const sent = JSON.parse(calls[2].options.body)
  assert.deepEqual(sent.components, [
    { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['opaque-media-handle'] } },
    { type: 'BODY', text: 'Bonjour {{1}}', example: { body_text: [['Amine']] } },
    { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Voir la collection', url: 'https://shop.example/collection' }] },
  ])
  assert.ok(calls.every((c) => !c.url.includes('test-secret')))
})
test('invalid form fields never initiate an upload or create a template', async () => {
  const meta = { uploadTemplateImage: () => assert.fail('upload called'), createTemplate: () => assert.fail('create called') }
  for (const patch of [
    { buttonUrl: 'javascript:alert(1)' }, { buttonText: '' }, { buttonUrl: 'https://user:pass@shop.example' },
    { examples: [] }, { image: { type: 'image/png', data: 'not base64' } },
    { image: { type: 'image/jpeg', data } }, { image: { type: 'image/png', data: 'A'.repeat(1400001) } },
  ]) await assert.rejects(() => createMarketingTemplate({ ...input, ...patch }, meta), (e) => e.status === 400)
})
test('text-only creation still works; failed media upload cannot submit a template', async () => {
  let submitted
  await createMarketingTemplate({ name: 'simple', language: 'ar', body: 'Bonjour' }, {
    createTemplate: async (body) => { submitted = body },
  })
  assert.deepEqual(submitted.components, [{ type: 'BODY', text: 'Bonjour' }])
  await assert.rejects(() => createMarketingTemplate(input, {
    uploadTemplateImage: async () => { throw new Error('upload failed') },
    createTemplate: () => assert.fail('create called'),
  }), /upload failed/)
})
