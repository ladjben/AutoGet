import test from 'node:test'
import assert from 'node:assert/strict'
import { routeRequest, config as functionConfig } from '../../api/marketing.js'
import { sendingEnabled } from '../../server/marketing/sending.js'
import { runBatch } from '../../server/marketing/jobs.js'
import { readFile } from 'node:fs/promises'

test('Vercel rewrites preserve parameters and expose the same authenticated routes', () => {
  const req = { url: '/api/marketing?__route=campaigns/abc/start&page=2' }
  routeRequest(req)
  assert.equal(req.url, '/api/marketing/campaigns/abc/start?page=2')
  const webhook = {
    url: '/api/marketing?__route=__webhook&hub.mode=subscribe&hub.challenge=123',
  }
  routeRequest(webhook)
  assert.equal(
    webhook.url,
    '/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=123',
  )
  assert.throws(() =>
    routeRequest({ url: '/api/marketing?__route=../../admin' }),
  )
  assert.equal(functionConfig.api.bodyParser, false)
})
test('Preview cannot send even if production environment settings were copied', () => {
  assert.equal(
    sendingEnabled({
      env: {
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        WHATSAPP_SENDING_ENABLED: 'true',
      },
    }),
    false,
  )
  assert.equal(
    sendingEnabled({
      env: {
        VERCEL: '1',
        VERCEL_ENV: 'production',
        WHATSAPP_SENDING_ENABLED: 'true',
      },
    }),
    true,
  )
  assert.equal(
    sendingEnabled({ env: { WHATSAPP_SENDING_ENABLED: 'false' } }),
    false,
  )
})
test('batch stops at its budget and at an empty or locked queue', async () => {
  let clock = 0
  const result = await runBatch(null, null, null, null, {
    budgetMs: 100,
    now: () => clock,
    step: async () => {
      clock += 60
      return { processed: true }
    },
  })
  assert.equal(result.processed, 2)
  let calls = 0
  assert.equal(
    (
      await runBatch(null, null, null, null, {
        step: async () => {
          calls++
          return undefined
        },
      })
    ).processed,
    0,
  )
  assert.equal(calls, 1)
})
test('Vercel keeps Vite output and sends only API paths to the function', async () => {
  const cfg = JSON.parse(
    await readFile(new URL('../../vercel.json', import.meta.url)),
  )
  assert.equal(cfg.framework, 'vite')
  assert.equal(cfg.outputDirectory, 'dist')
  assert.equal(cfg.functions['api/marketing.js'].maxDuration, 300)
  assert.ok(cfg.rewrites.every((r) => r.source.startsWith('/api/')))
  assert.equal(cfg.crons, undefined, 'no unsupported Hobby per-minute cron')
})

test('Supabase session connections accepted; transaction pooling rejected', async () => {
  const { validateMarketingConnection } = await import('../../server/marketing/config.js')
  assert.doesNotThrow(() => validateMarketingConnection('postgresql://user:pass@aws-0-test.pooler.supabase.com:5432/postgres'))
  assert.doesNotThrow(() => validateMarketingConnection('postgresql://user:pass@db.test.supabase.co:5432/postgres'))
  assert.throws(() => validateMarketingConnection('postgresql://user:pass@aws-0-test.pooler.supabase.com:6543/postgres'))
})
