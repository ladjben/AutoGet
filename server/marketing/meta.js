export class MetaError extends Error {
  constructor(code, retryable = false, ambiguous = false) {
    super('WhatsApp : ' + code)
    this.code = String(code)
    this.retryable = retryable
    this.ambiguous = ambiguous
  }
}
export function metaClient(cfg, fetcher = fetch) {
  const base = `https://graph.facebook.com/${cfg.env.WHATSAPP_GRAPH_VERSION}/`
  async function request(path, body, mime) {
    let res
    try {
      res = await fetcher(base + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `${mime ? 'OAuth' : 'Bearer'} ${cfg.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': mime || 'application/json',
          ...(mime ? { file_offset: '0' } : {}),
        },
        ...(body ? { body: mime ? body : JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new MetaError('NETWORK_UNCERTAIN', false, Boolean(body))
    }
    let data
    try {
      data = await res.json()
    } catch {
      throw new MetaError('RESPONSE_UNCERTAIN', false, Boolean(body))
    }
    if (!res.ok || data.error) {
      const code = data.error?.code || res.status
      // Retry only explicit rejections known to be rate / transient failures.
      throw new MetaError(
        code,
        res.status === 429 || [130429, 131056, 131000, 131016].includes(code),
        res.status >= 500 && !data.error,
      )
    }
    return data
  }
  return {
    async templates() {
      let after = ''
      const all = []
      const seen = new Set()
      do {
        const page = await request(
          `${cfg.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,language,status,category,components,parameter_format&limit=100${after ? '&after=' + encodeURIComponent(after) : ''}`,
        )
        all.push(...(page.data || []))
        after = page.paging?.next ? page.paging?.cursors?.after : ''
        if (after && seen.has(after))
          throw new Error('Pagination Meta invalide.')
        seen.add(after)
      } while (after)
      return all
    },
    async uploadTemplateImage(bytes, mime) {
      const session = await request(`app/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(mime)}`, {})
      if (typeof session.id !== 'string' || !session.id.startsWith('upload:'))
        throw new MetaError('UPLOAD_SESSION_INVALID')
      const uploaded = await request(session.id, bytes, mime)
      if (typeof uploaded.h !== 'string' || !uploaded.h) throw new MetaError('UPLOAD_HANDLE_MISSING')
      return uploaded.h
    },
    createTemplate: (body) =>
      request(
        `${cfg.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
        body,
      ),
    send: (phone, template, recipientId) =>
      request(`${cfg.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        messaging_product: 'whatsapp',
        to: phone.slice(1),
        type: 'template',
        template,
        biz_opaque_callback_data: recipientId,
      }),
  }
}
