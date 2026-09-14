import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
const day = (date) => date.toISOString().slice(0,10)
const points = (groups) => groups?.flatMap((g) => Array.isArray(g.data_points) ? g.data_points : [g]) || []
const number = (n) => typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 6 }) : 'Non disponible'
const sum = (rows, key) => rows.length && rows.every((r) => typeof r[key] === 'number') ? rows.reduce((n,r) => n+r[key],0) : null
const labels = { cost: 'Coûts', volume: 'Messages', sent: 'Envoyés', delivered: 'Livrés', read: 'Lus', clicked: 'Clics', type: 'Indicateur', value: 'Valeur', count: 'Nombre', button_content: 'Bouton', amount_spent: 'Montant dépensé', cost_per_delivered: 'Coût par message livré', cost_per_url_button_click: 'Coût par clic sur le lien', country: 'Pays', phone_number: 'Numéro', pricing_category: 'Catégorie', pricing_type: 'Facturation', template_id: 'Identifiant du modèle', start: 'Début', end: 'Fin', data_points: 'Détail par période', granularity: 'Périodicité' }
function Values({ value }) {
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((v,i) => <div className="border-b py-2" key={i}><Values value={v} /></div>)}</div>
  if (value && typeof value === 'object') return <dl className="space-y-1">{Object.entries(value).map(([k,v]) => <div className="grid grid-cols-2 gap-2" key={k}><dt className="text-muted-foreground">{labels[k] || k}</dt><dd>{['start','end'].includes(k) && typeof v === 'number' ? new Date(v*1000).toLocaleString('fr-FR', { timeZone: 'UTC' }) : <Values value={v} />}</dd></div>)}</dl>
  return <span>{typeof value === 'number' ? number(value) : labels[value] || String(value ?? 'Non disponible')}</span>
}
export default function MetaInsights({ campaignId }) {
  const [from,setFrom] = useState(() => day(new Date(Date.now()-6*86400000)))
  const [to,setTo] = useState(() => day(new Date()))
  const [period,setPeriod] = useState(null), [data,setData] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const start = period?.start ?? Math.floor(new Date(day(new Date(Date.now()-6*86400000))).getTime()/1000)
    const end = period?.end ?? Math.floor(new Date(day(new Date())).getTime()/1000)+86400
    setBusy(true); setError(''); setData(null)
    fetch(`/api/marketing/campaigns/${campaignId}/meta-insights?${new URLSearchParams({start,end})}`)
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Lecture Meta indisponible.'); return body })
      .then((body) => { if (active) setData(body) }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [campaignId,period])
  const pricing = points(data?.pricing), template = points(data?.template)
  const currency = data?.account?.currency
  const cost = sum(pricing,'cost'), volume = sum(pricing,'volume')
  const money = (v) => v == null || !currency ? 'Non disponible' : `${number(v)} ${currency}`
  return <div className="space-y-4">
    <h4 className="font-semibold">Chiffres du Gestionnaire WhatsApp</h4>
    <p className="text-sm text-muted-foreground">Récupération directe depuis Meta à l’ouverture de cet onglet. Aucun tarif à saisir. Les données peuvent arriver avec un délai et les coûts Meta restent provisoires jusqu’à facturation.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const start = Date.parse(from)/1000, end = Date.parse(to)/1000+86400; if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end-start > 31*86400) { setError('Choisis une période de 31 jours maximum.'); return } setPeriod({ start,end }) }}>
      <label className="text-xs">Du (UTC)<Input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs">Au (UTC, inclus)<Input type="date" required value={to} max={day(new Date())} onChange={(e) => setTo(e.target.value)} /></label><Button disabled={busy}>Actualiser depuis Meta</Button>
    </form>
    {busy && <p className="text-sm">Lecture des statistiques Meta…</p>}{error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {data && <>
      <p className="text-xs text-muted-foreground">Dernière récupération : {new Date(data.fetchedAt).toLocaleString('fr-FR')} · Compte : {data.account?.name || 'WhatsApp Business'} · Devise Meta : {currency || 'inconnue'}</p>
      {currency && currency !== 'EUR' && <p className="text-sm">Meta renvoie des montants en {currency}. Ils sont conservés dans cette devise, sans conversion en euros inventée.</p>}
      {Object.entries(data.errors).map(([key,code]) => <p role="alert" key={key} className="rounded border border-amber-500/40 p-3 text-sm">{({account:'Compte',pricing:'Coûts',template:'Modèle'})[key]} indisponible — code Meta {code}. {['10','200','190'].includes(code) ? 'Vérifier les autorisations du compte ou la validité du token.' : 'Le compte ou ce modèle peut ne pas exposer ces statistiques.'}</p>)}
      <h4 className="font-semibold text-sm">Coûts de tout le compte sur la période</h4>
      <p className="text-xs text-muted-foreground">Tous les numéros et envois du compte sont inclus. Ce total n’est pas le coût individuel de cette campagne.</p>
      <div className="grid grid-cols-3 gap-3">{[['Coût Meta',money(cost)],['Messages (volume Meta)',number(volume)],['Coût moyen / message',money(volume > 0 && cost != null ? cost/volume : null)]].map(([label,value]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}</div>
      <h4 className="font-semibold text-sm">Modèle « {data.templateName} » sur la période</h4>
      <p className="text-xs text-muted-foreground">Ces chiffres peuvent inclure d’autres campagnes utilisant le même modèle. Meta ne fournit pas ici d’identifiant de campagne AutoGet pour les séparer.</p>
      <div className="grid grid-cols-3 gap-3">{[['sent','Envoyés'],['delivered','Livrés'],['read','Lus']].map(([key,label]) => <div key={key} className="rounded-lg border p-3"><p className="text-xs">{label}</p><p className="mt-2 font-semibold">{number(sum(template,key))}</p></div>)}</div>
      <h4 className="font-semibold text-sm">Détail quotidien du modèle : coûts et clics renvoyés par Meta</h4>
      {!template.length ? <p className="text-sm text-muted-foreground">Aucune donnée disponible pour cette période.</p> : template.map((r,i) => <details key={i} className="rounded border p-3 text-xs"><summary>{r.start ? day(new Date(r.start*1000)) : 'Période'} · {number(r.sent)} envoyés · {number(r.delivered)} livrés · {number(r.read)} lus</summary><div className="mt-3"><Values value={r} /></div></details>)}
      <details className="rounded border p-3 text-xs"><summary>Répartition Meta par pays, numéro, catégorie et facturation</summary><div className="max-h-96 overflow-auto mt-3"><Values value={data.pricing} /></div></details>
    </>}
  </div>
}
