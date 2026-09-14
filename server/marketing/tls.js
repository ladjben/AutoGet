// pg's connection-string SSL parameters override an explicit ssl object. Strip
// them only when supplying the downloaded CA, keeping certificate checks enabled.
export function postgresOptions(connectionString, ca) {
  if (!ca) return { connectionString }
  const url = new URL(connectionString)
  if (url.searchParams.has('sslcert') || url.searchParams.has('sslkey'))
    throw new Error('Les certificats client ne sont pas pris en charge avec MARKETING_DATABASE_CA_CERT.')
  for (const key of ['sslmode', 'sslrootcert', 'sslnegotiation']) url.searchParams.delete(key)
  const certificate = ca.replaceAll('\\n', '\n').trim()
  if (!certificate.includes('-----BEGIN CERTIFICATE-----') || !certificate.includes('-----END CERTIFICATE-----'))
    throw new Error('MARKETING_DATABASE_CA_CERT doit contenir le certificat PEM complet.')
  return { connectionString: url.href, ssl: { ca: certificate, rejectUnauthorized: true } }
}
