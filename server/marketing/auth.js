import { createHmac, timingSafeEqual, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { sendingEnabled } from './sending.js'
const derive = promisify(scrypt)
const sign = (value, secret) =>
  createHmac('sha256', secret).update(value).digest('hex')
export function safeEqual(a, b) {
  const aa = Buffer.from(String(a || '')),
    bb = Buffer.from(String(b || ''))
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}
export function validSession(cookie, secret, now = Date.now()) {
  const token = String(cookie || '')
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('marketing_session='))
    ?.slice(18)
  if (!token) return false
  const [expires, signature] = token.split('.')
  return (
    /^\d+$/.test(expires) &&
    Number(expires) > now &&
    safeEqual(signature, sign(expires, secret))
  )
}
export function installAuth(app, cfg, db) {
  const cookie = (value) =>
    `marketing_session=${value}; HttpOnly; SameSite=Strict; Path=/api/marketing; Max-Age=${value ? 28800 : 0}${cfg.secure ? '; Secure' : ''}`
  app.use('/api/marketing', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (
      !['GET', 'HEAD'].includes(req.method) &&
      req.headers.origin !== cfg.origin
    )
      return res.status(403).json({ error: 'Origine non autorisée.' })
    next()
  })
  app.post(
    '/api/marketing/login',
    async (req, res, next) => {
      // One shared admin entry point: global DB limiter survives cold starts.
      const result =
        await db.query(`INSERT INTO marketing.login_limits(bucket,attempts,resets_at)
        VALUES('marketing-admin',1,now()+interval '15 minutes')
        ON CONFLICT(bucket) DO UPDATE SET
          attempts=CASE WHEN marketing.login_limits.resets_at <= now() THEN 1 ELSE marketing.login_limits.attempts+1 END,
          resets_at=CASE WHEN marketing.login_limits.resets_at <= now() THEN now()+interval '15 minutes' ELSE marketing.login_limits.resets_at END
        RETURNING attempts`)
      if (result.rows[0].attempts > 10) {
        res.set('Retry-After', '900')
        return res
          .status(429)
          .json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' })
      }
      next()
    },
    async (req, res) => {
      const password = req.body?.password
      if (typeof password !== 'string' || password.length > 512)
        return res.status(400).json({ error: 'Mot de passe invalide.' })
      const [salt, hash] = cfg.env.MARKETING_ADMIN_PASSWORD_HASH.split(':')
      const actual = await derive(password, salt, 64)
      if (!safeEqual(actual.toString('hex'), hash))
        return res.status(401).json({ error: 'Accès refusé.' })
      const expires = String(Date.now() + 8 * 3600000)
      res.setHeader(
        'Set-Cookie',
        cookie(`${expires}.${sign(expires, cfg.env.MARKETING_SESSION_SECRET)}`),
      )
      res.json({ authenticated: true })
    },
  )
  app.use('/api/marketing', (req, res, next) =>
    validSession(req.headers.cookie, cfg.env.MARKETING_SESSION_SECRET)
      ? next()
      : res.status(401).json({ error: 'Connectez-vous à l’espace marketing.' }),
  )
  app.post('/api/marketing/logout', (req, res) => {
    res.setHeader('Set-Cookie', cookie(''))
    res.json({ ok: true })
  })
  app.get('/api/marketing/session', (req, res) =>
    res.json({ authenticated: true, sendingEnabled: sendingEnabled(cfg) }),
  )
}
