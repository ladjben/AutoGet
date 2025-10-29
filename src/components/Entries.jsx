import { useEffect, useMemo, useState } from 'react'
import { USE_SUPABASE } from '../config'
import { useData, ActionTypes } from '../context/UnifiedDataContext'
import { useAuth } from '../context/AuthContext'
import { filterByPeriod } from '../utils/dateUtils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Package, TrendingUp, TrendingDown, Calendar, Building2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

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
  const [detail, setDetail] = useState({ openFor: null, rows: [] })
  const [creating, setCreating] = useState(false)
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
  }

  const handleDeleteLigne = (index) => {
    setFormData((prev) => ({
      ...prev,
      lignes: prev.lignes.filter((_, i) => i !== index),
    }))
  }

  // ----- ACTIONS : CRUD ENTRÉE -----
  const handleAddEntree = async () => {
    if (!formData.fournisseurId || formData.lignes.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un fournisseur et ajouter au moins une ligne",
      })
      return
    }

    try {
      setCreating(true)
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

      setFormData({ fournisseurId: '', date: new Date().toISOString().split('T')[0], lignes: [] })
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
        const { error } = await dataCtx?.supabase?.from('entrees').delete().eq('id', entreeId)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Entrées de Stock</h1>
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Entrée
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle Entrée de Stock</DialogTitle>
              <DialogDescription>
                Créez une nouvelle entrée de stock avec ses lignes de produits
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Fournisseur *</label>
                <select
                  value={formData.fournisseurId}
                  onChange={(e) => setFormData({ ...formData, fournisseurId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date *</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3">Ajouter une ligne</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Produit</label>
                    <select
                      value={currentLigne.produitId}
                      onChange={(e) => setCurrentLigne({ ...currentLigne, produitId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Sélectionner</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nom} — {(p.prix_achat ?? p.prixAchat ?? 0)} DA
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Quantité</label>
                    <Input
                      type="number"
                      min="1"
                      value={currentLigne.quantite}
                      onChange={(e) => setCurrentLigne({ ...currentLigne, quantite: e.target.value })}
                    />
                  </div>
                </div>

                <Button onClick={handleAddLigne} variant="outline" className="mt-3">
                  + Ajouter cette ligne
                </Button>
              </div>

              {formData.lignes.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Lignes ajoutées ({formData.lignes.length})</h4>
                    <div className="space-y-2">
                      {formData.lignes.map((ligne, idx) => {
                        const produit = produits.find((p) => p.id === ligne.produitId)
                        return (
                          <Card key={idx}>
                            <CardContent className="pt-6">
                              <div className="flex justify-between items-center">
                                <div className="text-sm">
                                  {produit?.nom || 'Produit inconnu'}
                                  <span className="ml-3 text-muted-foreground">Qté: {ligne.quantite}</span>
                                </div>
                                {isAdmin() && (
                                  <Button onClick={() => handleDeleteLigne(idx)} variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false)
                  setFormData({ fournisseurId: '', date: new Date().toISOString().split('T')[0], lignes: [] })
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleAddEntree} disabled={creating}>
                {creating ? 'Enregistrement…' : "Enregistrer l'entrée"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres de Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fournisseur</label>
              <select
                value={filters.fournisseurId}
                onChange={(e) => setFilters({ ...filters, fournisseurId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Tous les fournisseurs</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date début</label>
              <Input
                type="date"
                value={filters.dateStart}
                onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date fin</label>
              <Input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              />
            </div>
          </div>
          {(filters.fournisseurId || filters.dateStart || filters.dateEnd) && (
            <Button
              onClick={() => setFilters({ fournisseurId: '', dateStart: '', dateEnd: '' })}
              variant="outline"
              className="mt-4"
            >
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Résumé Global */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé Global</CardTitle>
          <CardDescription>Statistiques sur les entrées filtrées</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entrées</p>
                    <p className="text-3xl font-bold">{globalStats.totalEntrees}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {globalStats.totalPayees} payées / {globalStats.totalNonPayees} non payées
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valeur Totale</p>
                    <p className="text-3xl font-bold">{globalStats.totalValue.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {globalStats.tauxPaye} d'entrées payées
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Produits Reçus</p>
                    <p className="text-3xl font-bold">{globalStats.totalProduits}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unités totales reçues
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Valeur Payée</p>
              <p className="text-xl font-bold text-green-600">{globalStats.totalValuePayees.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Valeur Non Payée</p>
              <p className="text-xl font-bold text-destructive">{globalStats.totalValueNonPayees.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Entrées Payées</p>
              <p className="text-xl font-bold">{globalStats.totalPayees}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Entrées Non Payées</p>
              <p className="text-xl font-bold">{globalStats.totalNonPayees}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques par Période */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques par Période</CardTitle>
          <CardDescription>Vue détaillée par jour, semaine et mois</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aujourd'hui</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrées:</span>
                  <span className="text-sm font-semibold">{periodStats.today.totalEntrees}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valeur:</span>
                  <span className="text-sm font-semibold">{periodStats.today.totalValue.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Produits:</span>
                  <span className="text-sm font-semibold">{periodStats.today.totalProduits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payées:</span>
                  <span className="text-sm font-semibold">{periodStats.today.totalPayees}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cette Semaine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrées:</span>
                  <span className="text-sm font-semibold">{periodStats.week.totalEntrees}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valeur:</span>
                  <span className="text-sm font-semibold">{periodStats.week.totalValue.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Produits:</span>
                  <span className="text-sm font-semibold">{periodStats.week.totalProduits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payées:</span>
                  <span className="text-sm font-semibold">{periodStats.week.totalPayees}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ce Mois</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrées:</span>
                  <span className="text-sm font-semibold">{periodStats.month.totalEntrees}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valeur:</span>
                  <span className="text-sm font-semibold">{periodStats.month.totalValue.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Produits:</span>
                  <span className="text-sm font-semibold">{periodStats.month.totalProduits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payées:</span>
                  <span className="text-sm font-semibold">{periodStats.month.totalPayees}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Liste des entrées */}
      <div className="space-y-4">
        {(!filteredEntrees || filteredEntrees.length === 0) ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg">Aucune entrée trouvée</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEntrees.map((entree) => {
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
              <Card key={id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Entrée #{id.slice(0, 8)}</CardTitle>
                      <CardDescription className="mt-1">ID: {id}</CardDescription>
                    </div>
                    <Badge variant={paye ? "default" : "destructive"}>
                      {paye ? 'Payé' : 'Non Payé'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date
                      </p>
                      <p className="font-semibold">{date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Fournisseur
                      </p>
                      <p className="font-semibold">{getFournisseurName(fournisseurId)}</p>
                    </div>
                    {(entreeValueTotal !== null && entreeValueTotal > 0) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Montant total</p>
                        <p className="font-semibold text-green-600">{entreeValueTotal.toFixed(2)} DA</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {USE_SUPABASE && (
                      <Button
                        onClick={() => showDetails(id)}
                        variant={detail.openFor === id ? "default" : "outline"}
                        size="sm"
                      >
                        {detail.openFor === id ? (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Masquer lignes
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-4 w-4 mr-2" />
                            Voir lignes
                          </>
                        )}
                      </Button>
                    )}

                    {isAdmin() && (
                      <Button
                        onClick={() => handleDeleteEntree(id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    )}
                  </div>

                  {/* Lignes de produits */}
                  {((!USE_SUPABASE && entree.lignes?.length > 0) || (USE_SUPABASE && detail.openFor === id && detail.rows.length > 0)) && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="text-sm font-semibold mb-4">Produits ({!USE_SUPABASE ? entree.lignes?.length : detail.rows.length})</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {!USE_SUPABASE && entree.lignes?.map((ligne, idx) => {
                          const produitNom = getProduitName(ligne.produitId)
                          const prixUnitaire = getProduitPrixAchat(ligne.produitId)
                          const ligneValue = ligne.quantite * prixUnitaire
                          return (
                            <Card key={idx}>
                              <CardContent className="pt-6">
                                <h5 className="font-semibold mb-3">{produitNom}</h5>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Quantité</p>
                                    <p className="font-semibold">{ligne.quantite}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Prix unitaire</p>
                                    <p className="font-semibold">{prixUnitaire.toFixed(2)} DA</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                                    <p className="font-semibold text-green-600">{ligneValue.toFixed(2)} DA</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}

                        {USE_SUPABASE && detail.rows.map((l) => {
                          const label = l.produit_id?.nom || (l.variante_id ? `${l.variante_id.modele || ''} ${l.variante_id.taille || ''} ${l.variante_id.couleur || ''}`.trim() : '—')
                          const prixUnitaire = l.produit_id?.prix_achat ?? 0
                          const ligneValue = l.quantite * prixUnitaire
                          return (
                            <Card key={l.id}>
                              <CardContent className="pt-6">
                                <h5 className="font-semibold mb-3">{label}</h5>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Quantité</p>
                                    <p className="font-semibold">{l.quantite}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Prix unitaire</p>
                                    <p className="font-semibold">{prixUnitaire.toFixed(2)} DA</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                                    <p className="font-semibold text-green-600">{ligneValue.toFixed(2)} DA</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {USE_SUPABASE && detail.openFor === id && detail.rows.length === 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center text-muted-foreground">
                            <p className="text-sm">Aucune ligne de produit enregistrée pour cette entrée</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Entries
