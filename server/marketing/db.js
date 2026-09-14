import pg from 'pg'
import { postgresOptions } from './tls.js'
import { buildAudience } from './domain.js'

export function databases(cfg) {
  // The web server deliberately has no ERP pool or ERP credentials.
  return {
    db: new pg.Pool({
      ...postgresOptions(cfg.env.MARKETING_DATABASE_URL, cfg.env.MARKETING_DATABASE_CA_CERT),
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000,
      statement_timeout: 10000,
    }),
  }
}

export async function audience(_erp, db, cfg) {
  const rows = await db.query('SELECT data FROM marketing.source_items')
  const suppressed = await db.query('SELECT phone FROM marketing.suppressions')
  const consents = await db.query('SELECT phone, opted_in FROM marketing.consents')
  return buildAudience(rows.rows.map(r => r.data), cfg.country,
    new Set(suppressed.rows.map(r => r.phone)),
    new Map(consents.rows.map(r => [r.phone, r.opted_in])))
}

// Indexed per-contact check, entirely in Supabase. Stale imports stop sending.
export async function contactEligibility(db, phone) {
  const result = await db.query(`SELECT
    EXISTS(SELECT 1 FROM marketing.sync_state WHERE id=1
      AND completed_at > now()-interval '48 hours') AS fresh,
    EXISTS(SELECT 1 FROM marketing.source_items WHERE phone=$1)
    AND COALESCE((SELECT opted_in FROM marketing.consents WHERE phone=$1), false)
    AND NOT EXISTS(SELECT 1 FROM marketing.suppressions WHERE phone=$1) AS eligible`, [phone])
  return result.rows[0]
}

export async function transaction(db, fn) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
