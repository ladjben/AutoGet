import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { buildAudience, normalizePhone } from './domain.js'

export const sourceQuery = await readFile(new URL('./erp-source.sql', import.meta.url), 'utf8')

// A full bounded snapshot reconciles cancellations, deletions and changed items,
// without assuming the ERP updates order timestamps for every child-table change.
export async function syncAudience(db, erp, {
  country = 'DZ', query = sourceQuery, maxRows = 100000,
  budgetMs = 60000, batchSize = 500, pauseMs = 100,
} = {}) {
  const target = await db.connect()
  let source
  let locked = false
  let count = 0
  const started = Date.now()
  try {
    await target.query('BEGIN')
    await target.query("SET LOCAL statement_timeout='10s'")
    await target.query("SET LOCAL lock_timeout='1s'")
    locked = (await target.query('SELECT pg_try_advisory_xact_lock(81273493) AS locked')).rows[0].locked
    if (!locked) throw Object.assign(new Error('Synchronisation déjà active.'), { code: 'SYNC_BUSY' })
    const previous = await target.query("SELECT completed_at > now()-interval '1 hour' AS recent FROM marketing.sync_state WHERE id=1")
    if (previous.rows[0]?.recent) return { skipped: true, reason: 'RECENT_SYNC' }
    source = await erp.connect()
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await source.query("SET LOCAL statement_timeout='5s'")
    await source.query("SET LOCAL lock_timeout='500ms'")
    await source.query("SET LOCAL idle_in_transaction_session_timeout='15s'")
    // Neon ERP is PostgreSQL 17: this also bounds time between FETCH calls.
    const version = await source.query('SHOW server_version_num')
    if (Number(version.rows[0].server_version_num) >= 170000)
      await source.query("SET LOCAL transaction_timeout='75s'")
    await source.query(`DECLARE marketing_export NO SCROLL CURSOR FOR ${query}`)
    // Uncommitted replacement remains invisible to API readers until COMMIT.
    await target.query('DELETE FROM marketing.source_items')
    while (true) {
      if (Date.now() - started > budgetMs) throw Object.assign(new Error('Temps de lecture dépassé.'), { code: 'SYNC_BUDGET' })
      const batch = await source.query(`FETCH FORWARD ${Math.max(1, Math.min(500, Math.floor(batchSize)))} FROM marketing_export`)
      if (!batch.rowCount) break
      count += batch.rowCount
      if (count > maxRows) throw Object.assign(new Error('Volume supérieur à la limite validée.'), { code: 'SYNC_LIMIT' })
      buildAudience(batch.rows, country) // validate before publication
      const records = batch.rows.map(data => ({
        phone: normalizePhone(data.phone, country) || normalizePhone(data.phone_fallback, country),
        // Consent belongs to the independent, documented Supabase registry.
        data: { ...data, marketing_opt_in: false },
      }))
      await target.query(`INSERT INTO marketing.source_items(phone,data)
        SELECT x->>'phone', x->'data' FROM jsonb_array_elements($1::jsonb) x`, [JSON.stringify(records)])
      await delay(pauseMs)
    }
    await source.query('COMMIT')
    await target.query(`INSERT INTO marketing.sync_state(id,completed_at,row_count,last_error)
      VALUES(1,now(),$1,NULL) ON CONFLICT(id) DO UPDATE SET
      completed_at=now(),row_count=$1,last_error=NULL`, [count])
    await target.query('COMMIT')
    return { rows: count }
  } catch (error) {
    // Record only a fixed code, never raw SQL, connection details or personal data.
    if (source) await source.query('ROLLBACK').catch(() => {})
    await target.query('ROLLBACK').catch(() => {})
    if (locked) await target.query(`INSERT INTO marketing.sync_state(id,last_error) VALUES(1,'SYNC_FAILED')
      ON CONFLICT(id) DO UPDATE SET last_error='SYNC_FAILED'`).catch(() => {})
    throw error
  } finally {
    await target.query('ROLLBACK').catch(() => {})
    source?.release(true)
    target.release(true)
  }
}
