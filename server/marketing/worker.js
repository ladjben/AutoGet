import { setTimeout as delay } from 'node:timers/promises'
import { sendingEnabled } from './sending.js'

// One coordinator owns the DB session lock; HTTP requests overlap, SQL stays bounded
// to one leased connection. This avoids multiplying Supabase connections by workers.
export async function dispatchBatch(db, cfg, meta, {
  budgetMs = 240000, maxMessages = Infinity, now = Date.now,
} = {}) {
  if (!sendingEnabled(cfg)) return { processed: 0 }
  const client = await db.connect()
  const active = new Set()
  let locked = false, processed = 0, failure, lastStarted = 0
  const deadline = now() + budgetMs
  const concurrency = cfg.concurrency || 20
  try {
    await client.query("SET idle_session_timeout='120s'")
    locked = (await client.query('SELECT pg_try_advisory_lock(81273492) AS locked')).rows[0].locked
    if (!locked) return { processed: 0 }
    await client.query("UPDATE marketing.recipients SET status='unknown',error_code='WORKER_INTERRUPTED',retryable=false,updated_at=now() WHERE status='sending' AND updated_at < now()-interval '5 minutes'")
    while (now() < deadline && processed < maxMessages && !failure) {
      if (active.size >= concurrency) {
        await Promise.race(active)
        continue
      }
      // Claim and recheck consent, suppressions, snapshot age and campaign pause
      // in ONE statement immediately before each attempt. No ERP reads.
      const claimed = await client.query(`WITH candidate AS (
        SELECT r.id,
          EXISTS(SELECT 1 FROM marketing.source_items s WHERE s.phone=r.phone)
          AND COALESCE((SELECT opted_in FROM marketing.consents WHERE phone=r.phone),false)
          AND NOT EXISTS(SELECT 1 FROM marketing.suppressions WHERE phone=r.phone) AS eligible
        FROM marketing.recipients r JOIN marketing.campaigns c ON c.id=r.campaign_id
        WHERE r.status='queued' AND r.next_attempt_at<=now() AND c.state='running'
          AND EXISTS(SELECT 1 FROM marketing.sync_state WHERE id=1 AND completed_at>now()-interval '48 hours')
          AND NOT EXISTS(SELECT 1 FROM marketing.worker_health WHERE id=1 AND rate_limit_until>now())
        ORDER BY r.next_attempt_at,r.id LIMIT 1 FOR UPDATE OF r SKIP LOCKED
      ), claimed AS (
        UPDATE marketing.recipients r SET
          status=CASE WHEN c.eligible THEN 'sending' ELSE 'skipped' END,
          attempts=r.attempts+CASE WHEN c.eligible THEN 1 ELSE 0 END,
          error_code=CASE WHEN c.eligible THEN NULL ELSE 'NO_CURRENT_CONSENT' END,
          updated_at=now()
        FROM candidate c WHERE r.id=c.id RETURNING r.*
      ), skipped_event AS (
        INSERT INTO marketing.events(recipient_id,kind,code)
        SELECT id,'skipped','NO_CURRENT_CONSENT' FROM claimed WHERE status='skipped'
      ) SELECT * FROM claimed`)
      const row = claimed.rows[0]
      if (!row) break
      processed++
      if (row.status === 'skipped') continue
      // Actual request starts are spaced, even when DB latency fluctuates.
      await delay(Math.max(0, lastStarted + cfg.interval - now()))
      lastStarted = now()
      const task = sendClaimed(client, row, meta)
        .catch(error => { failure ||= error })
        .finally(() => active.delete(task))
      active.add(task)
    }
    await Promise.all(active)
    if (failure) throw failure
    return { processed }
  } finally {
    // Never unlock or release the connection while requests still use it.
    await Promise.all(active)
    if (locked) {
      await delay(Math.max(0, lastStarted + cfg.interval - now()))
      await client.query('SELECT pg_advisory_unlock(81273492)').catch(() => {})
    }
    client.release(true)
  }
}

async function sendClaimed(client, row, meta) {
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
      Boolean(e.retryable) && row.attempts < 5 && !e.ambiguous
    const state = e.ambiguous ? 'unknown' : retry ? 'queued' : 'failed'
    const backoff =
      Math.min(3600, 30 * 2 ** row.attempts) +
      Math.floor(Math.random() * 10)
    if (['130429', '429'].includes(String(e.code))) {
      await client.query(`INSERT INTO marketing.worker_health(id,rate_limit_until)
        VALUES(1,now()+interval '30 seconds') ON CONFLICT(id) DO UPDATE
        SET rate_limit_until=GREATEST(marketing.worker_health.rate_limit_until,excluded.rate_limit_until)`)
    }
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
}

// Single-attempt entry point retained for local tests and troubleshooting.
export async function workOnce(db, _erp, cfg, meta) {
  return dispatchBatch(db, cfg, meta, { maxMessages: 1 })
}

export async function runWorker(db, _erp, cfg, meta, signal) {
  while (!signal.aborted) {
    try {
      await dispatchBatch(db, cfg, meta)
    } catch {
      console.error('Marketing worker: cycle interrompu, vérifier Supabase et Meta.')
    }
    await delay(1000)
  }
}
