import { useEffect, useState } from 'react'
import MetaInsights from './MetaInsights'
import { Button } from './ui/button'
import { Input } from './ui/input'

const names = { queued: 'En attente', sending: 'En cours', sent: 'Accepté par Meta', delivered: 'Livré', read: 'Lu', failed: 'Échec', unknown: 'À vérifier', skipped: 'Exclu' }
const num = (v) => Number(v || 0).toLocaleString('fr-FR')
const pct = (v) => v == null ? '—' : `${v.toFixed(1)} %`
const date = (v) => v ? new Date(v).toLocaleString('fr-FR') : '—'
const selectClass = 'rounded-md border bg-background p-2 text-sm'
async function request(path, body) {
  const response = await fetch(`/api/marketing${path}`, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Impossible de charger les statistiques.')
  return data
}
function Card({ label, value, help }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>{help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}</div>
}
export default function CampaignAnalytics({ campaignId, refreshKey }) {
  const [report, setReport] = useState(null), [error, setError] = useState(''), [tab, setTab] = useState('overview')
  const [page, setPage] = useState(1), [q, setQ] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    request(`/campaigns/${campaignId}/analytics?${new URLSearchParams({ page, q: search, status })}`)
      .then((data) => { if (active) setReport(data) })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [campaignId, refreshKey, revision, page, search, status])
  async function download() {
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaignId}/analytics?${new URLSearchParams({ format: 'csv', q: search, status })}`)
      if (!response.ok) throw new Error('Export indisponible.')
      const url = URL.createObjectURL(await response.blob()), a = document.createElement('a')
      a.href = url; a.download = `campagne-${campaignId}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  const s = report?.summary
  return <section className="space-y-4 rounded-xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Résultats de la campagne</h3><Button variant="outline" size="sm" disabled={loading || saving} onClick={() => setRevision((v) => v + 1)}>Actualiser les statistiques</Button></div>
    <div className="flex flex-wrap gap-2">{[['overview','Vue d’ensemble'],['costs','Chiffres Meta'],['recipients','Destinataires']].map(([id,label]) => <Button key={id} size="sm" variant={tab === id ? 'default' : 'outline'} onClick={() => setTab(id)}>{label}</Button>)}</div>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {loading && <p className="text-sm text-muted-foreground">Mise à jour…</p>}
    {s && tab === 'overview' && <>
      <p className="text-xs text-muted-foreground">Modèle : {report.template.name} · {report.template.language} · {report.template.category || 'marketing'} · Créée le {date(report.createdAt)}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Destinataires" value={num(s.total)} /><Card label="Acceptés par Meta" value={num(s.accepted)} help="Une acceptation ne confirme pas la livraison." />
        <Card label="Livrés, lus inclus" value={num(s.delivered)} help={`${pct(s.deliveryRate)} des acceptés`} /><Card label="Lus" value={num(s.read)} help={`${pct(s.readRate)} des livrés`} />
        <Card label="Échecs actuels" value={num(s.states.failed)} help={`${pct(s.failureRate)} des destinataires tentés`} /><Card label="Tentatives d’envoi" value={num(s.attempts)} help={`${num(s.retried)} destinataires avec plusieurs tentatives`} />
        <Card label="Délai moyen de livraison" value={s.deliverySeconds == null ? '—' : `${num(Math.round(s.deliverySeconds))} s`} help={`${num(s.deliverySamples)} observations`} />
        <Card label="Délai moyen avant lecture" value={s.readSeconds == null ? '—' : `${num(Math.round(s.readSeconds))} s`} help={`${num(s.readSamples)} observations après livraison`} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs">{Object.entries(names).map(([id,label]) => <span key={id} className="rounded border px-2 py-1">{label} : {num(s.states[id])}</span>)}</div>
      <p className="text-xs text-muted-foreground">Retours Meta reçus pour {num(s.observedWebhookRecipients)} destinataires. Sans retour, livraison et lecture restent inconnues. Les lectures dépendent des confirmations disponibles.</p>
      <h4 className="text-sm font-semibold">Premiers statuts par jour (UTC)</h4>
      {!s.timeline.length ? <p className="text-sm text-muted-foreground">Aucun événement daté disponible.</p> : <div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Date','Acceptés','Livrés','Lus','Échecs'].map((v) => <th key={v} className="p-2">{v}</th>)}</tr></thead><tbody>{s.timeline.map((v) => <tr key={v.day} className="border-t"><td className="p-2">{v.day}</td>{['accepted','delivered','read','failed'].map((k) => <td key={k} className="p-2 tabular-nums">{num(v[k])}<div className="mt-1 h-1 rounded bg-primary/60" style={{ width: `${Math.max(0, v[k] / Math.max(1, v.accepted, v.delivered, v.read, v.failed) * 100)}%` }} /></td>)}</tr>)}</tbody></table></div>}
      <p className="text-xs text-muted-foreground">Pour les anciens événements, la date de réception est utilisée si la date Meta manque.</p>
      <div className="grid gap-4 sm:grid-cols-2"><div><h4 className="mb-2 text-sm font-semibold">Pays des destinataires</h4>{s.countries.map((c) => <p className="text-xs py-1" key={c.country}>{c.country} : {num(c.total)} contacts · {num(c.delivered)} livrés · {num(c.read)} lus · {num(c.failed)} échecs</p>)}</div><div><h4 className="mb-2 text-sm font-semibold">Codes d’erreur actuels</h4>{s.errors.length ? s.errors.map((e) => <p className="text-xs py-1" key={e.code}>{e.code} : {num(e.count)}</p>) : <p className="text-xs text-muted-foreground">Aucune erreur enregistrée.</p>}</div></div>
      <p className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">Clics sur les liens, commandes attribuées, chiffre d’affaires et rentabilité : non mesurés actuellement. Ils ne sont pas comptés comme zéro.</p>
      <details className="text-xs"><summary>Audience enregistrée</summary><pre className="overflow-auto whitespace-pre-wrap p-2">{JSON.stringify(report.filters, null, 2)}</pre></details>
    </>}
    {tab === 'costs' && <MetaInsights campaignId={campaignId} />}
    {s && tab === 'recipients' && <>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q) }}><Input className="w-56" aria-label="Rechercher un destinataire" placeholder="Nom, téléphone ou erreur" value={q} onChange={(e) => setQ(e.target.value)} /><select aria-label="Statut du destinataire" className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">Tous les statuts</option>{Object.entries(names).map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select><Button size="sm">Rechercher</Button><Button type="button" variant="outline" size="sm" disabled={saving} onClick={download}>Exporter les résultats (CSV)</Button></form>
      <p className="text-xs">{num(report.filteredTotal)} destinataires · Dates affichées dans votre fuseau horaire</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Destinataire','Statut / tentatives','Accepté / envoyé / livré / lu','Facturation','Détails Meta'].map((v) => <th key={v} className="p-2">{v}</th>)}</tr></thead><tbody>{report.recipients.map((r) => <tr className="border-t align-top" key={r.id}><td className="p-2">{r.customer_name}<br />{r.phone}<br />{r.country}</td><td className="p-2">{names[r.status]}<br />{r.attempts} tentative(s){r.error_code && <p className="text-red-500">{r.error_code}</p>}</td><td className="p-2 whitespace-nowrap">{date(r.accepted_at)}<br />{date(r.sent_at)}<br />{date(r.delivered_at)}<br />{date(r.read_at)}</td><td className="p-2">{'Voir les chiffres agrégés Meta'}<br /><span className="text-muted-foreground">{r.billable === false ? 'Gratuit selon Meta' : r.billable === true ? 'Facturable selon Meta' : 'Facturation non confirmée'}</span></td><td className="p-2 max-w-48 break-all">{r.message_id || '—'}<br />{r.pricing?.category} {r.pricing?.pricing_model}<br />{r.pricing?.type}</td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between"><Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(page-1)}>Précédent</Button><span className="text-xs">Page {page}</span><Button size="sm" variant="outline" disabled={loading || page*50 >= report.filteredTotal} onClick={() => setPage(page+1)}>Suivant</Button></div>
    </>}
  </section>
}
