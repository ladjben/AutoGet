import pg from 'pg'
import { buildAudience } from './domain.js'

export function databases(cfg) {
  // Use Neon URLs with sslmode=verify-full; never disable certificate verification.
  const common = {
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000,
    statement_timeout: 10000,
  }
  return {
    db: new pg.Pool({
      ...common,
      connectionString: cfg.env.MARKETING_DATABASE_URL,
    }),
    erp: new pg.Pool({
      ...common,
      connectionString: cfg.env.NEON_ERP_DATABASE_URL,
    }),
  }
}

export async function audience(erp, db, cfg) {
  const rows = await erp.query(
    `SELECT order_id, ordered_at, status, phone, customer_name, product_id, product_name, variant, size, city, marketing_opt_in, to_jsonb(src)->>'phone_fallback' AS phone_fallback, to_jsonb(src)->>'item_id' AS item_id, to_jsonb(src)->>'item_source' AS item_source, to_jsonb(src)->>'quantity' AS quantity FROM ${cfg.view} src WHERE lower(trim(status)) IN ('delivered','livré','livre') LIMIT 100001`,
  )
  if (rows.rowCount > 100000)
    throw Object.assign(
      new Error(
        'Source ERP > 100 000 lignes : une synchronisation paginée doit être configurée avant utilisation.',
      ),
      { status: 503 },
    )
  const suppressed = await db.query('SELECT phone FROM marketing.suppressions')
  const consents = await db.query(
    'SELECT phone, opted_in FROM marketing.consents',
  )
  return buildAudience(
    rows.rows,
    cfg.country,
    new Set(suppressed.rows.map((r) => r.phone)),
    new Map(consents.rows.map((r) => [r.phone, r.opted_in])),
  )
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
