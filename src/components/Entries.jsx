/**
 * Entrées de stock — présentation uniquement.
 * CRUD, doublons, payloads, filtres, stats, permissions et combobox produit inchangés.
 */
import { useEffect, useMemo, useState } from 'react'
import { USE_SUPABASE } from '../config'
import { useData, ActionTypes } from '../context/UnifiedDataContext'
import { useAuth } from '../context/AuthContext'
import { filterByPeriod } from '../utils/dateUtils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { PageSurface } from '@/components/PageSurface'
import { StatusBadge } from '@/components/StatusBadge'
import {
  Plus,
  Package,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Check,
  X,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react'

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR')

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function PeriodPanel({ title, stats }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MetaStat label="Entrées" value={formatNum(stats.totalEntrees)} />
        <MetaStat label="Valeur" value={formatDa(stats.totalValue)} />
        <MetaStat label="Unités" value={formatNum(stats.totalProduits)} />
        <MetaStat label="Payées" value={formatNum(stats.totalPayees)} />
      </div>
    </div>
  )
}

const Entries = () => {
  const dataCtx = useData()
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  // ----- ÉTAT UI -----
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    fournisseurId: '',
    date: new Date().toISOString().split('T')[0],
    lignes: [],
  })
  const [currentLigne, setCurrentLigne] = useState({ produitId: '', quantite: '' })
  const [produitPickerOpen, setProduitPickerOpen] = useState(false)
  const [produitSearch, setProduitSearch] = useState('')
  const [detail, setDetail] = useState({ openFor: null, rows: [] })
  const [creating, setCreating] = useState(false)
  const [checkingDoublon, setCheckingDoublon] = useState(false)
  const [doublonAlert, setDoublonAlert] = useState(null)
  const [filters, setFilters] = useState({
    fournisseurId: '',
    dateStart: '',
    dateEnd: ''
  })

  // ----- SELECTION DES DONNÉES SELON LE MODE -----
  const fournisseurs = useMemo(() => {
    if (USE_SUPABASE) return dataCtx?.fournisseurs ?? []
    return dataCtx?.state?.fournisseurs ?? []
  }, [dataCtx])

  const produits = useMemo(() => {
    if (USE_SUPABASE) return dataCtx?.produits ?? []
    return dataCtx?.state?.produits ?? []
  }, [dataCtx])

  const entrees = useMemo(() => {
    if (USE_SUPABASE) return dataCtx?.entrees ?? []
    return dataCtx?.state?.entrees ?? []
  }, [dataCtx])

  // ----- CHARGEMENT INIT (Supabase) -----
  useEffect(() => {
    if (USE_SUPABASE) {
      dataCtx?.fetchFournisseurs?.()
      dataCtx?.fetchProduits?.()
      dataCtx?.fetchEntrees?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- HELPERS UI -----
  const getFournisseurName = (fournisseurId) => {
    const f = fournisseurs.find((x) => (x.id || x?.fournisseurId) === fournisseurId)
    return f ? f.nom : 'Inconnu'
  }

  const getProduitName = (produitId) => {
    const p = produits.find((x) => (x.id || x?.produitId) === produitId)
    return p ? p.nom : 'Inconnu'
  }

  const getProduitPrixAchat = (produitId) => {
    const p = produits.find((x) => (x.id || x?.produitId) === produitId)
    return p ? (p.prix_achat ?? p.prixAchat ?? 0) : 0
  }

  const formatDateFr = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(`${dateStr}T12:00:00`)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('fr-FR')
  }

  const resetForm = () => {
    setFormData({ fournisseurId: '', date: new Date().toISOString().split('T')[0], lignes: [] })
    setCurrentLigne({ produitId: '', quantite: '' })
    setProduitPickerOpen(false)
    setProduitSearch('')
    setDoublonAlert(null)
  }

  const selectedProduit = useMemo(
    () => produits.find((p) => p.id === currentLigne.produitId) || null,
    [produits, currentLigne.produitId]
  )

  const filteredProduitsForPicker = useMemo(() => {
    const q = produitSearch.trim().toLowerCase()
    if (!q) return produits
    return produits.filter((p) => {
      const nom = String(p.nom || '').toLowerCase()
      const ref = String(p.reference || '').toLowerCase()
      return nom.includes(q) || ref.includes(q)
    })
  }, [produits, produitSearch])

  const calculateEntreeValueLocal = (entree) => {
    let total = 0
    entree.lignes?.forEach((ligne) => {
      total += (ligne.quantite || 0) * getProduitPrixAchat(ligne.produitId)
    })
    return total
  }

  // ----- ACTIONS : AJOUT LIGNE DANS LE FORM -----
  const handleAddLigne = () => {
    if (!currentLigne.produitId || !currentLigne.quantite) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs de la ligne",
      })
      return
    }
    const ligne = {
      produitId: currentLigne.produitId,
      quantite: parseInt(currentLigne.quantite, 10),
    }
    setFormData((prev) => ({ ...prev, lignes: [...prev.lignes, ligne] }))
    setCurrentLigne({ produitId: '', quantite: '' })
    setProduitSearch('')
    setProduitPickerOpen(false)
  }

  const handleDeleteLigne = (index) => {
    setFormData((prev) => ({
      ...prev,
      lignes: prev.lignes.filter((_, i) => i !== index),
    }))
  }

  // ----- ACTIONS : CRUD ENTRÉE -----
  const createEntree = async () => {
    setCreating(true)
    try {
      if (USE_SUPABASE) {
        const lignes = formData.lignes.map((l) => ({
          produit_id: l.produitId,
          variante_id: null,
          quantite: l.quantite,
        }))
        const payload = {
          date: formData.date,
          fournisseur_id: formData.fournisseurId,
          paye: false,
          lignes,
        }
        const res = await dataCtx?.addEntreeWithLines?.(payload)
        if (res?.entree_id) {
          toast({
            title: "Succès",
            description: `Entrée créée avec ${res.lignes_count} ligne(s)`,
          })
        }
        await dataCtx?.fetchEntrees?.()
      } else {
        const newEntree = {
          id: dataCtx?.generateId?.(),
          date: formData.date,
          fournisseurId: formData.fournisseurId,
          lignes: formData.lignes,
          paye: false,
        }
        dataCtx?.dispatch?.({ type: dataCtx?.ActionTypes?.ADD_ENTREE ?? ActionTypes.ADD_ENTREE, payload: newEntree })
        toast({
          title: "Succès",
          description: "Entrée ajoutée avec succès",
        })
      }

      resetForm()
      setShowModal(false)
    } catch (e) {
      console.error(e)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleAddEntree = async () => {
    if (!formData.fournisseurId || formData.lignes.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un fournisseur et ajouter au moins une ligne",
      })
      return
    }

    if (USE_SUPABASE && dataCtx?.findEnvoiDoublon) {
      setCheckingDoublon(true)
      try {
        const lignesDoublon = formData.lignes.map((l) => ({
          produit_id: l.produitId,
          quantite: l.quantite,
        }))
        const doublon = await dataCtx.findEnvoiDoublon(formData.fournisseurId, lignesDoublon)
        if (doublon) {
          setDoublonAlert(doublon)
          return
        }
      } catch (e) {
        console.error(e)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: e?.message || 'Impossible de vérifier les doublons',
        })
        return
      } finally {
        setCheckingDoublon(false)
      }
    }

    await createEntree()
  }

  const handleConfirmDespiteDoublon = async () => {
    setDoublonAlert(null)
    await createEntree()
  }

  // Filtrer les entrées selon les filtres
  const filteredEntrees = useMemo(() => {
    let filtered = entrees || []
    
    if (filters.fournisseurId) {
      filtered = filtered.filter(e => {
        const fId = e.fournisseur_id ?? e.fournisseurId
        return fId === filters.fournisseurId
      })
    }
    
    if (filters.dateStart && filters.dateEnd) {
      filtered = filtered.filter(e => {
        const entreeDate = e.date
        return entreeDate >= filters.dateStart && entreeDate <= filters.dateEnd
      })
    }
    
    return filtered
  }, [entrees, filters])

  // Fonction pour calculer les stats d'une liste d'entrées
  const calculateStats = useMemo(() => {
    return (entreesList) => {
      let totalEntrees = entreesList.length
      let totalPayees = 0
      let totalNonPayees = 0
      let totalValue = 0
      let totalValuePayees = 0
      let totalValueNonPayees = 0
      let totalProduits = 0
      
      entreesList.forEach(entree => {
        const paye = Boolean(entree.paye)
        let entreeValue = 0
        
        if (!USE_SUPABASE && entree.lignes) {
          entreeValue = calculateEntreeValueLocal(entree)
          totalProduits += entree.lignes.reduce((sum, l) => sum + (l.quantite || 0), 0)
        } else {
          if (detail.openFor === entree.id && detail.rows.length > 0) {
            entreeValue = detail.rows.reduce((sum, l) => {
              const prix = l.produit_id?.prix_achat ?? 0
              return sum + (l.quantite * prix)
            }, 0)
            totalProduits += detail.rows.reduce((sum, l) => sum + (l.quantite || 0), 0)
          }
        }
        
        totalValue += entreeValue
        
        if (paye) {
          totalPayees++
          totalValuePayees += entreeValue
        } else {
          totalNonPayees++
          totalValueNonPayees += entreeValue
        }
      })
      
      const tauxPaye = totalEntrees > 0 ? (totalPayees / totalEntrees) * 100 : 0
      
      return {
        totalEntrees,
        totalPayees,
        totalNonPayees,
        totalValue,
        totalValuePayees,
        totalValueNonPayees,
        totalProduits,
        tauxPaye: tauxPaye.toFixed(1) + '%'
      }
    }
  }, [calculateEntreeValueLocal, detail])

  // Calculer les statistiques globales
  const globalStats = useMemo(() => {
    return calculateStats(filteredEntrees)
  }, [filteredEntrees, calculateStats])

  // Statistiques par période
  const periodStats = useMemo(() => {
    const today = filterByPeriod(entrees || [], 'date', 'today')
    const week = filterByPeriod(entrees || [], 'date', 'week')
    const month = filterByPeriod(entrees || [], 'date', 'month')
    
    return {
      today: calculateStats(today),
      week: calculateStats(week),
      month: calculateStats(month)
    }
  }, [entrees, calculateStats])

  const handleDeleteEntree = async (entreeId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) return
    try {
      if (USE_SUPABASE) {
        if (!dataCtx?.supabase) {
          throw new Error("Supabase client non initialisé")
        }
        const { error } = await dataCtx.supabase.from('entrees').delete().eq('id', entreeId)
        if (error) {
          throw error
        }
        await dataCtx?.fetchEntrees?.()
        toast({
          title: "Succès",
          description: "Entrée supprimée avec succès",
        })
      } else {
        dataCtx?.dispatch?.({ type: dataCtx?.ActionTypes?.DELETE_ENTREE ?? ActionTypes.DELETE_ENTREE, payload: entreeId })
        toast({
          title: "Succès",
          description: "Entrée supprimée avec succès",
        })
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      })
    }
  }

  // ----- DETAILS D'UNE ENTRÉE (SUPABASE) -----
  const showDetails = async (id) => {
    if (!USE_SUPABASE) return
    const rows = await dataCtx?.fetchEntreeDetails?.(id)
    setDetail({ openFor: id, rows: rows || [] })
  }

  /** Présentation : bascule affichage lignes (local sans fetch ; Supabase via showDetails). */
  const toggleLignes = (entree) => {
    if (USE_SUPABASE) {
      showDetails(entree.id)
      return
    }
    setDetail((prev) =>
      prev.openFor === entree.id ? { openFor: null, rows: [] } : { openFor: entree.id, rows: [] }
    )
  }

  const formLignesQte = formData.lignes.reduce((sum, l) => sum + (l.quantite || 0), 0)
  const formLignesMontant = formData.lignes.reduce(
    (sum, l) => sum + (l.quantite || 0) * getProduitPrixAchat(l.produitId),
    0
  )
  const hasActiveFilters = Boolean(filters.fournisseurId || filters.dateStart || filters.dateEnd)

  const renderPaymentBadge = (paye) =>
    paye ? (
      <StatusBadge status="paye" />
    ) : (
      <StatusBadge status="litige" label="Non payé" />
    )

  const renderStatutBadge = (entree) => {
    const statut = entree?.statut
    if (!statut) return null
    return <StatusBadge status={statut} />
  }

  const renderLignesDetail = (entree, id, { alwaysLocal = false } = {}) => {
    const showLocal =
      !USE_SUPABASE &&
      entree.lignes?.length > 0 &&
      (alwaysLocal || detail.openFor === id)
    const showSb = USE_SUPABASE && detail.openFor === id && detail.rows.length > 0
    if (!showLocal && !showSb) {
      if (USE_SUPABASE && detail.openFor === id && detail.rows.length === 0) {
        return (
          <div className="mt-3 rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune ligne de produit enregistrée pour cette entrée
          </div>
        )
      }
      return null
    }

    return (
      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Produits ({showLocal ? entree.lignes.length : detail.rows.length})
        </p>
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 text-right font-medium">Qté</th>
                <th className="px-3 py-2 text-right font-medium">Prix</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {showLocal &&
                entree.lignes.map((ligne, idx) => {
                  const produitNom = getProduitName(ligne.produitId)
                  const prixUnitaire = getProduitPrixAchat(ligne.produitId)
                  const ligneValue = ligne.quantite * prixUnitaire
                  return (
                    <tr key={idx} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 font-medium">{produitNom}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ligne.quantite}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDa(prixUnitaire)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatDa(ligneValue)}
                      </td>
                    </tr>
                  )
                })}
              {showSb &&
                detail.rows.map((l) => {
                  const label =
                    l.produit_id?.nom ||
                    (l.variante_id
                      ? `${l.variante_id.modele || ''} ${l.variante_id.taille || ''} ${l.variante_id.couleur || ''}`.trim()
                      : '—')
                  const prixUnitaire = l.produit_id?.prix_achat ?? 0
                  const ligneValue = l.quantite * prixUnitaire
                  return (
                    <tr key={l.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 font-medium">{label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.quantite}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDa(prixUnitaire)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatDa(ligneValue)}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const productCombobox = (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="entree-produit-picker">
        Produit
      </label>
      <Popover
        modal
        open={produitPickerOpen}
        onOpenChange={(open) => {
          setProduitPickerOpen(open)
          if (!open) setProduitSearch('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="entree-produit-picker"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={produitPickerOpen}
            className="h-10 w-full justify-between border-border/80 px-3 font-medium"
          >
            <span className="truncate text-left">
              {selectedProduit
                ? `${selectedProduit.nom}${selectedProduit.reference ? ` · ${selectedProduit.reference}` : ''} · ${(selectedProduit.prix_achat ?? selectedProduit.prixAchat ?? 0)} DA`
                : 'Sélectionner un produit...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <div className="flex items-center">
              <div className="min-w-0 flex-1">
                <CommandInput
                  placeholder="Rechercher nom ou référence…"
                  value={produitSearch}
                  onValueChange={setProduitSearch}
                />
              </div>
              {produitSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mr-1 h-8 w-8 shrink-0"
                  aria-label="Effacer la recherche"
                  onClick={() => setProduitSearch('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <CommandList>
              <CommandEmpty>Aucun produit trouvé</CommandEmpty>
              <CommandGroup>
                {filteredProduitsForPicker.map((p) => {
                  const prix = p.prix_achat ?? p.prixAchat ?? 0
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.nom || ''} ${p.reference || ''} ${p.id}`}
                      onSelect={() => {
                        setCurrentLigne((prev) => ({
                          ...prev,
                          produitId: p.id,
                        }))
                        setProduitSearch('')
                        setProduitPickerOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          currentLigne.produitId === p.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.nom}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.reference ? `Réf. ${p.reference}` : 'Sans référence'}
                          {' · '}
                          {prix} DA
                        </p>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Inventaire"
        title="Entrées de stock"
        description="Enregistrement et consultation des réceptions marchandise — Cosmos Algérie."
        actions={
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle entrée
          </Button>
        }
      />

      {/* KPI principaux — admin */}
      {isAdmin() && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetaStat label="Entrées totales" value={formatNum(globalStats.totalEntrees)} />
          <MetaStat label="Valeur totale" value={formatDa(globalStats.totalValue)} />
          <MetaStat label="Unités reçues" value={formatNum(globalStats.totalProduits)} />
          <MetaStat
            label="Montant payé"
            value={formatDa(globalStats.totalValuePayees)}
            tone="success"
          />
          <MetaStat
            label="Montant non payé"
            value={formatDa(globalStats.totalValueNonPayees)}
            tone="danger"
          />
        </div>
      )}

      {/* Comparaison périodes — admin */}
      {isAdmin() && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Activité récente
            </h2>
            <p className="text-xs text-muted-foreground">
              Comparaison aujourd&apos;hui / semaine / mois (hors filtres liste).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PeriodPanel title="Aujourd'hui" stats={periodStats.today} />
            <PeriodPanel title="Cette semaine" stats={periodStats.week} />
            <PeriodPanel title="Ce mois" stats={periodStats.month} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Payées filtrées : {formatNum(globalStats.totalPayees)} · Non payées :{' '}
              {formatNum(globalStats.totalNonPayees)} · Taux : {globalStats.tauxPaye}
            </span>
          </div>
        </section>
      )}

      {/* Filtres */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[160px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="filtre-fournisseur">
              Fournisseur
            </label>
            <select
              id="filtre-fournisseur"
              value={filters.fournisseurId}
              onChange={(e) => setFilters({ ...filters, fournisseurId: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">Tous les fournisseurs</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="filtre-debut">
              Date début
            </label>
            <Input
              id="filtre-debut"
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="min-w-[140px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="filtre-fin">
              Date fin
            </label>
            <Input
              id="filtre-fin"
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              className="h-9"
            />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setFilters({ fournisseurId: '', dateStart: '', dateEnd: '' })}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </section>

      {/* Liste */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Liste des entrées
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatNum(filteredEntrees?.length || 0)} entrée(s)
            {hasActiveFilters ? ' (filtrées)' : ''}
          </p>
        </div>

        {!filteredEntrees || filteredEntrees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Aucune entrée trouvée</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? 'Modifiez ou réinitialisez les filtres.'
                : 'Créez une nouvelle entrée pour démarrer.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Fournisseur</th>
                    <th className="px-3 py-2.5 font-medium">Réf.</th>
                    <th className="px-3 py-2.5 font-medium">Paiement</th>
                    <th className="px-3 py-2.5 font-medium">Statut</th>
                    <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                    <th className="w-12 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntrees.map((entree) => {
                    const entreeValueLocal = USE_SUPABASE ? null : calculateEntreeValueLocal(entree)
                    const id = entree.id
                    const date = entree.date
                    const fournisseurId = entree.fournisseur_id ?? entree.fournisseurId
                    const paye = Boolean(entree.paye)

                    let entreeValueTotal = entreeValueLocal
                    if (USE_SUPABASE && detail.openFor === id && detail.rows.length > 0) {
                      entreeValueTotal = detail.rows.reduce((sum, l) => {
                        const prix = l.produit_id?.prix_achat ?? 0
                        return sum + (l.quantite * prix)
                      }, 0)
                    }

                    return (
                      <tr
                        key={id}
                        className="border-b border-border/40 align-top last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2.5 tabular-nums">{formatDateFr(date)}</td>
                        <td className="px-3 py-2.5 font-medium">
                          {getFournisseurName(fournisseurId)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          #{String(id).slice(0, 8)}
                        </td>
                        <td className="px-3 py-2.5">{renderPaymentBadge(paye)}</td>
                        <td className="px-3 py-2.5">{renderStatutBadge(entree) || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {entreeValueTotal !== null && entreeValueTotal > 0
                            ? formatDa(entreeValueTotal)
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => toggleLignes(entree)}>
                                  {detail.openFor === id ? (
                                    <>
                                      <ChevronDown className="mr-2 h-4 w-4" />
                                      Masquer lignes
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="mr-2 h-4 w-4" />
                                      Voir lignes
                                    </>
                                  )}
                                </DropdownMenuItem>
                              {isAdmin() && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteEntree(id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail panel when a row is expanded */}
            {detail.openFor &&
              filteredEntrees.some((e) => e.id === detail.openFor) && (
                <div className="hidden md:block">
                  {renderLignesDetail(
                    filteredEntrees.find((e) => e.id === detail.openFor),
                    detail.openFor
                  )}
                </div>
              )}

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {filteredEntrees.map((entree) => {
                const entreeValueLocal = USE_SUPABASE ? null : calculateEntreeValueLocal(entree)
                const id = entree.id
                const date = entree.date
                const fournisseurId = entree.fournisseur_id ?? entree.fournisseurId
                const paye = Boolean(entree.paye)

                let entreeValueTotal = entreeValueLocal
                if (USE_SUPABASE && detail.openFor === id && detail.rows.length > 0) {
                  entreeValueTotal = detail.rows.reduce((sum, l) => {
                    const prix = l.produit_id?.prix_achat ?? 0
                    return sum + (l.quantite * prix)
                  }, 0)
                }

                return (
                  <div
                    key={id}
                    className="rounded-lg border border-border/80 bg-card px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{getFournisseurName(fournisseurId)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateFr(date)} · #{String(id).slice(0, 8)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {renderPaymentBadge(paye)}
                          {renderStatutBadge(entree)}
                        </div>
                        {entreeValueTotal !== null && entreeValueTotal > 0 && (
                          <p className="pt-1 text-sm font-semibold tabular-nums">
                            {formatDa(entreeValueTotal)}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => toggleLignes(entree)}>
                            {detail.openFor === id ? (
                              <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Masquer lignes
                              </>
                            ) : (
                              <>
                                <ChevronRight className="mr-2 h-4 w-4" />
                                Voir lignes
                              </>
                            )}
                          </DropdownMenuItem>
                          {isAdmin() && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteEntree(id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {renderLignesDetail(entree, id, { alwaysLocal: !USE_SUPABASE })}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Dialog Nouvelle entrée */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle entrée de stock</DialogTitle>
            <DialogDescription>
              Date, fournisseur et lignes de produits — enregistrement sans paiement initial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Section date + fournisseur */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Date et fournisseur</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="entree-fournisseur">
                    Fournisseur *
                  </label>
                  <select
                    id="entree-fournisseur"
                    value={formData.fournisseurId}
                    onChange={(e) => setFormData({ ...formData, fournisseurId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <option value="">Sélectionner un fournisseur</option>
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="entree-date">
                    Date *
                  </label>
                  <Input
                    id="entree-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Section ajout produits */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Ajouter des produits</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {productCombobox}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="entree-qte">
                    Quantité
                  </label>
                  <Input
                    id="entree-qte"
                    type="number"
                    min="1"
                    placeholder="Ex: 10"
                    value={currentLigne.quantite}
                    onChange={(e) =>
                      setCurrentLigne({ ...currentLigne, quantite: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button type="button" onClick={handleAddLigne} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter cette ligne
              </Button>
            </section>

            {/* Lignes ajoutées */}
            {formData.lignes.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold">
                    Lignes ajoutées ({formData.lignes.length})
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-border/80">
                    <table className="w-full min-w-[360px] text-left text-sm">
                      <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Produit</th>
                          <th className="px-3 py-2 text-right font-medium">Qté</th>
                          <th className="px-3 py-2 text-right font-medium">Prix</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="w-10 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {formData.lignes.map((ligne, idx) => {
                          const produit = produits.find((p) => p.id === ligne.produitId)
                          const prix = getProduitPrixAchat(ligne.produitId)
                          const total = (ligne.quantite || 0) * prix
                          return (
                            <tr
                              key={idx}
                              className="border-b border-border/40 last:border-0"
                            >
                              <td className="px-3 py-2 font-medium">
                                {produit?.nom || 'Produit inconnu'}
                                {produit?.reference ? (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    · {produit.reference}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {ligne.quantite}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatDa(prix)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {formatDa(total)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {isAdmin() && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteLigne(idx)}
                                    aria-label="Retirer la ligne"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Récap */}
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-3">
                  <MetaStat label="Lignes" value={formatNum(formData.lignes.length)} />
                  <MetaStat label="Quantités" value={formatNum(formLignesQte)} />
                  <MetaStat label="Montant" value={formatDa(formLignesMontant)} />
                </div>
              </>
            )}

            {/* Alerte doublon */}
            {doublonAlert && (
              <div
                role="alert"
                className="space-y-3 rounded-lg border-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)] p-4"
              >
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--warning))]" />
                  <p className="text-sm text-foreground">
                    Une entrée identique existe déjà pour ce fournisseur — mêmes produits et
                    même valeur ({formatDa(doublonAlert.valeur_totale)}), créée le{' '}
                    {formatDateFr(doublonAlert.date_envoi)}. Voulez-vous quand même la créer ?
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDoublonAlert(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmDespiteDoublon}
                    disabled={creating}
                  >
                    {creating ? 'Enregistrement…' : 'Créer quand même'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
            >
              Annuler
            </Button>
            {!doublonAlert && (
              <Button onClick={handleAddEntree} disabled={creating || checkingDoublon}>
                {checkingDoublon
                  ? 'Vérification…'
                  : creating
                    ? 'Enregistrement…'
                    : "Enregistrer l'entrée"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSurface>
  )
}

export default Entries
