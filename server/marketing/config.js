export function config(env = process.env) {
  const required = [
    'MARKETING_DATABASE_URL',
    'NEON_ERP_DATABASE_URL',
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
  if (new URL(env.MARKETING_DATABASE_URL).hostname.includes('-pooler'))
    throw new Error(
      'MARKETING_DATABASE_URL doit utiliser un accès Neon direct, sans pooler.',
    )
  const view = env.NEON_ERP_VIEW || 'autoget_marketing.delivered_items'
  if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(view))
    throw new Error('NEON_ERP_VIEW invalide.')
  const rps = Number(env.WHATSAPP_MESSAGES_PER_SECOND || 1)
  if (!Number.isFinite(rps) || rps < 0.1 || rps > 20)
    throw new Error('Débit invalide (0,1–20 messages/seconde).')
  const origin = new URL(env.MARKETING_ORIGIN).origin
  if (env.NODE_ENV === 'production' && !origin.startsWith('https:'))
    throw new Error('HTTPS obligatoire en production.')
  return {
    env,
    origin,
    view,
    interval: Math.ceil(1000 / rps),
    country: env.WHATSAPP_DEFAULT_COUNTRY || 'DZ',
    port: Number(env.MARKETING_PORT || 3001),
    secure: env.NODE_ENV === 'production',
  }
}
