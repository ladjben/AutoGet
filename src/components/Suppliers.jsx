import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect, useCallback } from 'react';

const Suppliers = () => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
    depenses: dataCtx?.depenses ?? []
  };
  const dispatch = dataCtx?.dispatch;
  const generateId = dataCtx?.generateId;
  const addFournisseur = dataCtx?.addFournisseur;
  const addPaiement = dataCtx?.addPaiement;
  const deletePaiement = dataCtx?.deletePaiement;
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
  const [entreesDetails, setEntreesDetails] = useState({}); // { entreeId: lignes[] }
  const [loadingDetails, setLoadingDetails] = useState({});
  const [filters, setFilters] = useState({
    fournisseurId: '',
    dateStart: '',
    dateEnd: ''
  });
  const [formData, setFormData] = useState({
    nom: '',
    contact: '',
    adresse: ''
  });
  const [paiementData, setPaiementData] = useState({
    fournisseurId: '',
    montant: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Helper functions - déclarer en premier avec useCallback pour stabilité
  const getProduitPrixAchat = useCallback((produitId) => {
    const produit = (state.produits || []).find(p => p.id === produitId);
    return produit ? (produit.prix_achat ?? produit.prixAchat ?? 0) : 0;
  }, [state.produits]);

  // Récupérer toutes les entrées d'un fournisseur avec leurs détails
  const getFournisseurEntrees = useCallback((fournisseurId) => {
    let filteredEntrees = (state.entrees || []).filter(e => {
      const fId = e.fournisseur_id ?? e.fournisseurId;
      return fId === fournisseurId;
    });

    // Appliquer les filtres de date si présents
    if (filters.dateStart && filters.dateEnd) {
      filteredEntrees = filteredEntrees.filter(e => {
        const entreeDate = e.date;
        return entreeDate >= filters.dateStart && entreeDate <= filters.dateEnd;
      });
    }

    return filteredEntrees;
  }, [state.entrees, filters.dateStart, filters.dateEnd]);

  // Obtenir les lignes d'une entrée - DOIT être déclaré tôt car utilisé dans globalTotals
  const getEntreeLignes = useCallback((entree) => {
    if (!USE_SUPABASE && entree.lignes) {
      return entree.lignes;
    }
    return entreesDetails[entree.id] || [];
  }, [entreesDetails]);

  // Calculer la valeur d'une entrée
  const calculateEntreeValue = useCallback((entree) => {
    if (!USE_SUPABASE && entree.lignes) {
      // Mode local : lignes déjà incluses
      return entree.lignes.reduce((sum, ligne) => {
        return sum + (ligne.quantite || 0) * getProduitPrixAchat(ligne.produitId);
      }, 0);
    }
    
    // Mode Supabase : utiliser les détails chargés
    if (USE_SUPABASE && entreesDetails[entree.id]) {
      return entreesDetails[entree.id].reduce((sum, ligne) => {
        const prix = ligne.produit_id?.prix_achat ?? 0;
        return sum + (ligne.quantite || 0) * prix;
      }, 0);
    }
    
    return 0;
  }, [getProduitPrixAchat, entreesDetails]);

  const calculateTotalDue = useCallback((fournisseurId) => {
    let total = 0;
    const entrees = getFournisseurEntrees(fournisseurId);
    
    entrees.forEach(entree => {
      if (!entree.paye) {
        total += calculateEntreeValue(entree);
      }
    });
    return total;
  }, [getFournisseurEntrees, calculateEntreeValue]);

  const calculateTotalPaye = useCallback((fournisseurId) => {
    let total = 0;
    let filteredPaiements = state.paiements || [];
    
    // Filtrer par fournisseur si sélectionné
    if (filters.fournisseurId) {
      filteredPaiements = filteredPaiements.filter(p => {
        const pFId = p.fournisseur_id ?? p.fournisseurId;
        return pFId === filters.fournisseurId;
      });
    }
    
    // Filtrer par date si sélectionné
    if (filters.dateStart && filters.dateEnd) {
      filteredPaiements = filteredPaiements.filter(p => {
        const paiementDate = p.date;
        return paiementDate >= filters.dateStart && paiementDate <= filters.dateEnd;
      });
    }
    
    filteredPaiements.forEach(paiement => {
      // Mode Supabase: fournisseur_id, Mode Local: fournisseurId
      const fId = paiement.fournisseur_id ?? paiement.fournisseurId;
      if (fId === fournisseurId) {
        total += parseFloat(paiement.montant || 0);
      }
    });
    return total;
  }, [state.paiements, filters.fournisseurId, filters.dateStart, filters.dateEnd]);

  const getProduitName = useCallback((produitId) => {
    const produit = (state.produits || []).find(p => p.id === produitId);
    return produit ? produit.nom : 'Produit inconnu';
  }, [state.produits]);

  // Filtrer les fournisseurs - DOIT être déclaré avant globalTotals
  const filteredFournisseurs = useMemo(() => {
    if (!filters.fournisseurId) return state.fournisseurs || [];
    return (state.fournisseurs || []).filter(f => f.id === filters.fournisseurId);
  }, [state.fournisseurs, filters.fournisseurId]);

  // Filtrer les paiements pour un fournisseur avec filtres de date - DOIT être déclaré avant globalTotals
  const getFilteredPaiements = (fournisseurId) => {
    let paiements = (state.paiements || []).filter(p => {
      // Mode Supabase: fournisseur_id, Mode Local: fournisseurId
      const fId = p.fournisseur_id ?? p.fournisseurId;
      return fId === fournisseurId;
    });

    if (filters.dateStart && filters.dateEnd) {
      paiements = paiements.filter(p => {
        const paiementDate = p.date;
        return paiementDate >= filters.dateStart && paiementDate <= filters.dateEnd;
      });
    }

    return paiements.reverse();
  };

  // Calculer tous les totaux globaux
  const globalTotals = useMemo(() => {
    let totalDueGlobal = 0;
    let totalPayeGlobal = 0;
    let totalMarchandiseGlobal = 0;
    let totalEntrees = 0;
    let totalEntreesPayees = 0;
    let totalEntreesNonPayees = 0;
    let totalPaiements = 0;
    let totalProduitsReçus = 0;
    
    // Calculer pour chaque fournisseur
    filteredFournisseurs.forEach(fournisseur => {
      const due = calculateTotalDue(fournisseur.id);
      const paye = calculateTotalPaye(fournisseur.id);
      const entrees = getFournisseurEntrees(fournisseur.id);
      const marchandise = entrees.reduce((sum, e) => sum + calculateEntreeValue(e), 0);
      
      totalDueGlobal += due;
      totalPayeGlobal += paye;
      totalMarchandiseGlobal += marchandise;
      totalEntrees += entrees.length;
      totalEntreesPayees += entrees.filter(e => e.paye).length;
      totalEntreesNonPayees += entrees.filter(e => !e.paye).length;
      
      // Compter les produits dans les entrées
      entrees.forEach(entree => {
        const lignes = getEntreeLignes(entree);
        totalProduitsReçus += lignes.reduce((sum, ligne) => sum + (ligne.quantite || 0), 0);
      });
    });
    
    // Calculer les totaux des paiements
    let filteredPaiements = state.paiements || [];
    if (filters.fournisseurId) {
      filteredPaiements = filteredPaiements.filter(p => {
        const fId = p.fournisseur_id ?? p.fournisseurId;
        return fId === filters.fournisseurId;
      });
    }
    if (filters.dateStart && filters.dateEnd) {
      filteredPaiements = filteredPaiements.filter(p => {
        return p.date >= filters.dateStart && p.date <= filters.dateEnd;
      });
    }
    totalPaiements = filteredPaiements.length;
    
    // Statistiques additionnelles
    const fournisseursAvecDettes = filteredFournisseurs.filter(f => calculateTotalDue(f.id) > 0).length;
    const fournisseursEnAttente = filteredFournisseurs.filter(f => (calculateTotalDue(f.id) - calculateTotalPaye(f.id)) > 0).length;
    const moyenneDueParFournisseur = filteredFournisseurs.length > 0 ? totalDueGlobal / filteredFournisseurs.length : 0;
    const moyennePayeParFournisseur = filteredFournisseurs.length > 0 ? totalPayeGlobal / filteredFournisseurs.length : 0;
    const tauxPaiement = totalDueGlobal > 0 ? (totalPayeGlobal / totalDueGlobal) * 100 : 0;
    
    return {
      totalDue: totalDueGlobal,
      totalPaye: totalPayeGlobal,
      reste: totalDueGlobal - totalPayeGlobal,
      totalMarchandise: totalMarchandiseGlobal,
      totalEntrees,
      totalEntreesPayees,
      totalEntreesNonPayees,
      totalPaiements,
      totalProduitsReçus,
      fournisseursAvecDettes,
      fournisseursEnAttente,
      moyenneDueParFournisseur,
      moyennePayeParFournisseur,
      tauxPaiement
    };
  }, [
    state.fournisseurs,
    state.entrees,
    state.paiements,
    filters,
    filteredFournisseurs,
    entreesDetails,
    calculateTotalDue,
    calculateTotalPaye,
    getFournisseurEntrees,
    calculateEntreeValue,
    getEntreeLignes
  ]);

  // Charger automatiquement les détails des entrées non payées pour le calcul
  useEffect(() => {
    if (USE_SUPABASE && dataCtx?.fetchEntreeDetails) {
      // Charger les détails de toutes les entrées non payées une par une
      const loadAll = async () => {
        for (const entree of (state.entrees || [])) {
          if (!entree.paye && !entreesDetails[entree.id] && !loadingDetails[entree.id]) {
            await loadEntreeDetails(entree.id);
          }
        }
      };
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entrees]);

  const handleAddFournisseur = async () => {
    if (!formData.nom) {
      alert('Veuillez entrer un nom de fournisseur');
      return;
    }

    if (USE_SUPABASE) {
      await addFournisseur(formData.nom, formData.contact, formData.adresse);
    } else {
      const newFournisseur = {
        id: generateId(),
        nom: formData.nom,
        contact: formData.contact,
        adresse: formData.adresse
      };
      dispatch({ type: ActionTypes.ADD_FOURNISSEUR, payload: newFournisseur });
    }
    setFormData({ nom: '', contact: '', adresse: '' });
    setShowModal(false);
  };

  const handleDeleteFournisseur = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      dispatch?.({ type: ActionTypes.DELETE_FOURNISSEUR, payload: id });
    }
  };

  const handleAddPaiement = async () => {
    if (!paiementData.fournisseurId || !paiementData.montant || !paiementData.date) {
      alert('Veuillez remplir tous les champs obligatoires (Fournisseur, Montant, Date)');
      return;
    }

    try {
      if (USE_SUPABASE) {
        if (!addPaiement) {
          throw new Error('Fonction addPaiement non disponible');
        }
        
        // S'assurer que la date est au format YYYY-MM-DD
        const dateFormatted = paiementData.date.includes('T') 
          ? paiementData.date.split('T')[0] 
          : paiementData.date;
        
        await addPaiement(
          paiementData.fournisseurId,
          parseFloat(paiementData.montant),
          dateFormatted,
          paiementData.description || ''
        );
      } else {
        // Mode local
        const dateFormatted = paiementData.date.includes('T') 
          ? paiementData.date.split('T')[0] 
          : paiementData.date;
          
        const newPaiement = {
          id: generateId(),
          fournisseurId: paiementData.fournisseurId,
          montant: parseFloat(paiementData.montant),
          date: dateFormatted,
          description: paiementData.description || ''
        };
        dispatch({ type: ActionTypes.ADD_PAIEMENT, payload: newPaiement });
      }

      // Réinitialiser le formulaire
      setPaiementData({
        fournisseurId: '',
        montant: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setShowPaiementModal(false);
      
      // Rafraîchissement automatique géré par le contexte (fetchPaiements et fetchEntrees)
    } catch (e) {
      alert('Erreur lors de l\'enregistrement du paiement: ' + (e?.message || 'inconnue'));
      console.error('Erreur handleAddPaiement:', e);
    }
  };

  const handleDeletePaiement = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        if (!deletePaiement) {
          throw new Error('Fonction deletePaiement non disponible');
        }
        await deletePaiement(id);
      } else {
        // Mode local
        dispatch?.({ type: ActionTypes.DELETE_PAIEMENT, payload: id });
      }
      // Rafraîchissement automatique géré par le contexte
    } catch (e) {
      alert('Erreur lors de la suppression du paiement: ' + (e?.message || 'inconnue'));
      console.error('Erreur handleDeletePaiement:', e);
    }
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = (state.fournisseurs || []).find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  // Charger les détails d'une entrée (Supabase)
  const loadEntreeDetails = async (entreeId) => {
    if (!USE_SUPABASE || loadingDetails[entreeId] || entreesDetails[entreeId]) return;
    
    setLoadingDetails(prev => ({ ...prev, [entreeId]: true }));
    try {
      const details = await dataCtx?.fetchEntreeDetails?.(entreeId);
      setEntreesDetails(prev => ({ ...prev, [entreeId]: details || [] }));
    } catch (e) {
      console.error('Erreur chargement détails entrée:', e);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [entreeId]: false }));
    }
  };


  return (
    <div className="space-y-6">
      {/* En-tête avec actions */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">🏢 Fournisseurs</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowPaiementModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <span>💰</span>
            <span>Nouveau Paiement</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>Nouveau Fournisseur</span>
          </button>
        </div>
      </div>

      {/* Résumé Global Amélioré */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-white p-2 rounded-lg shadow-sm">📊</span>
          <span>Vue d'Ensemble Globale</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-100 to-red-200 border-3 border-red-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-red-500 text-white p-2 rounded-lg text-xl">💸</span>
              <span className="text-xs text-red-700 font-semibold bg-red-300 px-2 py-1 rounded-full">
                Total Dû
              </span>
            </div>
            <p className="text-3xl font-extrabold text-red-800 mb-1">{globalTotals.totalDue.toFixed(2)} DA</p>
            <p className="text-xs text-red-600 mt-2">
              {filteredFournisseurs.filter(f => calculateTotalDue(f.id) > 0).length} fournisseur{filteredFournisseurs.filter(f => calculateTotalDue(f.id) > 0).length !== 1 ? 's' : ''} avec dettes
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-green-500 text-white p-2 rounded-lg text-xl">✅</span>
              <span className="text-xs text-green-700 font-semibold bg-green-300 px-2 py-1 rounded-full">
                Total Payé
              </span>
            </div>
            <p className="text-3xl font-extrabold text-green-800 mb-1">{globalTotals.totalPaye.toFixed(2)} DA</p>
            <p className="text-xs text-green-600 mt-2">
              {globalTotals.totalPaye > 0 
                ? `${((globalTotals.totalPaye / (globalTotals.totalDue || 1)) * 100).toFixed(1)}% du total dû`
                : 'Aucun paiement enregistré'
              }
            </p>
          </div>
          <div className={`bg-gradient-to-br rounded-xl p-5 shadow-lg border-3 ${
            globalTotals.reste > 0
              ? 'from-orange-100 to-orange-200 border-orange-400'
              : 'from-emerald-100 to-emerald-200 border-emerald-400'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-white p-2 rounded-lg text-xl ${
                globalTotals.reste > 0 ? 'bg-orange-500' : 'bg-emerald-500'
              }`}>
                {globalTotals.reste > 0 ? '⏳' : '🎉'}
              </span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                globalTotals.reste > 0 
                  ? 'text-orange-700 bg-orange-300' 
                  : 'text-emerald-700 bg-emerald-300'
              }`}>
                {globalTotals.reste > 0 ? 'Reste à Payer' : 'Solde Positif'}
              </span>
            </div>
            <p className={`text-3xl font-extrabold mb-1 ${
              globalTotals.reste > 0 ? 'text-orange-800' : 'text-emerald-800'
            }`}>
              {Math.abs(globalTotals.reste).toFixed(2)} DA
            </p>
            <p className={`text-xs mt-2 ${
              globalTotals.reste > 0 ? 'text-orange-600' : 'text-emerald-600'
            }`}>
              {globalTotals.reste > 0 
                ? `${filteredFournisseurs.filter(f => (calculateTotalDue(f.id) - calculateTotalPaye(f.id)) > 0).length} fournisseur${filteredFournisseurs.filter(f => (calculateTotalDue(f.id) - calculateTotalPaye(f.id)) > 0).length !== 1 ? 's' : ''} en attente`
                : '✅ Toutes les dettes sont payées'
              }
            </p>
          </div>
        </div>
        
        {/* Statistiques additionnelles - Ligne 1 */}
        <div className="mt-4 pt-4 border-t-2 border-gray-400 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white/90 rounded-lg p-3 text-center border border-gray-300 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Total Fournisseurs</p>
            <p className="text-xl font-bold text-gray-900">{filteredFournisseurs.length}</p>
            <p className="text-xs text-gray-400 mt-1">Actifs</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border-2 border-blue-300 shadow-sm">
            <p className="text-xs text-blue-600 mb-1 font-medium">Entrées Totales</p>
            <p className="text-xl font-bold text-blue-800">{globalTotals.totalEntrees}</p>
            <p className="text-xs text-blue-500 mt-1">
              {globalTotals.totalEntreesPayees} payées / {globalTotals.totalEntreesNonPayees} non payées
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border-2 border-green-300 shadow-sm">
            <p className="text-xs text-green-600 mb-1 font-medium">Paiements Totaux</p>
            <p className="text-xl font-bold text-green-800">{globalTotals.totalPaiements}</p>
            <p className="text-xs text-green-500 mt-1">Transactions</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center border-2 border-purple-300 shadow-sm">
            <p className="text-xs text-purple-600 mb-1 font-medium">Valeur Marchandise</p>
            <p className="text-xl font-bold text-purple-800">{globalTotals.totalMarchandise.toFixed(2)} DA</p>
            <p className="text-xs text-purple-500 mt-1">Total reçu</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-center border-2 border-indigo-300 shadow-sm">
            <p className="text-xs text-indigo-600 mb-1 font-medium">Produits Reçus</p>
            <p className="text-xl font-bold text-indigo-800">{globalTotals.totalProduitsReçus}</p>
            <p className="text-xs text-indigo-500 mt-1">Unités</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center border-2 border-yellow-300 shadow-sm">
            <p className="text-xs text-yellow-700 mb-1 font-medium">Taux Paiement</p>
            <p className="text-xl font-bold text-yellow-800">{globalTotals.tauxPaiement.toFixed(1)}%</p>
            <p className="text-xs text-yellow-600 mt-1">Pourcentage payé</p>
          </div>
        </div>

        {/* Statistiques additionnelles - Ligne 2 */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-red-50 rounded-lg p-3 text-center border-2 border-red-300 shadow-sm">
            <p className="text-xs text-red-600 mb-1 font-medium">Fournisseurs avec Dettes</p>
            <p className="text-xl font-bold text-red-800">{globalTotals.fournisseursAvecDettes}</p>
            <p className="text-xs text-red-500 mt-1">En attente paiement</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center border-2 border-orange-300 shadow-sm">
            <p className="text-xs text-orange-600 mb-1 font-medium">Fournisseurs en Attente</p>
            <p className="text-xl font-bold text-orange-800">{globalTotals.fournisseursEnAttente}</p>
            <p className="text-xs text-orange-500 mt-1">Non réglés</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-3 text-center border-2 border-cyan-300 shadow-sm">
            <p className="text-xs text-cyan-600 mb-1 font-medium">Moyenne Due/Fournisseur</p>
            <p className="text-xl font-bold text-cyan-800">{globalTotals.moyenneDueParFournisseur.toFixed(2)} DA</p>
            <p className="text-xs text-cyan-500 mt-1">Par fournisseur</p>
          </div>
          <div className="bg-teal-50 rounded-lg p-3 text-center border-2 border-teal-300 shadow-sm">
            <p className="text-xs text-teal-600 mb-1 font-medium">Moyenne Payée/Fournisseur</p>
            <p className="text-xl font-bold text-teal-800">{globalTotals.moyennePayeParFournisseur.toFixed(2)} DA</p>
            <p className="text-xs text-teal-500 mt-1">Par fournisseur</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-3 text-center border-2 border-pink-300 shadow-sm">
            <p className="text-xs text-pink-600 mb-1 font-medium">Entrées Payées</p>
            <p className="text-xl font-bold text-pink-800">{globalTotals.totalEntreesPayees}</p>
            <p className="text-xs text-pink-500 mt-1">
              {globalTotals.totalEntrees > 0 ? `${((globalTotals.totalEntreesPayees / globalTotals.totalEntrees) * 100).toFixed(1)}%` : '0%'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center border-2 border-slate-300 shadow-sm">
            <p className="text-xs text-slate-600 mb-1 font-medium">Entrées Non Payées</p>
            <p className="text-xl font-bold text-slate-800">{globalTotals.totalEntreesNonPayees}</p>
            <p className="text-xs text-slate-500 mt-1">
              {globalTotals.totalEntrees > 0 ? `${((globalTotals.totalEntreesNonPayees / globalTotals.totalEntrees) * 100).toFixed(1)}%` : '0%'}
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>🔍</span>
          <span>Filtres</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
            <select
              value={filters.fournisseurId}
              onChange={(e) => setFilters({ ...filters, fournisseurId: e.target.value })}
              className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
            >
              <option value="">Tous les fournisseurs</option>
              {(state.fournisseurs || []).map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date début</label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date fin</label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
            />
          </div>
        </div>
        {(filters.fournisseurId || filters.dateStart || filters.dateEnd) && (
          <button
            onClick={() => setFilters({ fournisseurId: '', dateStart: '', dateEnd: '' })}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Liste des fournisseurs - Grille de cartes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredFournisseurs.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          filteredFournisseurs.map((fournisseur) => {
            const totalDue = calculateTotalDue(fournisseur.id);
            const totalPaye = calculateTotalPaye(fournisseur.id);
            const reste = totalDue - totalPaye;
            const paiements = getFilteredPaiements(fournisseur.id);
            const entrees = getFournisseurEntrees(fournisseur.id);
            const entreesPayees = entrees.filter(e => e.paye).length;
            const entreesNonPayees = entrees.filter(e => !e.paye).length;
            const totalMarchandise = entrees.reduce((sum, e) => sum + calculateEntreeValue(e), 0);
            
            return (
              <div key={fournisseur.id} className="bg-white rounded-xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                {/* En-tête de la carte */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="bg-white/20 rounded-lg p-3">
                        <span className="text-3xl">🏢</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-1">{fournisseur.nom}</h3>
                        <div className="flex flex-col gap-1 text-sm text-blue-100">
                          {fournisseur.contact && <p>📞 {fournisseur.contact}</p>}
                          {fournisseur.adresse && <p>📍 {fournisseur.adresse}</p>}
                        </div>
                      </div>
                    </div>
                    {isAdmin() && (
                      <button
                        onClick={() => handleDeleteFournisseur(fournisseur.id)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                        title="Supprimer le fournisseur"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Statistiques rapides */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Entrées totales</p>
                      <p className="text-lg font-bold text-gray-900">{entrees.length}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {entreesPayees} payées / {entreesNonPayees} non payées
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="text-xs text-purple-600 mb-1">Paiements</p>
                      <p className="text-lg font-bold text-purple-700">{paiements.length}</p>
                      <p className="text-xs text-purple-400 mt-1">Transactions</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                      <p className="text-xs text-indigo-600 mb-1">Marchandise totale</p>
                      <p className="text-lg font-bold text-indigo-700">{totalMarchandise.toFixed(2)} DA</p>
                      <p className="text-xs text-indigo-400 mt-1">Valeur reçue</p>
                    </div>
                    <div className={`rounded-lg p-3 border-2 ${
                      reste > 0
                        ? 'bg-orange-50 border-orange-300'
                        : 'bg-blue-50 border-blue-300'
                    }`}>
                      <p className={`text-xs mb-1 ${
                        reste > 0 ? 'text-orange-600' : 'text-blue-600'
                      }`}>
                        {reste > 0 ? 'À payer' : 'Crédit'}
                      </p>
                      <p className={`text-lg font-bold ${
                        reste > 0 ? 'text-orange-700' : 'text-blue-700'
                      }`}>
                        {Math.abs(reste).toFixed(2)} DA
                      </p>
                      <p className={`text-xs mt-1 ${
                        reste > 0 ? 'text-orange-400' : 'text-blue-400'
                      }`}>
                        {reste > 0 ? 'En attente' : 'Surpayé'}
                      </p>
                    </div>
                  </div>

                  {/* Résumé financier principal */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-300">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span>💳</span>
                      <span>Résumé Financier</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 text-center">
                        <p className="text-xs text-red-600 mb-1 font-medium">Total Dû</p>
                        <p className="text-xl font-bold text-red-700">{totalDue.toFixed(2)} DA</p>
                        <p className="text-xs text-red-500 mt-1">{entreesNonPayees} entrée{entreesNonPayees !== 1 ? 's' : ''} non payée{entreesNonPayees !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-600 mb-1 font-medium">Total Payé</p>
                        <p className="text-xl font-bold text-green-700">{totalPaye.toFixed(2)} DA</p>
                        <p className="text-xs text-green-500 mt-1">{paiements.length} paiement{paiements.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className={`rounded-lg p-3 border-2 text-center ${
                        reste > 0
                          ? 'bg-orange-50 border-orange-400'
                          : 'bg-emerald-50 border-emerald-400'
                      }`}>
                        <p className={`text-xs mb-1 font-medium ${
                          reste > 0 ? 'text-orange-700' : 'text-emerald-700'
                        }`}>
                          {reste > 0 ? 'Reste à Payer' : 'Solde Positif'}
                        </p>
                        <p className={`text-xl font-bold ${
                          reste > 0 ? 'text-orange-800' : 'text-emerald-800'
                        }`}>
                          {Math.abs(reste).toFixed(2)} DA
                        </p>
                        <p className={`text-xs mt-1 ${
                          reste > 0 ? 'text-orange-600' : 'text-emerald-600'
                        }`}>
                          {reste > 0 ? '⚠️ En dette' : '✅ À jour'}
                        </p>
                      </div>
                    </div>
                  </div>

                {/* Entrées de stock détaillées */}
                <div className="border-t-2 border-gray-300 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                      <span className="bg-blue-100 p-2 rounded-lg">📦</span>
                      <span>Entrées de Stock <span className="text-blue-600">({entrees.length})</span></span>
                    </h4>
                    {entrees.length > 0 && (
                      <div className="text-right bg-purple-50 rounded-lg px-3 py-2 border border-purple-200">
                        <p className="text-xs text-purple-600 font-medium">Total valeur reçue</p>
                        <p className="text-lg font-bold text-purple-700">
                          {totalMarchandise.toFixed(2)} DA
                        </p>
                      </div>
                    )}
                  </div>
                  {getFournisseurEntrees(fournisseur.id).length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Aucune entrée enregistrée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getFournisseurEntrees(fournisseur.id).map((entree) => {
                        const entreeValue = calculateEntreeValue(entree);
                        const lignes = getEntreeLignes(entree);
                        const needsLoad = USE_SUPABASE && !entreesDetails[entree.id] && !loadingDetails[entree.id];
                        
                        return (
                          <div key={entree.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">📥</span>
                                  <h5 className="font-semibold text-gray-900">
                                    Entrée du {entree.date}
                                  </h5>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    entree.paye
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {entree.paye ? '✓ Payé' : 'Non Payé'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600">ID: {entree.id.slice(0, 8)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 mb-1">Montant total</p>
                                <p className="text-lg font-bold text-blue-700">
                                  {entreeValue.toFixed(2)} DA
                                </p>
                              </div>
                            </div>

                            {/* Produits dans cette entrée */}
                            {needsLoad && (
                              <button
                                onClick={() => loadEntreeDetails(entree.id)}
                                className="w-full text-sm text-blue-600 hover:text-blue-800 underline mb-2"
                              >
                                ▶ Charger les détails produits
                              </button>
                            )}

                            {loadingDetails[entree.id] && (
                              <p className="text-sm text-gray-500 text-center py-2">Chargement...</p>
                            )}

                            {lignes.length > 0 && (
                              <div className="mt-3 border-t border-blue-300 pt-3">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Produits ({lignes.length}):</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {lignes.map((ligne, idx) => {
                                    const produitNom = !USE_SUPABASE
                                      ? getProduitName(ligne.produitId)
                                      : ligne.produit_id?.nom || 'Produit inconnu';
                                    const quantite = ligne.quantite || 0;
                                    const prixUnitaire = !USE_SUPABASE
                                      ? getProduitPrixAchat(ligne.produitId)
                                      : ligne.produit_id?.prix_achat ?? 0;
                                    const ligneTotal = quantite * prixUnitaire;

                                    return (
                                      <div key={idx} className="bg-white rounded p-2 border border-blue-100">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">{produitNom}</p>
                                            <div className="flex gap-3 mt-1 text-xs">
                                              <span className="text-blue-600">Qté: {quantite}</span>
                                              <span className="text-gray-600">Prix: {prixUnitaire.toFixed(2)} DA</span>
                                            </div>
                                          </div>
                                          <p className="text-sm font-bold text-green-600">{ligneTotal.toFixed(2)} DA</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                                  <p className="text-xs font-semibold text-gray-700">Total de l'entrée:</p>
                                  <p className="text-base font-bold text-blue-700">{entreeValue.toFixed(2)} DA</p>
                                </div>
                              </div>
                            )}

                            {!needsLoad && lignes.length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-2">Aucun produit dans cette entrée</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Historique des paiements */}
                <div className="border-t-2 border-gray-300 pt-4">
                  <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 p-2 rounded-lg">💰</span>
                    <span>Historique des Paiements <span className="text-green-600">({paiements.length})</span></span>
                  </h4>
                  {paiements.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Aucun paiement enregistré</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paiements.map((paiement) => (
                        <div key={paiement.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">💵</span>
                            <div>
                              <p className="font-medium text-gray-900">{paiement.date}</p>
                              <p className="text-sm text-green-700 font-semibold">+{paiement.montant?.toFixed(2) || '0.00'} DA</p>
                              {paiement.description && (
                                <p className="text-xs text-gray-600 mt-1">{paiement.description}</p>
                              )}
                            </div>
                          </div>
                          {isAdmin() && (
                            <button
                              onClick={() => handleDeletePaiement(paiement.id)}
                              className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Ajout Fournisseur */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nouveau Fournisseur</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Contact</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Adresse</label>
                <textarea
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  rows="3"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ nom: '', contact: '', adresse: '' });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={handleAddFournisseur}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Paiement */}
      {showPaiementModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nouveau Paiement</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Fournisseur *</label>
                <select
                  value={paiementData.fournisseurId}
                  onChange={(e) => setPaiementData({ ...paiementData, fournisseurId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                >
                  <option value="">Sélectionner</option>
                  {(state.fournisseurs || []).map((fournisseur) => {
                    const due = calculateTotalDue(fournisseur.id);
                    return (
                      <option key={fournisseur.id} value={fournisseur.id}>
                        {fournisseur.nom} {due > 0 ? `(Dû: ${due.toFixed(2)}DA)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Montant (DA) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paiementData.montant}
                  onChange={(e) => setPaiementData({ ...paiementData, montant: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              {paiementData.fournisseurId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  {(() => {
                    const currentTotalDue = calculateTotalDue(paiementData.fournisseurId);
                    const currentTotalPaye = calculateTotalPaye(paiementData.fournisseurId);
                    const restantActuel = currentTotalDue - currentTotalPaye;
                    const montantPaiement = parseFloat(paiementData.montant) || 0;
                    const nouveauReste = restantActuel - montantPaiement;
                    
                    return (
                      <div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Reste actuel:</span>
                            <span className="font-semibold text-orange-600">{restantActuel.toFixed(2)} DA</span>
                          </div>
                          {montantPaiement > 0 && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Paiement:</span>
                                <span className="font-semibold text-green-600">-{montantPaiement.toFixed(2)} DA</span>
                              </div>
                              <div className="border-t pt-1 mt-1">
                                <div className="flex justify-between">
                                  <span className="font-semibold text-gray-800">Nouveau reste:</span>
                                  <span className={`font-bold text-lg ${nouveauReste > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {nouveauReste.toFixed(2)} DA
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Date *</label>
                <input
                  type="date"
                  value={paiementData.date}
                  onChange={(e) => setPaiementData({ ...paiementData, date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={paiementData.description}
                  onChange={(e) => setPaiementData({ ...paiementData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  rows="3"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPaiementModal(false);
                  setPaiementData({
                    fournisseurId: '',
                    montant: '',
                    date: new Date().toISOString().split('T')[0],
                    description: ''
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={handleAddPaiement}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
