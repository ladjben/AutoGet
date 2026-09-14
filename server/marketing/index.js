import express from 'express'
import helmet from 'helmet'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { databases } from './db.js'
import { metaClient } from './meta.js'
import { installAuth } from './auth.js'
import { installWebhook } from './webhook.js'
import { installApi } from './api.js'
import { installJobs } from './jobs.js'
import { runWorker } from './worker.js'

export function createApp(cfg, db, erp, meta) {
  const app = express()
  app.disable('x-powered-by')
  const supabaseOrigin = new URL(
    cfg.env.VITE_SUPABASE_URL || 'https://nyehvkzhflxrewllwjzv.supabase.co',
  ).origin
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: [
            "'self'",
            supabaseOrigin,
            supabaseOrigin.replace('https:', 'wss:'),
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          upgradeInsecureRequests: cfg.secure ? [] : null,
        },
      },
    }),
  )
  installWebhook(app, db, cfg) // signature verification needs original bytes
  app.use(express.json({ limit: '2mb' }))
  installJobs(app, db, erp, cfg, meta)
  installAuth(app, cfg, db)
  installApi(app, db, erp, cfg, meta)
  app.use('/api', (req, res) =>
    res.status(404).json({ error: 'Route inconnue.' }),
  )
  app.use(
    express.static(fileURLToPath(new URL('../../dist/', import.meta.url))),
  )
  app.use((err, req, res, _next) => {
    const status = err.status || 500
    // Never log connection URLs, credentials, raw Graph responses or customer data.
    console.error(
      'Marketing request failed:',
      status,
      err.code || 'REQUEST_ERROR',
    )
    res.status(status).json({
      error:
        status < 500
          ? err.message
          : 'Service indisponible. Vérifiez la configuration serveur, la connexion Supabase et la synchronisation.',
    })
  })
  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cfg = config()
  const { db, erp } = databases(cfg)
  const meta = metaClient(cfg)
  const controller = new AbortController()
  const server = createApp(cfg, db, erp, meta).listen(cfg.port, () =>
    console.log(`Marketing server ready on port ${cfg.port}`),
  )
  const worker = runWorker(db, erp, cfg, meta, controller.signal)
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, async () => {
      controller.abort()
      await new Promise((resolve) => server.close(resolve))
      await worker
      await db.end()
    })
}
