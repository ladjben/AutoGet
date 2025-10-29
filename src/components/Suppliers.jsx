import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';

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
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
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

  const calculateTotalDue = (fournisseurId) => {
    let total = 0;
    let filteredEntrees = state.entrees || [];
    
    // Filtrer par fournisseur si sélectionné
    if (filters.fournisseurId) {
      filteredEntrees = filteredEntrees.filter(e => {
        const fId = e.fournisseur_id ?? e.fournisseurId;
        return fId === filters.fournisseurId;
      });
    }
    
    // Filtrer par date si sélectionné
    if (filters.dateStart && filters.dateEnd) {
      filteredEntrees = filteredEntrees.filter(e => {
        const entreeDate = e.date;
        return entreeDate >= filters.dateStart && entreeDate <= filters.dateEnd;
      });
    }
    
    filteredEntrees.forEach(entree => {
      const fId = entree.fournisseur_id ?? entree.fournisseurId;
      if (fId === fournisseurId && !entree.paye) {
        let entreeValue = 0;
        entree.lignes?.forEach(ligne => {
          const produit = (state.produits || []).find(p => p.id === ligne.produitId);
          if (produit) {
            entreeValue += ligne.quantite * (produit.prix_achat ?? produit.prixAchat ?? 0);
          }
        });
        total += entreeValue;
      }
    });
    return total;
  };

  const calculateTotalPaye = (fournisseurId) => {
    let total = 0;
    let filteredPaiements = state.paiements || [];
    
    // Filtrer par fournisseur si sélectionné
    if (filters.fournisseurId) {
      filteredPaiements = filteredPaiements.filter(p => p.fournisseurId === filters.fournisseurId || p.fournisseur_id === filters.fournisseurId);
    }
    
    // Filtrer par date si sélectionné
    if (filters.dateStart && filters.dateEnd) {
      filteredPaiements = filteredPaiements.filter(p => {
        const paiementDate = p.date;
        return paiementDate >= filters.dateStart && paiementDate <= filters.dateEnd;
      });
    }
    
    filteredPaiements.forEach(paiement => {
      const fId = paiement.fournisseur_id ?? paiement.fournisseurId;
      if (fId === fournisseurId) {
        total += paiement.montant || 0;
      }
    });
    return total;
  };

  // Calculer les totaux globaux
  const globalTotals = useMemo(() => {
    let totalDueGlobal = 0;
    let totalPayeGlobal = 0;
    
    (state.fournisseurs || []).forEach(fournisseur => {
      totalDueGlobal += calculateTotalDue(fournisseur.id);
      totalPayeGlobal += calculateTotalPaye(fournisseur.id);
    });
    
    return {
      totalDue: totalDueGlobal,
      totalPaye: totalPayeGlobal,
      reste: totalDueGlobal - totalPayeGlobal
    };
  }, [state.fournisseurs, state.entrees, state.paiements, filters]);

  // Filtrer les fournisseurs
  const filteredFournisseurs = useMemo(() => {
    if (!filters.fournisseurId) return state.fournisseurs || [];
    return (state.fournisseurs || []).filter(f => f.id === filters.fournisseurId);
  }, [state.fournisseurs, filters.fournisseurId]);

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
    if (!paiementData.fournisseurId || !paiementData.montant) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (USE_SUPABASE) {
      await addPaiement(
        paiementData.fournisseurId,
        parseFloat(paiementData.montant),
        paiementData.date,
        paiementData.description || ''
      );
    } else {
      const newPaiement = {
        id: generateId(),
        fournisseurId: paiementData.fournisseurId,
        montant: parseFloat(paiementData.montant),
        date: paiementData.date,
        description: paiementData.description || ''
      };
      dispatch({ type: ActionTypes.ADD_PAIEMENT, payload: newPaiement });
    }

    setPaiementData({
      fournisseurId: '',
      montant: '',
      date: new Date().toISOString().split('T')[0],
      description: ''
    });
    setShowPaiementModal(false);
  };

  const handleDeletePaiement = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      dispatch?.({ type: ActionTypes.DELETE_PAIEMENT, payload: id });
    }
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = (state.fournisseurs || []).find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  // Filtrer les paiements pour un fournisseur avec filtres de date
  const getFilteredPaiements = (fournisseurId) => {
    let paiements = (state.paiements || []).filter(p => {
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

      {/* Résumé Global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium mb-1">Total Dû (Tous)</p>
              <p className="text-2xl font-bold text-red-700">{globalTotals.totalDue.toFixed(2)} DA</p>
            </div>
            <span className="text-3xl">💸</span>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium mb-1">Total Payé (Tous)</p>
              <p className="text-2xl font-bold text-green-700">{globalTotals.totalPaye.toFixed(2)} DA</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
        <div className={`bg-gradient-to-r rounded-lg p-4 shadow-sm border-2 ${
          globalTotals.reste > 0
            ? 'from-orange-50 to-orange-100 border-orange-300'
            : 'from-blue-50 to-blue-100 border-blue-300'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-1 ${
                globalTotals.reste > 0 ? 'text-orange-600' : 'text-blue-600'
              }`}>Reste à Payer (Tous)</p>
              <p className={`text-2xl font-bold ${
                globalTotals.reste > 0 ? 'text-orange-700' : 'text-blue-700'
              }`}>{globalTotals.reste.toFixed(2)} DA</p>
            </div>
            <span className="text-3xl">{globalTotals.reste > 0 ? '⏳' : '🎉'}</span>
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

      {/* Liste des fournisseurs */}
      <div className="space-y-4">
        {filteredFournisseurs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          filteredFournisseurs.map((fournisseur) => {
            const totalDue = calculateTotalDue(fournisseur.id);
            const totalPaye = calculateTotalPaye(fournisseur.id);
            const reste = totalDue - totalPaye;
            const paiements = getFilteredPaiements(fournisseur.id);
            
            return (
              <div key={fournisseur.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">🏢</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{fournisseur.nom}</h3>
                        {fournisseur.contact && (
                          <p className="text-sm text-gray-600 mt-1">📞 {fournisseur.contact}</p>
                        )}
                        {fournisseur.adresse && (
                          <p className="text-sm text-gray-600 mt-1">📍 {fournisseur.adresse}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Résumé financier */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs text-red-600 mb-1">Total dû</p>
                        <p className="text-lg font-bold text-red-700">{totalDue.toFixed(2)} DA</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">Total payé</p>
                        <p className="text-lg font-bold text-green-700">{totalPaye.toFixed(2)} DA</p>
                      </div>
                      <div className={`rounded-lg p-3 border-2 ${
                        reste > 0
                          ? 'bg-orange-50 border-orange-300'
                          : 'bg-blue-50 border-blue-300'
                      }`}>
                        <p className={`text-xs mb-1 ${
                          reste > 0 ? 'text-orange-600' : 'text-blue-600'
                        }`}>Reste à payer</p>
                        <p className={`text-xl font-bold ${
                          reste > 0 ? 'text-orange-700' : 'text-blue-700'
                        }`}>{reste.toFixed(2)} DA</p>
                      </div>
                    </div>
                  </div>

                  {isAdmin() && (
                    <button
                      onClick={() => handleDeleteFournisseur(fournisseur.id)}
                      className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <span>🗑️</span>
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>

                {/* Historique des paiements */}
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>💰</span>
                    <span>Historique des paiements ({paiements.length})</span>
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
