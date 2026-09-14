import { templateFields } from './domain.js'
const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }) }
export async function createMarketingTemplate(input, meta) {
  const { name, language, body, examples = [], image, buttonText = '', buttonUrl = '' } = input
  if (!/^[a-z][a-z0-9_]{0,511}$/.test(name || '') ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language || '') ||
      typeof body !== 'string' || !body.trim() || body.length > 1024)
    fail('Nom, langue ou texte du modèle invalide.')
  const components = [{ type: 'BODY', text: body }]
  let fields
  try { fields = templateFields({ components }) } catch (e) { fail(e.message) }
  if (!Array.isArray(examples) || examples.length !== fields.length ||
      examples.some((v) => typeof v !== 'string' || !v.trim() || v.length > 200))
    fail('Renseignez un exemple pour chaque variable {{1}}, {{2}}…')
  if (fields.length) components[0].example = { body_text: [examples] }
  if (buttonText || buttonUrl) {
    if (typeof buttonText !== 'string' || !buttonText.trim() || buttonText.length > 25 ||
        typeof buttonUrl !== 'string' || buttonUrl.length > 2000 || /[{}\s]/.test(buttonUrl))
      fail('Renseignez le texte du bouton (25 caractères maximum) et son lien HTTPS fixe.')
    let url
    try { url = new URL(buttonUrl) } catch { fail('Lien du bouton invalide.') }
    if (url.protocol !== 'https:' || url.username || url.password) fail('Le bouton nécessite un lien HTTPS sans identifiants.')
    components.push({ type: 'BUTTONS', buttons: [{ type: 'URL', text: buttonText.trim(), url: buttonUrl }] })
  }
  let bytes
  if (image) {
    if (!['image/png', 'image/jpeg'].includes(image.type) || typeof image.data !== 'string' ||
        image.data.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))
      fail('Choisissez une image JPEG ou PNG de 1 Mo maximum.')
    bytes = Buffer.from(image.data, 'base64')
    const valid = image.type === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    if (!valid || bytes.length > 1024 * 1024) fail('Image invalide ou supérieure à 1 Mo.')
  }
  // Complete validation before any upload or template creation at Meta.
  if (bytes) {
    const handle = await meta.uploadTemplateImage(bytes, image.type)
    components.unshift({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [handle] } })
  }
  return meta.createTemplate({ name, language, category: 'MARKETING',
    parameter_format: 'POSITIONAL', components })
}
