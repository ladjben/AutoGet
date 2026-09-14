import { createHmac, createHash } from 'node:crypto'
import express from 'express'
import { safeEqual } from './auth.js'
import { nextStatus, normalizePhone } from './domain.js'
import { transaction } from './db.js'

export function verifySignature(body, signature, secret) {
  return safeEqual(
    signature,
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex'),
  )
}
export function statusMetadata(status) {
  const seconds = Number(status.timestamp)
  const occurredAt = Number.isFinite(seconds) && seconds > 0 && seconds < Date.now() / 1000 + 86400
    ? new Date(seconds * 1000).toISOString() : null
  const pricing = {}
  if (typeof status.pricing?.billable === 'boolean') pricing.billable = status.pricing.billable
  for (const key of ['category','type','pricing_model'])
    if (typeof status.pricing?.[key] === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(status.pricing[key])) pricing[key] = status.pricing[key]
  return { occurredAt, pricing: Object.keys(pricing).length ? pricing : null }
}
export function installWebhook(app, db, cfg) {
  app.get('/api/whatsapp/webhook', (req, res) => {
    if (
      req.query['hub.mode'] !== 'subscribe' ||
      !safeEqual(req.query['hub.verify_token'], cfg.env.WHATSAPP_VERIFY_TOKEN)
    )
      return res.sendStatus(403)
    res.type('text/plain').send(String(req.query['hub.challenge'] || ''))
  })
  app.post(
    '/api/whatsapp/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      if (
        !Buffer.isBuffer(req.body) ||
        !verifySignature(
          req.body,
          req.headers['x-hub-signature-256'],
          cfg.env.WHATSAPP_APP_SECRET,
        )
      )
        return res.sendStatus(403)
      let payload
      try {
        payload = JSON.parse(req.body.toString())
      } catch {
        return res.sendStatus(400)
      }
      if (payload.object !== 'whatsapp_business_account')
        return res.sendStatus(200)
      await transaction(db, async (client) => {
        for (const entry of payload.entry || []) {
          if (String(entry.id) !== cfg.env.WHATSAPP_BUSINESS_ACCOUNT_ID)
            continue
          for (const change of entry.changes || []) {
            const value = change.value || {}
            if (
              String(value.metadata?.phone_number_id) !==
              cfg.env.WHATSAPP_PHONE_NUMBER_ID
            )
              continue
            for (const message of value.messages || []) {
              const text = String(
                message.text?.body || message.button?.text || '',
              )
                .trim()
                .toLowerCase()
              if (
                [
                  'stop',
                  'unsubscribe',
                  'désinscrire',
                  'desinscrire',
                  'arrêt',
                  'arret',
                ].includes(text)
              ) {
                const phone = normalizePhone('+' + message.from, cfg.country)
                if (phone)
                  await client.query(
                    "INSERT INTO marketing.suppressions(phone,reason) VALUES($1,'whatsapp_stop') ON CONFLICT(phone) DO NOTHING",
                    [phone],
                  )
              }
            }
            for (const status of value.statuses || []) {
              if (
                !['sent', 'delivered', 'read', 'failed'].includes(
                  status.status,
                ) ||
                !status.id
              )
                continue
              const callback = /^[0-9a-f-]{36}$/i.test(
                status.biz_opaque_callback_data || '',
              )
                ? status.biz_opaque_callback_data
                : null
              const recipient = await client.query(
                'SELECT * FROM marketing.recipients WHERE message_id=$1 OR (id=$2::uuid AND message_id IS NULL) FOR UPDATE',
                [status.id, callback],
              )
              const row = recipient.rows[0]
              if (!row) continue
              const key = createHash('sha256')
                .update(`${status.id}:${status.status}:${status.timestamp}`)
                .digest('hex')
              const code = status.errors?.[0]?.code
                ? String(status.errors[0].code)
                : null
              const metadata = statusMetadata(status)
              const added = await client.query(
                'INSERT INTO marketing.events(recipient_id,event_key,kind,code,occurred_at,pricing) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING RETURNING id',
                [row.id, key, status.status, code, metadata.occurredAt, metadata.pricing],
              )
              if (!added.rowCount) continue
              const next = nextStatus(row.status, status.status)
              await client.query(
                "UPDATE marketing.recipients SET status=$2,message_id=$3,error_code=CASE WHEN $2='failed' THEN $4 ELSE NULL END,retryable=false,updated_at=now() WHERE id=$1",
                [row.id, next, status.id, code],
              )
            }
          }
        }
      })
      res.sendStatus(200)
    },
  )
}
