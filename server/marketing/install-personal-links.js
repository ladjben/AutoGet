// Explicit, one-off installation using the application's existing server connection.
// Never log credentials, customer records, or raw database errors.
import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { postgresOptions } from './tls.js'

if (process.env.COSMOS_INSTALL_PERSONAL_LINKS === '1') {
 const client = new pg.Client({
  ...postgresOptions(process.env.MARKETING_DATABASE_URL,process.env.MARKETING_DATABASE_CA_CERT),
  connectionTimeoutMillis:10000,statement_timeout:15000,
 })
 try {
  await client.connect()
  const check=await client.query(`SELECT to_regclass('marketing.personal_links') IS NOT NULL AS installed,
    has_schema_privilege(current_user,'marketing','CREATE') AS can_install`)
  if(check.rows[0].installed) console.log('COSMOS_LINK_TABLE_ALREADY_INSTALLED')
  else if(!check.rows[0].can_install) console.log('COSMOS_LINK_TABLE_REQUIRES_DATABASE_ADMIN')
  else {
   const sql=await readFile(new URL('../../sql/whatsapp-personal-links.sql',import.meta.url),'utf8')
   await client.query(sql)
   console.log('COSMOS_LINK_TABLE_INSTALLED')
  }
 } catch(error) {
  try{await client.query('ROLLBACK')}catch{ /* Connection may already be closed. */ }
  console.log('COSMOS_LINK_TABLE_INSTALL_FAILED', /^[A-Z0-9]{5}$/.test(error.code||'') ? error.code : 'CONNECTION_OR_CONFIG')
 } finally {await client.end()}
}
