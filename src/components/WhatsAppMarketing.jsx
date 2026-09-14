import { useEffect, useState } from 'react'
import {
  MessageCircle,
  Users,
  Send,
  CheckCheck,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pause,
  LockKeyhole,
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'

const initialFilters = {
  q: '',
  status: '',
  product: '',
  variant: '',
  size: '',
  city: '',
  from: '',
  to: '',
  minOrders: '',
  maxOrders: '',
  eligibleOnly: false,
}
const orderLabels = {
  delivered: 'Livrée', cancelled: 'Annulée', returned: 'Retournée',
  pending: 'En attente', processing: 'En traitement', unconfirmed: 'Non confirmée',
  confirmed: 'Confirmée', deliviring: 'En livraison', delivering: 'En livraison',
  dispaching: 'En expédition', dispatching: 'En expédition', packing: 'En préparation',
  returning: 'En retour', orphaned: 'Orpheline', relaunched: 'Relancée',
  exchange: 'Échange', unknown: 'Non renseigné',
}
const labels = {
  queued: 'En attente',
  sending: 'En cours',
  sent: 'Accepté par Meta',
  delivered: 'Livré',
  read: 'Lu',
  failed: 'Échec',
  unknown: 'À vérifier',
  skipped: 'Exclu',
  draft: 'Brouillon',
  running: 'Active',
  paused: 'En pause',
}
async function api(path, body) {
  const r = await fetch('/api/marketing' + path, {
    credentials: 'same-origin',
    ...(body !== undefined
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok)
    throw Object.assign(
      new Error(data.error || 'Le serveur marketing est indisponible.'),
      { status: r.status },
    )
  return data
}
function Field({ label, children }) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}
function Select({ children, ...props }) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      {...props}
    >
      {children}
    </select>
  )
}
function Pill({ children, good = false }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${good ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
    >
      {children}
    </span>
  )
}
function Bubble({ template, payload }) {
  const imageLink = payload?.components?.find((c) => c.type === 'header')
    ?.parameters?.find((p) => p.type === 'image')?.image?.link
  const hasImage = template?.components?.some((c) => c.type === 'HEADER' && c.format === 'IMAGE')
  const buttons = template?.components?.find((c) => c.type === 'BUTTONS')?.buttons || []
  const text = (template?.components || [])
    .filter((c) => c.text)
    .map((c) => {
      const params =
        payload?.components?.find((p) => p.type === c.type.toLowerCase())
          ?.parameters || []
      return c.text.replace(
        /\{\{(\w+)\}\}/g,
        (original, key) =>
          params.find((p) => p.parameter_name === key)?.text ||
          params[Number(key) - 1]?.text ||
          original,
      )
    })
    .join('\n\n')
  return (
    <div className="rounded-2xl bg-emerald-950/5 p-5 dark:bg-emerald-400/5">
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <MessageCircle className="h-4 w-4" /> Aperçu WhatsApp
      </div>
      <div className="ml-3 rounded-xl rounded-tr-none border border-emerald-500/15 bg-background p-4 shadow-sm">
        {hasImage && (imageLink?.startsWith('https://') ? (
          <img key={imageLink} src={imageLink} alt="Image du message" referrerPolicy="no-referrer"
            className="mb-4 max-h-72 w-full rounded-lg object-contain" />
        ) : <div className="mb-4 rounded-lg bg-muted p-8 text-center text-sm text-muted-foreground">Ajoutez le lien de votre image</div>)}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {text || 'Votre message apparaîtra ici.'}
        </p>
        {buttons.map((button, index) => {
          const suffix = payload?.components?.find((c) => c.type === 'button' && String(c.index) === String(index))?.parameters?.[0]?.text
          const link = button.url?.replace('{{1}}', suffix || '{{1}}')
          return <div key={index} className="mt-3 border-t pt-3 text-center">
            <p className="text-sm font-medium text-sky-600">{button.text}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{link || button.phone_number}</p>
          </div>
        })}
        <div className="mt-3 flex justify-end gap-1 text-[10px] text-muted-foreground">
          12:00 <CheckCheck className="h-3 w-3 text-sky-500" />
        </div>
      </div>
    </div>
  )
}

