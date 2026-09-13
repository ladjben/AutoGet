export function config(env = process.env) {
  const required = [
    'MARKETING_DATABASE_URL',
    'MARKETING_ADMIN_PASSWORD_HASH',
    'MARKETING_SESSION_SECRET',
    'MARKETING_ORIGIN',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    'WHATSAPP_GRAPH_VERSION',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_VERIFY_TOKEN',
  ]
  for (const key of required)
    if (!env[key]) throw new Error(`Configuration manquante : ${key}`)
  if (env.MARKETING_SESSION_SECRET.length < 32)
    throw new Error(
      'MARKETING_SESSION_SECRET doit contenir au moins 32 caractères.',
    )
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.MARKETING_ADMIN_PASSWORD_HASH))
    throw new Error('Hash administrateur invalide.')
  if (!/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION))
    throw new Error('Version Graph invalide.')
  validateMarketingConnection(env.MARKETING_DATABASE_URL)
  const rps = Number(env.WHATSAPP_MESSAGES_PER_SECOND || 1)
  if (!Number.isFinite(rps) || rps < 0.1 || rps > 20)
    throw new Error('Débit invalide (0,1–20 messages/seconde).')
  const origin = new URL(env.MARKETING_ORIGIN).origin
  if (env.NODE_ENV === 'production' && !origin.startsWith('https:'))
    throw new Error('HTTPS obligatoire en production.')
  return {
    env,
    origin,
    interval: Math.ceil(1000 / rps),
    concurrency: 20,
    country: env.WHATSAPP_DEFAULT_COUNTRY || 'DZ',
    port: Number(env.MARKETING_PORT || 3001),
    secure: env.NODE_ENV === 'production',
  }
}

// Worker coordination uses session locks: transaction pooling is incompatible.
export function validateMarketingConnection(value) {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Une connexion PostgreSQL serveur est nécessaire.')
  if (url.port === '6543' || url.hostname.includes('-pooler'))
    throw new Error('Utiliser Supabase Session pooler port 5432 ou une connexion directe ; pas le mode Transaction.')
}
