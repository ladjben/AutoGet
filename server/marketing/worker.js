import { setTimeout as delay } from 'node:timers/promises'
import { sendingEnabled } from './sending.js'
import { contactEligibility } from './db.js'

export async function workOnce(db, _erp, cfg, meta) {
  if (!sendingEnabled(cfg)) return
  const client = await db.connect()
  let locked = false
  try {
    // Supabase session pooler or direct PostgreSQL only. Bound an orphan lock if Vercel kills a request.
    await client.query("SET idle_session_timeout='120s'")
    locked = (
      await client.query('SELECT pg_try_advisory_lock(81273492) AS locked')
    ).rows[0].locked
    if (!locked) return
    // A process may have died after Meta accepted the message: never auto-requeue.
    await client.query(
      "UPDATE marketing.recipients SET status='unknown',error_code='WORKER_INTERRUPTED',retryable=false,updated_at=now() WHERE status='sending' AND updated_at < now()-interval '5 minutes'",
    )
    const next = await client.query(
      `SELECT r.* FROM marketing.recipients r JOIN marketing.campaigns c ON c.id=r.campaign_id WHERE r.status='queued' AND r.next_attempt_at<=now() AND c.state='running' ORDER BY r.next_attempt_at,r.id LIMIT 1`,
    )
    const row = next.rows[0]
    if (!row) return
    const eligibility = await contactEligibility(client, row.phone)
    // Leave queued until a successful refresh. Never skip customers on stale data.
    if (!eligibility.fresh) return
    if (!eligibility.eligible) {
      await client.query(
        "UPDATE marketing.recipients SET status='skipped',error_code='NO_CURRENT_CONSENT',updated_at=now() WHERE id=$1 AND status='queued'",
        [row.id],
      )
      await client.query(
        "INSERT INTO marketing.events(recipient_id,kind,code) VALUES($1,'skipped','NO_CURRENT_CONSENT')",
        [row.id],
      )
      return { processed: true }
    }
    const claimed = await client.query(
      "UPDATE marketing.recipients SET status='sending',attempts=attempts+1,updated_at=now() WHERE id=$1 AND status='queued' AND EXISTS(SELECT 1 FROM marketing.campaigns WHERE id=campaign_id AND state='running') RETURNING *",
      [row.id],
    )
    if (!claimed.rowCount) return
    let result
    try {
      result = await meta.send(row.phone, row.payload, row.id)
      if (!result.messages?.[0]?.id)
        throw Object.assign(new Error('Missing message id'), {
          code: 'RESPONSE_UNCERTAIN',
          ambiguous: true,
        })
    } catch (e) {
      const retry =
        Boolean(e.retryable) && claimed.rows[0].attempts < 5 && !e.ambiguous
      const state = e.ambiguous ? 'unknown' : retry ? 'queued' : 'failed'
      const backoff =
        Math.min(3600, 30 * 2 ** claimed.rows[0].attempts) +
        Math.floor(Math.random() * 10)
      await client.query(
        "UPDATE marketing.recipients SET status=$2,error_code=$3,retryable=$4,next_attempt_at=now()+($5 * interval '1 second'),updated_at=now() WHERE id=$1 AND status='sending' AND message_id IS NULL",
        [
          row.id,
          state,
          e.code || 'API_ERROR',
          Boolean(e.retryable) && !e.ambiguous,
          backoff,
        ],
      )
      await client.query(
        'INSERT INTO marketing.events(recipient_id,kind,code) VALUES($1,$2,$3)',
        [row.id, state, e.code || 'API_ERROR'],
      )
      return { processed: true }
    }
    // DB failure here deliberately leaves 'sending' for later uncertain recovery.
    // A webhook may already have updated the status; preserve its stronger evidence.
    await client.query(
      "UPDATE marketing.recipients SET message_id=$2,status=CASE WHEN status IN ('sending','unknown') THEN 'sent' ELSE status END,error_code=CASE WHEN status='failed' THEN error_code ELSE NULL END,retryable=false,updated_at=now() WHERE id=$1",
      [row.id, result.messages[0].id],
    )
    await client.query(
      "INSERT INTO marketing.events(recipient_id,kind) VALUES($1,'accepted')",
      [row.id],
    )
    return { processed: true }
  } finally {
    if (locked) {
      // Hold the database lock across pacing so multiple workers share one rate.
      await delay(cfg.interval)
      try {
        await client.query('SELECT pg_advisory_unlock(81273492)')
      } catch {
        locked = 'broken'
      }
    }
    client.release(true) // never leave an advisory-lock session in a frozen instance
  }
}

export async function runWorker(db, erp, cfg, meta, signal) {
  while (!signal.aborted) {
    try {
      await workOnce(db, erp, cfg, meta)
    } catch {
      console.error(
        'Marketing worker: cycle interrompu, vérifier la connexion et le contrat ERP.',
      )
    }
    await delay(1000)
  }
}
