import { useData, ActionTypes } from '../context/DataContext';
import { useState } from 'react';

const Entries = () => {
  const { state, dispatch, generateId } = useData();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    fournisseurId: '',
    date: new Date().toISOString().split('T')[0],
    lignes: []
  });
  const [currentLigne, setCurrentLigne] = useState({
    produitId: '',
    quantite: ''
  });

  const handleAddEntree = () => {
    if (!formData.fournisseurId || formData.lignes.length === 0) {
      alert('Veuillez sélectionner un fournisseur et ajouter au moins une ligne');
      return;
    }

    const newEntree = {
      id: generateId(),
      date: formData.date,
      fournisseurId: formData.fournisseurId,
      lignes: formData.lignes,
      paye: false
    };

    dispatch({ type: ActionTypes.ADD_ENTREE, payload: newEntree });

    // Reset form
    setFormData({
      fournisseurId: '',
      date: new Date().toISOString().split('T')[0],
      lignes: []
    });
    setShowModal(false);
  };

  const handleAddLigne = () => {
    if (!currentLigne.produitId || !currentLigne.quantite) {
      alert('Veuillez remplir tous les champs de la ligne');
      return;
    }

    const ligne = {
      produitId: currentLigne.produitId,
      quantite: parseInt(currentLigne.quantite)
    };

    setFormData({
      ...formData,
      lignes: [...formData.lignes, ligne]
    });

    setCurrentLigne({
      produitId: '',
      quantite: ''
    });
  };

  const handleDeleteLigne = (index) => {
    setFormData({
      ...formData,
      lignes: formData.lignes.filter((_, i) => i !== index)
    });
  };

  const handleMarkPaye = (entreeId) => {
    if (window.confirm('Marquer cette entrée comme payée ?')) {
      dispatch({ type: ActionTypes.MARK_ENTREE_PAYEE, payload: entreeId });
    }
  };

  const handleDeleteEntree = (entreeId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
      dispatch({ type: ActionTypes.DELETE_ENTREE, payload: entreeId });
    }
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = state.fournisseurs.find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  const getProduitName = (produitId) => {
    const produit = state.produits.find(p => p.id === produitId);
    return produit ? produit.nom : 'Inconnu';
  };

  const calculateEntreeValue = (entree) => {
    let total = 0;
    entree.lignes?.forEach(ligne => {
      const produit = state.produits.find(p => p.id === ligne.produitId);
      if (produit) {
        total += ligne.quantite * produit.prixAchat;
      }
    });
    return total;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Entrées de Stock</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          + Nouvelle Entrée
        </button>
      </div>

      {/* Entries List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="divide-y divide-gray-200">
          {state.entrees.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucune entrée enregistrée
            </div>
          ) : (
            state.entrees.map((entree) => {
              const entreeValue = calculateEntreeValue(entree);
              return (
                <div key={entree.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        Date: {entree.date}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Fournisseur: {getFournisseurName(entree.fournisseurId)}
                      </p>
                      <p className="text-sm font-semibold text-blue-600 mt-1">
                        Montant total: {entreeValue.toFixed(2)} DA
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        entree.paye 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entree.paye ? '✓ Payé' : 'Non Payé'}
                      </span>
                      {!entree.paye && (
                        <button
                          onClick={() => handleMarkPaye(entree.id)}
                          className="text-sm text-green-600 hover:text-green-800"
                        >
                          Marquer Payé
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteEntree(entree.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>

                  {/* Lignes */}
                  <div className="ml-4 space-y-2">
                    {entree.lignes?.map((ligne, idx) => {
                      const produit = state.produits.find(p => p.id === ligne.produitId);
                      const ligneValue = ligne.quantite * (produit?.prixAchat || 0);
                      
                      return (
                        <div key={idx} className="bg-gray-50 p-3 rounded text-sm">
                          <span className="font-medium">{produit?.nom || 'Produit inconnu'}</span>
                          <span className="ml-3 text-blue-600">Qté: {ligne.quantite}</span>
                          <span className="ml-3 text-green-600">Valeur: {ligneValue.toFixed(2)} DA</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
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
                  {state.fournisseurs.map((fournisseur) => (
                    <option key={fournisseur.id} value={fournisseur.id}>
                      {fournisseur.nom}
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

              {/* Current Ligne */}
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
                      {state.produits.map((produit) => (
                        <option key={produit.id} value={produit.id}>
                          {produit.nom} - {produit.prixAchat}DA
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantité</label>
                    <input
                      type="number"
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
                      const produit = state.produits.find(p => p.id === ligne.produitId);
                      return (
                        <div key={idx} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                          <div className="text-sm">
                            {produit?.nom || 'Produit inconnu'}
                            <span className="ml-3 text-blue-600">Qté: {ligne.quantite}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteLigne(idx)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Supprimer
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({
                    fournisseurId: '',
                    date: new Date().toISOString().split('T')[0],
                    lignes: []
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={handleAddEntree}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Enregistrer l'entrée
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entries;