export default function WhatsAppMarketing() {
  const [service, setService] = useState(null)
  const [auth, setAuth] = useState(null),
    [password, setPassword] = useState('')
  const [tab, setTab] = useState('audience'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState(initialFilters),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0)
  const [audience, setAudience] = useState(null),
    [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState({ mode: 'explicit', phones: [] })
  const [templates, setTemplates] = useState([]),
    [templateId, setTemplateId] = useState(''),
    [bindings, setBindings] = useState({})
  const [name, setName] = useState(''),
    [campaigns, setCampaigns] = useState([]),
    [detail, setDetail] = useState(null),
    [detailPage, setDetailPage] = useState(1)
  const [creator, setCreator] = useState(false),
    [newTemplate, setNewTemplate] = useState({
      name: '',
      language: 'fr',
      body: '',
      examples: '', image: null, buttonText: '', buttonUrl: '',
    })
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const template = templates.find((t) => t.id === templateId)
  const selectedCount =
    selection.mode === 'all'
      ? Math.max(0, (audience?.eligible || 0) - selection.phones.length)
      : selection.phones.length
  const changeFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
    setSelection({ mode: 'explicit', phones: [] })
    setRequestKey(crypto.randomUUID())
  }
  const toggle = (phone) => {
    setSelection((s) => ({
      ...s,
      phones: s.phones.includes(phone)
        ? s.phones.filter((p) => p !== phone)
        : [...s.phones, phone],
    }))
    setRequestKey(crypto.randomUUID())
  }
  const checked = (phone) =>
    selection.mode === 'all'
      ? !selection.phones.includes(phone)
      : selection.phones.includes(phone)
  async function perform(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
      if (e.status === 401) setAuth(false)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    api('/session')
      .then(() => setAuth(true))
      .catch((e) => {
        setAuth(false)
        if (e.status !== 401) setError(e.message)
      })
  }, [])
  useEffect(() => {
    if (!auth) return
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      api('/audience?' + new URLSearchParams({ ...filters, page }))
        .then((data) => {
          if (alive) setAudience(data)
        })
        .catch((e) => {
          if (alive) {
            setAudience(null)
            setError(e.message)
            if (e.status === 401) setAuth(false)
          }
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [auth, filters, page, refresh])
  useEffect(() => {
    if (!auth) return
    let alive = true
    api('/templates')
      .then((data) => {
        if (alive) setTemplates(data)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    api('/status')
      .then((data) => {
        if (alive) setService(data)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    const load = () =>
      api('/campaigns')
        .then((data) => {
          if (alive) setCampaigns(data)
        })
        .catch((e) => {
          if (alive) setError(e.message)
        })
    load()
    const timer = setInterval(load, 10000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [auth, refresh])
  const openDetail = async (id, n = 1) => {
    setDetail(await api(`/campaigns/${id}?page=${n}`))
    setDetailPage(n)
  }
  const previewCustomer = audience?.customers.find(
    (c) => c.eligible && checked(c.phone),
  )
  const previewValues = previewCustomer
    ? {
        name: previewCustomer.name,
        phone: previewCustomer.phone,
        city: previewCustomer.city,
        orderCount: String(previewCustomer.orderCount),
        products: [
          ...new Set(previewCustomer.purchases.map((p) => p.product)),
        ].join(', '),
        sizes: [
          ...new Set(
            previewCustomer.purchases.map((p) => p.size).filter(Boolean),
          ),
        ].join(', '),
      }
    : {}
  const previewPayload = {
    components: ['HEADER', 'BODY'].map((type) => ({
      type: type.toLowerCase(),
      parameters: (template?.fields || [])
        .filter((f) => f.component === type)
        .map((f) => f.kind === 'image' ? {
          type: 'image', image: { link: bindings[f.key]?.value || '' },
        } : ({
          parameter_name: f.token,
          text:
            bindings[f.key]?.source === 'literal'
              ? bindings[f.key]?.value
              : previewValues[bindings[f.key]?.source],
        })),
    })).concat((template?.fields || []).filter((f) => f.component === 'BUTTON').map((f) => ({
      type: 'button', sub_type: 'url', index: String(f.index),
      parameters: [{ type: 'text', text: bindings[f.key]?.source === 'literal'
        ? bindings[f.key]?.value : previewValues[bindings[f.key]?.source] }],
    }))),
  }
  const errorBox = error && (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {error}
    </div>
  )
  if (auth === null)
    return (
      <p className="p-8 text-muted-foreground">
        Ouverture de l’espace marketing…
      </p>
    )
  if (!auth)
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <LockKeyhole className="mb-5 h-9 w-9 text-primary" />
        <h1 className="text-2xl font-semibold">Votre espace marketing</h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          Connectez-vous avec l’accès marketing configuré par votre
          administrateur.
        </p>
        {errorBox}
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            perform(async () => {
              await api('/login', { password })
              setPassword('')
              setAuth(true)
            })
          }}
        >
          <Field label="Mot de passe marketing">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button disabled={busy} className="w-full">
            {busy ? 'Connexion…' : 'Ouvrir mon espace'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    )
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="h-4 w-4" /> Cosmos · Marketing
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Le bon message. Aux bons clients.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Retrouvez vos clients, tous statuts confondus, composez une audience et donnez une
              nouvelle vie à chaque achat.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              perform(async () => {
                await api('/logout', {})
                setAuth(false)
              })
            }
          >
            Verrouiller
          </Button>
        </div>
      </header>
      {!detail && !creator && errorBox}
      {service && (
        <div
          className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {!service.sendingEnabled
            ? 'Les envois réels sont désactivés. Vous pouvez préparer vos campagnes.'
            : 'Les envois réels sont activés.'}
          <div className="mt-2">
            {service.sync?.completed_at
              ? `Clients synchronisés le ${new Date(service.sync.completed_at).toLocaleString('fr-FR')} (${service.sync.row_count} articles).`
              : 'Première synchronisation des clients à effectuer.'}
            {!service.sync?.fresh && <span className="ml-2 text-destructive">Envois suspendus jusqu’à une synchronisation récente.</span>}
            {service.sync?.last_error && <span className="ml-2 text-destructive">Dernier import interrompu ; la copie précédente est conservée.</span>}
          </div>
          {service.serverless && (
            <span className="ml-2">
              {service.worker?.last_finished_at
                ? `Dernier passage automatique : ${new Date(service.worker.last_finished_at).toLocaleString('fr-FR')}.`
                : 'L’envoi automatique attend sa configuration dans GitHub.'}
            </span>
          )}
          {service.worker?.rate_limit_until && new Date(service.worker.rate_limit_until) > new Date() && (
            <span className="ml-2">Pause temporaire demandée par Meta ; reprise lors d’un prochain passage automatique.</span>
          )}
          {service.worker?.last_error && (
            <span className="ml-2 text-destructive">
              Le dernier passage a échoué : consultez le workflow GitHub.
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [Users, audience?.total ?? '—', 'Clients dans le segment'],
          [ShieldCheck, audience?.eligible ?? '—', 'Contacts éligibles'],
          [Send, selectedCount, 'Contacts sélectionnés'],
          [
            CheckCheck,
            campaigns.reduce((n, c) => n + c.delivered + c.read, 0),
            'Messages livrés / lus',
          ],
        ].map(([icon, value, label]) => {
          const Icon = icon
          return (
            <div key={label} className="rounded-xl border bg-card p-4">
              <Icon className="mb-3 h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-1">
          {[
            ['audience', '01 · Audience'],
            ['compose', '02 · Message'],
            ['campaigns', 'Campagnes'],
            ['templates', 'Modèles'],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant={tab === id ? 'secondary' : 'ghost'}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || loading}
          onClick={() => {
            setError('')
            setRefresh((v) => v + 1)
          }}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          Actualiser
        </Button>
      </div>
      {tab === 'audience' && (
        <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
          <aside className="h-fit space-y-4 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Affiner l’audience</h2>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setFilters(initialFilters)
                  setSelection({ mode: 'explicit', phones: [] })
                  setPage(1)
                  setRequestKey(crypto.randomUUID())
                }}
              >
                Effacer
              </button>
            </div>
            <Field label="Nom ou téléphone">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={filters.q}
                  onChange={(e) => changeFilter('q', e.target.value)}
                  placeholder="Rechercher un client"
                />
              </div>
            </Field>
            {[
              ['status', 'Statut de la commande', audience?.facets.statuses?.map((id) => ({ id, name: orderLabels[id] ? `${orderLabels[id]} (${id})` : id }))],
              ['product', 'Produit', audience?.facets.products],
              ['size', 'Pointure', audience?.facets.sizes],
              ['variant', 'Variante', audience?.facets.variants],
              ['city', 'Ville', audience?.facets.cities],
            ].map(([key, label, options]) => (
              <Field key={key} label={label}>
                <Select
                  value={filters[key]}
                  onChange={(e) => changeFilter(key, e.target.value)}
                >
                  <option value="">Tous</option>
                  {options?.map((o) => (
                    <option key={o.id || o} value={o.id || o}>
                      {o.name || o}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
            <Field label="Achat à partir du (UTC)">
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => changeFilter('from', e.target.value)}
              />
            </Field>
            <Field label="Jusqu’au (UTC)">
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => changeFilter('to', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['minOrders', 'Commandes min.'],
                ['maxOrders', 'Max.'],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    min="1"
                    type="number"
                    value={filters[key]}
                    onChange={(e) => changeFilter(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.eligibleOnly}
                onChange={(e) => changeFilter('eligibleOnly', e.target.checked)}
              />
              Éligibles uniquement
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Les filtres statut, produit, pointure et période portent sur le même
              achat. Le nombre de commandes couvre tout l’historique livré.
            </p>
          </aside>
          <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-semibold">Vos clients, réunis</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Un contact par téléphone · Historique conservé
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!audience || loading}
                onClick={() => {
                  setSelection({ mode: 'all', phones: [] })
                  setRequestKey(crypto.randomUUID())
                }}
              >
                Sélectionner les {audience?.eligible || 0} éligibles
              </Button>
            </div>
            {loading ? (
              <p className="p-8 text-sm text-muted-foreground">
                Recherche dans les commandes livrées…
              </p>
            ) : !audience?.customers.length ? (
              <div className="p-12 text-center">
                <Users className="mx-auto mb-4 h-9 w-9 text-muted-foreground" />
                <h3 className="font-medium">Aucun client à afficher</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ajustez les filtres ou vérifiez le raccordement à l’ERP.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-4">
                        <input
                          aria-label="Sélectionner les éligibles de cette page"
                          type="checkbox"
                          checked={
                            audience.customers.some((c) => c.eligible) &&
                            audience.customers
                              .filter((c) => c.eligible)
                              .every((c) => checked(c.phone))
                          }
                          onChange={(e) => {
                            const phones = audience.customers
                              .filter((c) => c.eligible)
                              .map((c) => c.phone)
                            const on = e.target.checked
                            setSelection((s) => ({
                              ...s,
                              phones:
                                s.mode === 'all'
                                  ? on
                                    ? s.phones.filter(
                                        (p) => !phones.includes(p),
                                      )
                                    : [...new Set([...s.phones, ...phones])]
                                  : on
                                    ? [...new Set([...s.phones, ...phones])]
                                    : s.phones.filter(
                                        (p) => !phones.includes(p),
                                      ),
                            }))
                            setRequestKey(crypto.randomUUID())
                          }}
                        />
                      </th>
                      <th className="py-3">Client</th>
                      <th className="py-3">Commandes & pointures</th>
                      <th className="p-3">Commandes</th>
                      <th className="p-3">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audience.customers.map((c) => (
                      <tr
                        key={c.phone}
                        className={`border-t transition-colors hover:bg-muted/30 ${c.eligible && checked(c.phone) ? 'bg-primary/5' : ''}`}
                      >
                        <td className="p-4 align-top">
                          <input
                            aria-label={`Sélectionner ${c.name || c.phone}`}
                            type="checkbox"
                            disabled={!c.eligible}
                            checked={c.eligible && checked(c.phone)}
                            onChange={() => toggle(c.phone)}
                          />
                        </td>
                        <td className="min-w-40 py-4 align-top">
                          <p className="font-medium">{c.name || 'Sans nom'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.phone}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.city}
                          </p>
                        </td>
                        <td className="min-w-56 py-4">
                          <details>
                            <summary className="cursor-pointer text-xs">
                              {[
                                ...new Set(c.purchases.map((p) => p.product)),
                              ].join(', ')}
                              <span className="mt-2 block text-muted-foreground">
                                Pointures :{' '}
                                {[
                                  ...new Set(
                                    c.purchases.map((p) => p.size || '—'),
                                  ),
                                ].join(', ')}{' '}
                                · Voir l’historique
                              </span>
                            </summary>
                            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                              {c.purchases.map((p, i) => (
                                <li key={i}>
                                  {p.product} · {p.variant} ·{' '}
                                  {p.size || 'Pointure inconnue'}
                                  {p.source && (
                                    <span className="ml-2">
                                      ·{' '}
                                      {{
                                        delivered: 'Article livré',
                                        confirmed: 'Ligne confirmée',
                                        woo: 'Archive WooCommerce',
                                        unknown: 'Détail manquant',
                                      }[p.source] || p.source}
                                    </span>
                                  )}
                                  {p.quantity != null && (
                                    <span> · Qté {p.quantity}</span>
                                  )}
                                  <br />
                                  {p.orderedAt.slice(0, 10)} · #{p.orderId} · {orderLabels[p.status] || p.status}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                        <td className="p-3 align-top">
                          <strong>{c.orderCount}</strong>
                          <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                            {c.lastOrder.slice(0, 10)}
                          </p>
                        </td>
                        <td className="p-3 align-top">
                          <Pill good={c.eligible}>
                            {c.suppressed
                              ? 'Désinscrit'
                              : c.consent
                                ? 'Éligible'
                                : 'Sans consentement'}
                          </Pill>
                          {!c.suppressed && (
                            <button
                              className="mt-2 block text-xs text-muted-foreground hover:text-destructive"
                              disabled={busy}
                              onClick={() =>
                                perform(async () => {
                                  await api('/suppressions', { phone: c.phone })
                                  setSelection({ mode: 'explicit', phones: [] })
                                  setRefresh((v) => v + 1)
                                })
                              }
                            >
                              Désinscrire
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
              <p className="text-xs text-muted-foreground">
                {selectedCount} sélectionné(s)
                {audience?.invalidPhones
                  ? ` · ${audience.invalidPhones} lignes avec téléphone invalide exclues`
                  : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Page précédente"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs">
                  {page} / {Math.max(1, Math.ceil((audience?.total || 0) / 50))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Page suivante"
                  disabled={page * 50 >= (audience?.total || 0) || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  disabled={!selectedCount || loading}
                  onClick={() => setTab('compose')}
                >
                  Créer le message
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
      {tab === 'compose' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="space-y-5 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Composez votre campagne</h2>
            <p className="text-sm text-muted-foreground">
              {selectedCount} contacts sélectionnés. Les consentements seront
              revérifiés avant l’envoi.
            </p>
            <Field label="Nom de la campagne">
              <Input
                placeholder="Nouvelle collection · Septembre"
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setRequestKey(crypto.randomUUID())
                }}
              />
            </Field>
            <Field label="Modèle WhatsApp approuvé">
              <Select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value)
                  setBindings({})
                  setRequestKey(crypto.randomUUID())
                }}
              >
                <option value="">Choisir un modèle</option>
                {templates
                  .filter((t) => t.status === 'APPROVED')
                  .map((t) => (
                    <option key={t.id} value={t.id} disabled={!t.supported}>
                      {t.name} · {t.language}
                      {!t.supported ? ' · Format non pris en charge' : ''}
                    </option>
                  ))}
              </Select>
            </Field>
            {template?.fields.map((f) => f.kind === 'image' ? (
              <Field key={f.key} label={f.label}>
                <Input type="url" placeholder="https://votre-site.com/image.jpg"
                  value={bindings[f.key]?.value || ''}
                  onChange={(e) => {
                    setBindings((b) => ({ ...b, [f.key]: { source: 'literal', value: e.target.value } }))
                    setRequestKey(crypto.randomUUID())
                  }} />
                <p className="mt-2 text-xs text-muted-foreground">Image JPEG ou PNG accessible sans connexion. Le lien doit rester disponible pendant les envois.</p>
              </Field>
            ) : (
              <div
                key={f.key}
                className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2"
              >
                <Field label={f.label || `Variable ${f.key}`}>
                  <Select
                    value={bindings[f.key]?.source || ''}
                    onChange={(e) => {
                      setBindings((b) => ({
                        ...b,
                        [f.key]: { source: e.target.value, value: '' },
                      }))
                      setRequestKey(crypto.randomUUID())
                    }}
                  >
                    <option value="">Choisir une valeur</option>
                    {[
                      ['name', 'Nom du client'],
                      ['products', 'Produits achetés'],
                      ['sizes', 'Pointures'],
                      ['city', 'Ville'],
                      ['orderCount', 'Nombre de commandes'],
                      ['phone', 'Téléphone'],
                      ['literal', 'Texte personnalisé'],
                    ].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {f.kind === 'url' && <p className="break-all text-xs text-muted-foreground sm:col-span-2">Lien approuvé : {f.url} — renseignez uniquement la partie qui remplace {'{{1}}'}.</p>}
                {bindings[f.key]?.source === 'literal' && (
                  <Field label="Texte personnalisé">
                    <Input
                      value={bindings[f.key]?.value || ''}
                      onChange={(e) => {
                        setBindings((b) => ({
                          ...b,
                          [f.key]: { source: 'literal', value: e.target.value },
                        }))
                        setRequestKey(crypto.randomUUID())
                      }}
                    />
                  </Field>
                )}
              </div>
            ))}
            <Button
              disabled={
                busy || !selectedCount || !template?.supported || !name.trim()
              }
              onClick={() =>
                perform(async () => {
                  const result = await api('/campaigns', {
                    requestKey,
                    name,
                    templateId,
                    bindings,
                    filters,
                    selection,
                  })
                  await openDetail(result.id)
                  setRefresh((v) => v + 1)
                })
              }
            >
              {busy ? 'Préparation…' : 'Préparer et vérifier la campagne'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Cette étape enregistre un brouillon. Vous pourrez vérifier chaque
              destinataire avant le lancement.
            </p>
          </section>
          <aside className="space-y-3">
            <Bubble template={template} payload={previewPayload} />
            <p className="px-2 text-xs text-muted-foreground">
              {previewCustomer
                ? `Exemple : ${previewCustomer.name || previewCustomer.phone}`
                : 'Choisissez un client sur la page courante pour un exemple personnalisé.'}{' '}
              L’aperçu définitif sera disponible dans le brouillon.
            </p>
          </aside>
        </div>
      )}
      {tab === 'campaigns' && (
        <section className="space-y-3">
          {!campaigns.length && (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              Vos campagnes apparaîtront ici après préparation.
            </div>
          )}
          {campaigns.map((c) => (
            <button
              key={c.id}
              className="w-full rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50"
              onClick={() => perform(() => openDetail(c.id))}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.template_name} ·{' '}
                    {new Date(c.created_at).toLocaleString('fr-FR')} · {c.total}{' '}
                    contacts
                  </p>
                </div>
                <Pill good={c.state === 'running'}>{labels[c.state]}</Pill>
              </div>
              <div className="my-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${c.total ? ((c.delivered + c.read) / c.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {[
                  'queued',
                  'sending',
                  'sent',
                  'delivered',
                  'read',
                  'failed',
                  'unknown',
                  'skipped',
                ].map((s) => (
                  <span key={s}>
                    {labels[s]}{' '}
                    <strong className="text-foreground">{c[s]}</strong>
                  </span>
                ))}
              </div>
            </button>
          ))}
        </section>
      )}
      {tab === 'templates' && (
        <section>
          <div className="mb-4 flex flex-wrap justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Modèles synchronisés avec votre compte WhatsApp Business.
            </p>
            <Button onClick={() => setCreator(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau modèle
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="space-y-4 rounded-xl border bg-card p-5"
              >
                <div className="flex justify-between gap-2">
                  <h3 className="break-all font-medium">{t.name}</h3>
                  <Pill good={t.status === 'APPROVED'}>{t.status}</Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.language} · {t.category}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {t.components.find((c) => c.type === 'BODY')?.text}
                </p>
                {t.components.some((c) => c.type === 'HEADER' && c.format === 'IMAGE') &&
                  <Pill good>Image à renseigner dans le message</Pill>}
                {t.components.find((c) => c.type === 'BUTTONS')?.buttons?.map((b, i) => (
                  <div key={i} className="rounded-lg border p-2 text-sm">
                    <p>{b.text}</p><p className="break-all text-xs text-muted-foreground">{b.url || b.phone_number}</p>
                  </div>
                ))}
                {!t.supported && (
                  <p className="text-xs text-muted-foreground">{t.reason}</p>
                )}
              </div>
            ))}
          </div>
          {!templates.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Aucun modèle chargé. Créez votre premier modèle ou actualisez.
            </p>
          )}
        </section>
      )}
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>
              Vérifiez les messages préparés. Un message accepté par Meta n’est
              pas encore une livraison confirmée.
            </DialogDescription>
          </DialogHeader>
          {errorBox}
          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{labels[detail.state]}</Pill>
                <span className="text-sm font-medium">
                  {detail.total} destinataires préparés
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    perform(() => openDetail(detail.id, detailPage))
                  }
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualiser
                </Button>
                {detail.state !== 'running' ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        await api(`/campaigns/${detail.id}/start`, {})
                        await openDetail(detail.id, detailPage)
                        setRefresh((v) => v + 1)
                      })
                    }
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Lancer l’envoi
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        await api(`/campaigns/${detail.id}/pause`, {})
                        await openDetail(detail.id, detailPage)
                        setRefresh((v) => v + 1)
                      })
                    }
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Mettre en pause
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      await api(`/campaigns/${detail.id}/retry`, {})
                      await openDetail(detail.id, detailPage)
                      setRefresh((v) => v + 1)
                    })
                  }
                >
                  Reprendre les erreurs temporaires
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Les résultats « À vérifier » ne sont jamais renvoyés
                automatiquement. Une pause laisse finir l’envoi déjà en cours.
              </p>
              <div className="space-y-3">
                {detail.recipients.map((r) => (
                  <details key={r.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm">
                      {r.customer_name || r.phone} · {r.phone} —{' '}
                      {labels[r.status]}
                      {r.error_code ? ` (${r.error_code})` : ''}
                    </summary>
                    <div className="mt-3">
                      <Bubble template={detail.template} payload={r.payload} />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {r.attempts} tentative(s) ·{' '}
                        {r.message_id || 'Aucun identifiant Meta'}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  disabled={busy || detailPage === 1}
                  onClick={() =>
                    perform(() => openDetail(detail.id, detailPage - 1))
                  }
                >
                  Précédent
                </Button>
                <span className="text-xs">Page {detailPage}</span>
                <Button
                  variant="ghost"
                  disabled={busy || detail.recipients.length < 50}
                  onClick={() =>
                    perform(() => openDetail(detail.id, detailPage + 1))
                  }
                >
                  Suivant
                </Button>
              </div>
              <details className="rounded-lg border p-3">
                <summary className="text-sm">
                  Journal des 100 derniers événements
                </summary>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {detail.events.map((e) => (
                    <li key={e.id}>
                      {new Date(e.created_at).toLocaleString('fr-FR')} ·{' '}
                      {e.kind} {e.code} · {e.recipient_id}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={creator} onOpenChange={setCreator}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau modèle marketing</DialogTitle>
            <DialogDescription>
              Le modèle sera soumis à Meta pour approbation avant utilisation.
            </DialogDescription>
          </DialogHeader>
          {errorBox}
          <Field label="Nom (minuscules et underscores)">
            <Input
              value={newTemplate.name}
              onChange={(e) =>
                setNewTemplate((t) => ({ ...t, name: e.target.value }))
              }
              placeholder="nouvelle_collection"
            />
          </Field>
          <Field label="Langue">
            <Select
              value={newTemplate.language}
              onChange={(e) =>
                setNewTemplate((t) => ({ ...t, language: e.target.value }))
              }
            >
              <option value="fr">Français</option>
              <option value="ar">Arabe</option>
              <option value="en_US">Anglais (US)</option>
            </Select>
          </Field>
          <Field label="Image du modèle (facultatif)">
            <Input type="file" accept="image/jpeg,image/png" disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 1024 * 1024) {
                  setError('Choisissez une image JPEG ou PNG de 1 Mo maximum.')
                  e.target.value = ''
                  return
                }
                try {
                  const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(String(reader.result).split(',')[1])
                    reader.onerror = () => reject(new Error('Impossible de lire cette image.'))
                    reader.readAsDataURL(file)
                  })
                  setNewTemplate((t) => ({ ...t, image: { type: file.type, data } }))
                  setError('')
                } catch (error) { setError(error.message) }
              }} />
            <p className="mt-1 text-xs text-muted-foreground">JPEG ou PNG · 1 Mo maximum · envoyée à Meta avec le modèle pour validation.</p>
            {newTemplate.image && <div className="mt-2">
              <img src={`data:${newTemplate.image.type};base64,${newTemplate.image.data}`} alt="Image choisie"
                className="max-h-48 w-full rounded-lg object-contain" />
              <Button variant="ghost" disabled={busy} onClick={() => setNewTemplate((t) => ({ ...t, image: null }))}>Retirer l’image</Button>
            </div>}
          </Field>
          <Field label="Message · variables {{1}}, {{2}}…">
            <textarea
              className="min-h-36 w-full rounded-md border bg-background p-3 text-sm text-foreground"
              maxLength={1024}
              value={newTemplate.body}
              onChange={(e) =>
                setNewTemplate((t) => ({ ...t, body: e.target.value }))
              }
              placeholder="Bonjour {{1}}, découvrez notre nouvelle collection. Répondez STOP pour vous désinscrire."
            />
          </Field>
          <Field label="Exemples des variables, un par ligne">
            <textarea
              className="min-h-20 w-full rounded-md border bg-background p-3 text-sm text-foreground"
              value={newTemplate.examples}
              onChange={(e) =>
                setNewTemplate((t) => ({ ...t, examples: e.target.value }))
              }
              placeholder="Amine"
            />
          </Field>
          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Bouton avec lien (facultatif)</p>
            <Field label="Texte du bouton">
              <Input maxLength={25} placeholder="Voir la collection" value={newTemplate.buttonText || ''}
                onChange={(e) => setNewTemplate((t) => ({ ...t, buttonText: e.target.value }))} />
            </Field>
            <Field label="Adresse du site à ouvrir">
              <Input type="url" placeholder="https://votre-site.com/collection" value={newTemplate.buttonUrl || ''}
                onChange={(e) => setNewTemplate((t) => ({ ...t, buttonUrl: e.target.value }))} />
            </Field>
            {newTemplate.buttonText && <div className="rounded-lg bg-muted p-3 text-center text-sm">
              <p className="font-medium text-sky-600">{newTemplate.buttonText}</p>
              <p className="break-all text-xs text-muted-foreground">{newTemplate.buttonUrl}</p>
            </div>}
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              perform(async () => {
                await api('/templates', {
                  ...newTemplate,
                  examples: newTemplate.examples
                    ? newTemplate.examples.split('\n')
                    : [],
                })
                setCreator(false)
                setNewTemplate({
                  name: '',
                  language: 'fr',
                  body: '',
                  examples: '', image: null, buttonText: '', buttonUrl: '',
                })
                setRefresh((v) => v + 1)
              })
            }
          >
            Soumettre à Meta
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
