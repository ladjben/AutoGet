export class MetaError extends Error {
  constructor(code, retryable = false, ambiguous = false, details = {}) {
    super('WhatsApp : ' + code)
    this.code = String(code)
    this.retryable = retryable
    this.ambiguous = ambiguous
    this.subcode = /^\d+$/.test(String(details.subcode || '')) ? String(details.subcode) : null
    const reference = this.code + (this.subcode ? '/' + this.subcode : '')
    const description = [details.title, details.message].filter((v) => typeof v === 'string' && v.trim()).join(' — ').slice(0, 1200)
    this.publicMessage = ambiguous
      ? `Réponse Meta non confirmée (${reference}). Actualisez la liste des modèles avant de réessayer pour vérifier si le modèle a été créé.`
      : `WhatsApp / Meta (${reference})${description ? ' : ' + description : ' : la demande n’a pas abouti. Vérifiez les informations et les autorisations du compte.'}`
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
      // Only Meta's user-facing fields may reach the UI; never expose raw errors.
      const safe = (value) => typeof value === 'string'
        ? value.replaceAll(cfg.env.WHATSAPP_ACCESS_TOKEN, '[masqué]').slice(0, 1200) : undefined
      // Retry only explicit rejections known to be rate / transient failures.
      throw new MetaError(
        code,
        res.status === 429 || [130429, 131056, 131000, 131016].includes(code),
        res.status >= 500 && !data.error,
        { subcode: data.error?.error_subcode, title: safe(data.error?.error_user_title), message: safe(data.error?.error_user_msg) },
      )
    }
    return data
  }
  return {
    async insights({ start, end, templateId }) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end-start > 31*86400)
        throw new MetaError('INVALID_PERIOD')
      async function pages(edge, params) {
        const all = [], seen = new Set()
        let after = ''
        do {
          const query = new URLSearchParams({ ...params, ...(after ? { after } : {}) })
          const page = await request(`${cfg.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/${edge}?${query}`)
          if (!Array.isArray(page.data)) throw new MetaError('INVALID_ANALYTICS_RESPONSE')
          all.push(...page.data)
          after = page.paging?.next ? page.paging?.cursors?.after : ''
          if (page.paging?.next && !after) throw new MetaError('INCOMPLETE_ANALYTICS')
          if (after && (seen.has(after) || seen.size >= 100)) throw new MetaError('INCOMPLETE_ANALYTICS')
          seen.add(after)
        } while (after)
        return all
      }
      const period = { start: String(start), end: String(end), granularity: 'DAILY' }
      const parts = await Promise.allSettled([
        request(`${cfg.env.WHATSAPP_BUSINESS_ACCOUNT_ID}?fields=currency,name`),
        pages('pricing_analytics', { ...period, metric_types: JSON.stringify(['COST','VOLUME']), dimensions: JSON.stringify(['COUNTRY','PHONE','PRICING_CATEGORY','PRICING_TYPE']) }),
        /^\d+$/.test(templateId || '') ? pages('template_analytics', { ...period, template_ids: JSON.stringify([templateId]), metric_types: JSON.stringify(['SENT','DELIVERED','READ','CLICKED','COST']) }) : Promise.reject(new MetaError('TEMPLATE_ID_MISSING')),
      ])
      const result = { start, end, fetchedAt: new Date().toISOString(), account: null, pricing: null, template: null, errors: {} }
      for (const [i,key] of ['account','pricing','template'].entries()) {
        if (parts[i].status === 'fulfilled') result[key] = parts[i].value
        else result.errors[key] = String(parts[i].reason.code || 'UNAVAILABLE')
      }
      return result
    },
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
