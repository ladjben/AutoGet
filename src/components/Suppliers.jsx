import { useData, ActionTypes } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const Suppliers = () => {
  const { state, dispatch, generateId } = useData();
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
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
    state.entrees.forEach(entree => {
      if (entree.fournisseurId === fournisseurId && !entree.paye) {
        // Calculate entree value
        let entreeValue = 0;
        entree.lignes?.forEach(ligne => {
          const produit = state.produits.find(p => p.id === ligne.produitId);
          if (produit) {
            entreeValue += ligne.quantite * produit.prixAchat;
          }
        });
        total += entreeValue;
      }
    });
    return total;
  };

  const calculateTotalPaye = (fournisseurId) => {
    let total = 0;
    state.paiements.forEach(paiement => {
      if (paiement.fournisseurId === fournisseurId) {
        total += paiement.montant;
      }
    });
    return total;
  };

  const handleAddFournisseur = () => {
    if (!formData.nom) {
      alert('Veuillez entrer un nom de fournisseur');
      return;
    }

    const newFournisseur = {
      id: generateId(),
      nom: formData.nom,
      contact: formData.contact,
      adresse: formData.adresse
    };

    dispatch({ type: ActionTypes.ADD_FOURNISSEUR, payload: newFournisseur });
    setFormData({ nom: '', contact: '', adresse: '' });
    setShowModal(false);
  };

  const handleDeleteFournisseur = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      dispatch({ type: ActionTypes.DELETE_FOURNISSEUR, payload: id });
    }
  };

  const handleAddPaiement = () => {
    if (!paiementData.fournisseurId || !paiementData.montant) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newPaiement = {
      id: generateId(),
      fournisseurId: paiementData.fournisseurId,
      montant: parseFloat(paiementData.montant),
      date: paiementData.date,
      description: paiementData.description || ''
    };

    dispatch({ type: ActionTypes.ADD_PAIEMENT, payload: newPaiement });

    // Auto-mark entries as paid if full payment
    const totalDue = calculateTotalDue(paiementData.fournisseurId);
    const newAmount = parseFloat(paiementData.montant);
    const totalPaye = calculateTotalPaye(paiementData.fournisseurId);
    
    if (totalPaye + newAmount >= totalDue) {
      state.entrees.forEach(entree => {
        if (entree.fournisseurId === paiementData.fournisseurId && !entree.paye) {
          dispatch({ type: ActionTypes.MARK_ENTREE_PAYEE, payload: entree.id });
        }
      });
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
      dispatch({ type: ActionTypes.DELETE_PAIEMENT, payload: id });
    }
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = state.fournisseurs.find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Fournisseurs</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowPaiementModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            💰 Nouveau Paiement
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            + Nouveau Fournisseur
          </button>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="divide-y divide-gray-200">
          {state.fournisseurs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucun fournisseur enregistré
            </div>
          ) : (
            state.fournisseurs.map((fournisseur) => {
              const totalDue = calculateTotalDue(fournisseur.id);
              const totalPaye = calculateTotalPaye(fournisseur.id);
              
              return (
                <div key={fournisseur.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{fournisseur.nom}</h3>
                      {fournisseur.contact && <p className="text-sm text-gray-600">Contact: {fournisseur.contact}</p>}
                      {fournisseur.adresse && <p className="text-sm text-gray-600">Adresse: {fournisseur.adresse}</p>}
                      
                      <div className="mt-3 flex flex-col space-y-2">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-sm text-gray-500">Total dû:</span>
                            <span className="ml-2 text-lg font-bold text-red-600">
                              {totalDue.toFixed(2)} DA
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500">Total payé:</span>
                            <span className="ml-2 text-lg font-bold text-green-600">
                              {totalPaye.toFixed(2)} DA
                            </span>
                          </div>
                        </div>
                        <div className={`px-4 py-2 rounded-lg ${totalDue - totalPaye > 0 ? 'bg-orange-100 border border-orange-300' : 'bg-green-100 border border-green-300'}`}>
                          <span className="text-sm font-semibold text-gray-700">Reste à payer:</span>
                          <span className={`ml-2 text-xl font-bold ${totalDue - totalPaye > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {(totalDue - totalPaye).toFixed(2)} DA
                          </span>
                        </div>
                      </div>
                    </div>

                    {isAdmin() && (
                      <button
                        onClick={() => handleDeleteFournisseur(fournisseur.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        🗑️ Supprimer
                      </button>
                    )}
                  </div>

                  {/* Paiements historiques */}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Historique des paiements:</h4>
                    {state.paiements.filter(p => p.fournisseurId === fournisseur.id).length === 0 ? (
                      <p className="text-sm text-gray-500">Aucun paiement enregistré</p>
                    ) : (
                      <div className="space-y-2">
                        {state.paiements
                          .filter(p => p.fournisseurId === fournisseur.id)
                          .reverse()
                          .map((paiement) => (
                            <div key={paiement.id} className="bg-green-50 p-2 rounded flex justify-between items-center text-sm">
                              <div>
                                <span className="font-medium">{paiement.date}</span>
                                <span className="ml-3 text-green-700 font-semibold">+{paiement.montant.toFixed(2)} DA</span>
                                {paiement.description && <span className="ml-3 text-gray-600">{paiement.description}</span>}
                              </div>
                              {isAdmin() && (
                                <button
                                  onClick={() => handleDeletePaiement(paiement.id)}
                                  className="text-red-600 hover:text-red-800 text-xs"
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
      </div>

      {/* Add Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
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

      {/* Add Paiement Modal */}
      {showPaiementModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
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
                  {state.fournisseurs.map((fournisseur) => {
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

              {/* Affichage du reste à payer */}
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

