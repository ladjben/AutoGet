import { useEffect, useMemo, useState } from 'react'
import { USE_SUPABASE } from '../config'
import { useData, ActionTypes } from '../context/UnifiedDataContext'
import { useAuth } from '../context/AuthContext'

const Entries = () => {
  // Le provider actif change selon USE_SUPABASE (déjà géré dans App.jsx)
  const dataCtx = useData()
  const { isAdmin } = useAuth()

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
    // en mode local, les données sont déjà dans le state
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
    // BDD: prix_achat ; Local: prixAchat
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
      alert('Veuillez remplir tous les champs de la ligne')
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
      alert('Veuillez sélectionner un fournisseur et ajouter au moins une ligne')
      return
    }

    try {
      setCreating(true)
      if (USE_SUPABASE) {
        // addEntreeWithLines via DataContextSupabase
        const lignes = formData.lignes.map((l) => ({
          produit_id: l.produitId,
          variante_id: null, // si tu gères les variantes plus tard
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
          alert(`Entrée créée: ${res.entree_id} (${res.lignes_count} lignes)`)
        }
        await dataCtx?.fetchEntrees?.()
      } else {
        // mode local (ancien flux)
        const newEntree = {
          id: dataCtx?.generateId?.(),
          date: formData.date,
          fournisseurId: formData.fournisseurId,
          lignes: formData.lignes,
          paye: false,
        }
        dataCtx?.dispatch?.({ type: dataCtx?.ActionTypes?.ADD_ENTREE ?? ActionTypes.ADD_ENTREE, payload: newEntree })
      }

      // Reset form & fermer modal
      setFormData({ fournisseurId: '', date: new Date().toISOString().split('T')[0], lignes: [] })
      setShowModal(false)
    } catch (e) {
      console.error(e)
      alert('Erreur: ' + (e?.message || 'inconnue'))
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

  // Calculer les statistiques globales
  const globalStats = useMemo(() => {
    let totalEntrees = filteredEntrees.length
    let totalPayees = 0
    let totalNonPayees = 0
    let totalValue = 0
    let totalValuePayees = 0
    let totalValueNonPayees = 0
    let totalProduits = 0
    
    filteredEntrees.forEach(entree => {
      const paye = Boolean(entree.paye)
      let entreeValue = 0
      
      if (!USE_SUPABASE && entree.lignes) {
        entreeValue = calculateEntreeValueLocal(entree)
        totalProduits += entree.lignes.reduce((sum, l) => sum + (l.quantite || 0), 0)
      } else {
        // Pour Supabase, on essaie d'estimer en utilisant les produits connus si possible
        // Mais on ne peut pas vraiment calculer sans charger les détails
        // Donc on compte seulement les entrées où les détails sont déjà chargés
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
      tauxPaye
    }
  }, [filteredEntrees, detail, calculateEntreeValueLocal])

  const handleDeleteEntree = async (entreeId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) return
    if (USE_SUPABASE) {
      // supprime l’entrée (les lignes devraient avoir ON DELETE CASCADE si le FK est bien configuré)
      const { error } = await dataCtx?.supabase?.from('entrees').delete().eq('id', entreeId)
      if (error) {
        alert('Erreur: ' + error.message)
      } else {
        await dataCtx?.fetchEntrees?.()
      }
    } else {
      dataCtx?.dispatch?.({ type: dataCtx?.ActionTypes?.DELETE_ENTREE ?? ActionTypes.DELETE_ENTREE, payload: entreeId })
    }
  }

  // ----- DETAILS D’UNE ENTRÉE (SUPABASE) -----
  const showDetails = async (id) => {
    if (!USE_SUPABASE) return
    const rows = await dataCtx?.fetchEntreeDetails?.(id)
    setDetail({ openFor: id, rows: rows || [] })
  }

  // ----- RENDU -----
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">📥 Entrées de Stock</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouvelle Entrée</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-3 border-gray-300 shadow-lg p-5">
        <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-blue-500 text-white p-2 rounded-lg">🔍</span>
          <span>Filtres de Recherche</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 rounded-lg p-3 border-2 border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
              <span>🏢</span>
              <span>Fournisseur</span>
            </label>
            <select
              value={filters.fournisseurId}
              onChange={(e) => setFilters({ ...filters, fournisseurId: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg py-2.5 px-3 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            >
              <option value="">Tous les fournisseurs</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
          <div className="bg-white/80 rounded-lg p-3 border-2 border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
              <span>📅</span>
              <span>Date début</span>
            </label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg py-2.5 px-3 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>
          <div className="bg-white/80 rounded-lg p-3 border-2 border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
              <span>📅</span>
              <span>Date fin</span>
            </label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg py-2.5 px-3 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>
        </div>
        {(filters.fournisseurId || filters.dateStart || filters.dateEnd) && (
          <button
            onClick={() => setFilters({ fournisseurId: '', dateStart: '', dateEnd: '' })}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* Résumé Global */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-white p-2 rounded-lg shadow-sm">📊</span>
          <span>Résumé Global</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-blue-500 text-white p-2 rounded-lg text-xl">📦</span>
              <span className="text-xs text-blue-700 font-semibold bg-blue-300 px-2 py-1 rounded-full">
                Total Entrées
              </span>
            </div>
            <p className="text-3xl font-extrabold text-blue-800 mb-1">{globalStats.totalEntrees}</p>
            <p className="text-xs text-blue-600 mt-2">
              {globalStats.totalPayees} payées / {globalStats.totalNonPayees} non payées
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-green-500 text-white p-2 rounded-lg text-xl">💰</span>
              <span className="text-xs text-green-700 font-semibold bg-green-300 px-2 py-1 rounded-full">
                Valeur Totale
              </span>
            </div>
            <p className="text-3xl font-extrabold text-green-800 mb-1">{globalStats.totalValue.toFixed(2)} DA</p>
            <p className="text-xs text-green-600 mt-2">
              {globalStats.tauxPaye.toFixed(1)}% d'entrées payées
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-purple-500 text-white p-2 rounded-lg text-xl">📋</span>
              <span className="text-xs text-purple-700 font-semibold bg-purple-300 px-2 py-1 rounded-full">
                Produits Reçus
              </span>
            </div>
            <p className="text-3xl font-extrabold text-purple-800 mb-1">{globalStats.totalProduits}</p>
            <p className="text-xs text-purple-600 mt-2">
              Unités totales reçues
            </p>
          </div>
        </div>
        
        {/* Statistiques détaillées */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t-2 border-gray-400">
          <div className="bg-white/90 rounded-lg p-3 text-center border border-gray-300 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Valeur Payée</p>
            <p className="text-xl font-bold text-green-700">{globalStats.totalValuePayees.toFixed(2)} DA</p>
          </div>
          <div className="bg-white/90 rounded-lg p-3 text-center border border-gray-300 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Valeur Non Payée</p>
            <p className="text-xl font-bold text-red-700">{globalStats.totalValueNonPayees.toFixed(2)} DA</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border-2 border-blue-300 shadow-sm">
            <p className="text-xs text-blue-600 mb-1 font-medium">Entrées Payées</p>
            <p className="text-xl font-bold text-blue-800">{globalStats.totalPayees}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center border-2 border-orange-300 shadow-sm">
            <p className="text-xs text-orange-600 mb-1 font-medium">Entrées Non Payées</p>
            <p className="text-xl font-bold text-orange-800">{globalStats.totalNonPayees}</p>
          </div>
        </div>
      </div>

      {/* Liste des entrées */}
      <div className="space-y-4">
        {(!filteredEntrees || filteredEntrees.length === 0) ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucune entrée trouvée</p>
          </div>
        ) : (
          filteredEntrees.map((entree) => {
            // MODE LOCAL : calcul à partir des lignes stockées
            const entreeValueLocal = USE_SUPABASE ? null : calculateEntreeValueLocal(entree)
            // Champs différents selon la source
            const id = entree.id
            const date = entree.date
            const fournisseurId = entree.fournisseur_id ?? entree.fournisseurId
            const paye = Boolean(entree.paye)

            // Calculer le total pour Supabase aussi si les lignes sont ouvertes
            let entreeValueTotal = entreeValueLocal
            if (USE_SUPABASE && detail.openFor === id && detail.rows.length > 0) {
              entreeValueTotal = detail.rows.reduce((sum, l) => {
                const prix = l.produit_id?.prix_achat ?? 0
                return sum + (l.quantite * prix)
              }, 0)
            }

            return (
              <div key={id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-4 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300 p-6 mb-6">
                {/* En-tête de l'entrée */}
                <div className="flex justify-between items-start mb-4 pb-4 border-b-3 border-gray-300">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-500 text-white p-3 rounded-xl shadow-lg">
                        <span className="text-2xl">📦</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-gray-900">
                          Entrée #{id.slice(0, 8)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">ID: {id}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-blue-600 mb-1 font-semibold flex items-center gap-1">
                          <span>📅</span>
                          <span>Date</span>
                        </p>
                        <p className="text-base font-bold text-blue-900">{date}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-purple-600 mb-1 font-semibold flex items-center gap-1">
                          <span>🏢</span>
                          <span>Fournisseur</span>
                        </p>
                        <p className="text-base font-bold text-purple-900">{getFournisseurName(fournisseurId)}</p>
                      </div>
                      {(entreeValueTotal !== null && entreeValueTotal > 0) && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-4 shadow-sm">
                          <p className="text-xs text-green-600 mb-1 font-semibold flex items-center gap-1">
                            <span>💰</span>
                            <span>Montant total</span>
                          </p>
                          <p className="text-lg font-extrabold text-green-800">{entreeValueTotal.toFixed(2)} DA</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badge de statut et actions */}
                  <div className="flex flex-col items-end gap-3 ml-6">
                    <span
                      className={`px-5 py-3 rounded-xl text-sm font-extrabold whitespace-nowrap shadow-lg border-3 ${
                        paye 
                          ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-800 border-green-400' 
                          : 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 border-red-400'
                      }`}
                    >
                      {paye ? '✅ Payé' : '⏳ Non Payé'}
                    </span>

                    {/* Groupe de boutons d'action */}
                    <div className="flex flex-col gap-2 w-full min-w-[140px]">
                      {USE_SUPABASE && (
                        <button
                          onClick={() => showDetails(id)}
                          className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 ${
                            detail.openFor === id
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                              : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-2 border-blue-300 hover:from-blue-200 hover:to-blue-300'
                          }`}
                        >
                          <span>{detail.openFor === id ? '▼' : '▶'}</span>
                          <span>{detail.openFor === id ? 'Masquer' : 'Voir'} lignes</span>
                        </button>
                      )}

                      {isAdmin() && (
                        <button
                          onClick={() => handleDeleteEntree(id)}
                          className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <span>🗑️</span>
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lignes de produits */}
                {((!USE_SUPABASE && entree.lignes?.length > 0) || (USE_SUPABASE && detail.openFor === id && detail.rows.length > 0)) && (
                  <div className="mt-5 pt-5 border-t-3 border-gray-300">
                    <h4 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2 bg-white p-3 rounded-xl border-2 border-gray-300 shadow-sm">
                      <span className="bg-blue-500 text-white p-2 rounded-lg">📋</span>
                      <span>Produits ({!USE_SUPABASE ? entree.lignes?.length : detail.rows.length})</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {!USE_SUPABASE && entree.lignes?.map((ligne, idx) => {
                        const produitNom = getProduitName(ligne.produitId)
                        const prixUnitaire = getProduitPrixAchat(ligne.produitId)
                        const ligneValue = ligne.quantite * prixUnitaire
                        return (
                          <div key={idx} className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-3 border-indigo-300 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex justify-between items-start mb-3 pb-2 border-b-2 border-indigo-200">
                              <h5 className="font-extrabold text-gray-900 text-base">{produitNom}</h5>
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">#{idx + 1}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Quantité</p>
                                <p className="font-extrabold text-blue-700 text-base">{ligne.quantite}</p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Prix unitaire</p>
                                <p className="font-extrabold text-gray-800 text-base">{prixUnitaire.toFixed(2)} DA</p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Total</p>
                                <p className="font-extrabold text-green-700 text-base">{ligneValue.toFixed(2)} DA</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {USE_SUPABASE && detail.rows.map((l) => {
                        const label = l.produit_id?.nom || (l.variante_id ? `${l.variante_id.modele || ''} ${l.variante_id.taille || ''} ${l.variante_id.couleur || ''}`.trim() : '—')
                        const prixUnitaire = l.produit_id?.prix_achat ?? 0
                        const ligneValue = l.quantite * prixUnitaire
                        return (
                          <div key={l.id} className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-3 border-indigo-300 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex justify-between items-start mb-3 pb-2 border-b-2 border-indigo-200">
                              <h5 className="font-extrabold text-gray-900 text-base">{label}</h5>
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">#{l.id.slice(0, 6)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Quantité</p>
                                <p className="font-extrabold text-blue-700 text-base">{l.quantite}</p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Prix unitaire</p>
                                <p className="font-extrabold text-gray-800 text-base">{prixUnitaire.toFixed(2)} DA</p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Total</p>
                                <p className="font-extrabold text-green-700 text-base">{ligneValue.toFixed(2)} DA</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {USE_SUPABASE && detail.openFor === id && detail.rows.length === 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-yellow-700">⚠️ Aucune ligne de produit enregistrée pour cette entrée</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal d'ajout */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nouvelle Entrée de Stock</h3>

            <div className="space-y-4">
              {/* Fournisseur */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Fournisseur *</label>
                <select
                  value={formData.fournisseurId}
                  onChange={(e) => setFormData({ ...formData, fournisseurId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              {/* Ligne en cours */}
              <div className="border-t pt-4">
                <h4 className="text-md font-semibold mb-3">Ajouter une ligne</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Produit</label>
                    <select
                      value={currentLigne.produitId}
                      onChange={(e) => setCurrentLigne({ ...currentLigne, produitId: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
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
                    <label className="block text-sm font-medium text-gray-700">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      value={currentLigne.quantite}
                      onChange={(e) => setCurrentLigne({ ...currentLigne, quantite: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddLigne}
                  className="mt-3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  + Ajouter cette ligne
                </button>
              </div>

              {/* Lignes ajoutées */}
              {formData.lignes.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-md font-semibold mb-3">Lignes ajoutées ({formData.lignes.length})</h4>
                  <div className="space-y-2">
                    {formData.lignes.map((ligne, idx) => {
                      const produit = produits.find((p) => p.id === ligne.produitId)
                      return (
                        <div key={idx} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                          <div className="text-sm">
                            {produit?.nom || 'Produit inconnu'}
                            <span className="ml-3 text-blue-600">Qté: {ligne.quantite}</span>
                          </div>
                          {isAdmin() && (
                            <button onClick={() => handleDeleteLigne(idx)} className="text-red-600 hover:text-red-800">
                              Supprimer
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({ fournisseurId: '', date: new Date().toISOString().split('T')[0], lignes: [] })
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>

              <button
                disabled={creating}
                onClick={handleAddEntree}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {creating ? 'Enregistrement…' : "Enregistrer l'entrée"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Entries
