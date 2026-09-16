import pg from 'pg'
import { postgresOptions } from './tls.js'
import { validateMarketingConnection } from './config.js'
import { syncAudience } from './sync.js'

let db, erp
try {
  if (process.env.MARKETING_SYNC_ENABLED !== 'true') throw new Error('SYNC_DISABLED')
  validateMarketingConnection(process.env.MARKETING_DATABASE_URL)
  const sourceUrl = new URL(process.env.NEON_ERP_DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(sourceUrl.protocol)) throw new Error('INVALID_SOURCE')
  // Keep ERP credentials exclusively in this import process, never on Vercel.
  const common = { max: 1, connectionTimeoutMillis: 5000, idleTimeoutMillis: 1000 }
  db = new pg.Pool({ ...common, ...postgresOptions(process.env.MARKETING_DATABASE_URL, process.env.MARKETING_DATABASE_CA_CERT) })
  erp = new pg.Pool({ ...common, connectionString: sourceUrl.href,
    application_name: 'autoget_marketing_readonly_sync' })
  console.log(JSON.stringify(await syncAudience(db, erp, {
    country: process.env.WHATSAPP_DEFAULT_COUNTRY || 'DZ',
  })))
} catch (error) {
  const code = ['SYNC_BUDGET','SYNC_LIMIT','SYNC_BUSY','57014','25P04','55P03','ECONNREFUSED','ETIMEDOUT'].includes(error.code) ? error.code : 'SYNC_FAILED'
  console.error('Code de synchronisation : ' + code)
  console.error('Synchronisation interrompue. Vérifier activation, droits, connexions et limites. La copie précédente est conservée si l’import a échoué avant publication.')
  process.exitCode = 1
} finally {
  await Promise.all([db?.end(), erp?.end()])
}
