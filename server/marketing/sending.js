export function sendingEnabled(cfg) {
  return (
    cfg.env.WHATSAPP_SENDING_ENABLED === 'true' &&
    (!cfg.env.VERCEL || cfg.env.VERCEL_ENV === 'production')
  )
}
