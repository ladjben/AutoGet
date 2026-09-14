import { randomBytes, scryptSync } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

// Run locally from Cursor. Never prints secrets into shell logs or overwrites a file.
const password = randomBytes(24).toString('base64url')
const salt = randomBytes(16).toString('hex')
const hash = scryptSync(password, salt, 64).toString('hex')
await writeFile(
  '.env.marketing.local',
  [
    '# Private local file, ignored by Git. Keep in your password manager.',
    '# ADMIN_PASSWORD_LOCAL_ONLY is the password to enter in the marketing page.',
    '# Do not add ADMIN_PASSWORD_LOCAL_ONLY to Vercel.',
    `ADMIN_PASSWORD_LOCAL_ONLY=${password}`,
    `MARKETING_ADMIN_PASSWORD_HASH=${salt}:${hash}`,
    `MARKETING_SESSION_SECRET=${randomBytes(32).toString('hex')}`,
    `CRON_SECRET=${randomBytes(32).toString('hex')}`,
    `WHATSAPP_VERIFY_TOKEN=${randomBytes(32).toString('hex')}`,
    '',
  ].join('\n'),
  { flag: 'wx', mode: 0o600 },
)
console.log(
  'Ouvrez .env.marketing.local dans Cursor. Les secrets sont dans ce fichier privé, ignoré par Git. Le mot de passe sert à ouvrir l’espace marketing.',
)
