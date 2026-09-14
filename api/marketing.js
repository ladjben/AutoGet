import { getRuntime } from '../server/marketing/runtime.js'

// Keep the original bytes for Meta HMAC verification.
export const config = { api: { bodyParser: false } }

export function routeRequest(req) {
  const url = new URL(req.url, 'http://localhost')
  const route = url.searchParams.get('__route')
  if (route !== null) {
    if (!/^[a-zA-Z0-9/_-]*$/.test(route)) throw new Error('Invalid route')
    url.searchParams.delete('__route')
    const path =
      route === '__webhook'
        ? '/api/whatsapp/webhook'
        : '/api/marketing/' + route
    req.url = path + (url.search ? url.search : '')
    // Express parses req.url itself; Vercel's originalUrl may still be the rewrite.
    req.originalUrl = req.url
  }
}

export default function handler(req, res) {
  try {
    routeRequest(req)
    return getRuntime().app(req, res)
  } catch {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(
      JSON.stringify({
        error:
          'Marketing non configuré. Suivez docs/VERCEL_WHATSAPP_SETUP.md pour renseigner les variables serveur.',
      }),
    )
  }
}
