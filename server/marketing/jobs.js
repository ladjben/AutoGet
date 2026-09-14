import { safeEqual } from './auth.js'
import { dispatchBatch } from './worker.js'

import { sendingEnabled } from './sending.js'

export async function runBatch(
  db,
  erp,
  cfg,
  meta,
  { budgetMs = 240000, now = Date.now, step } = {},
) {
  if (!step) return dispatchBatch(db, cfg, meta, { budgetMs, now })
  const deadline = now() + budgetMs
  let processed = 0
  // Reserve enough time for Supabase checks, Meta timeout and DB writes.
  while (now() < deadline) {
    const result = await step(db, erp, cfg, meta)
    if (!result?.processed) break
    processed += Number(result.processed)
  }
  return { processed }
}

export function installJobs(app, db, erp, cfg, meta) {
  // Registered before browser authentication: requires its own server-only secret.
  app.post('/api/marketing/worker', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const secret = cfg.env.CRON_SECRET
    if (
      !secret ||
      secret.length < 32 ||
      !safeEqual(req.headers.authorization, `Bearer ${secret}`)
    ) {
      return res.status(401).json({ error: 'Accès worker refusé.' })
    }
    if (cfg.env.VERCEL && cfg.env.VERCEL_ENV !== 'production') {
      return res
        .status(403)
        .json({ error: 'Worker désactivé sur les déploiements Preview.' })
    }
    await db.query(`INSERT INTO marketing.worker_health(id,last_started_at,last_error) VALUES(1,now(),NULL)
      ON CONFLICT(id) DO UPDATE SET last_started_at=now(),last_error=NULL`)
    try {
      const result = sendingEnabled(cfg)
        ? await runBatch(db, erp, cfg, meta)
        : { processed: 0 }
      await db.query(
        'UPDATE marketing.worker_health SET last_finished_at=now(),last_processed=$1 WHERE id=1',
        [result.processed],
      )
      res.json({ ok: true, sendingEnabled: sendingEnabled(cfg), ...result })
    } catch (e) {
      await db.query(
        "UPDATE marketing.worker_health SET last_error='WORKER_FAILED' WHERE id=1",
      )
      throw e
    }
  })
}
