import { useData, ActionTypes } from '../context/DataContext';
import { useState } from 'react';

const Products = () => {
  const { state, dispatch, generateId } = useData();
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    reference: '',
    prixAchat: ''
  });

  const handleAddProduit = () => {
    if (!formData.nom || !formData.prixAchat) {
      alert('Veuillez remplir les champs obligatoires (nom, prix d\'achat)');
      return;
    }

    const newProduit = {
      id: generateId(),
      nom: formData.nom,
      reference: formData.reference,
      prixAchat: parseFloat(formData.prixAchat)
    };

    dispatch({ type: ActionTypes.ADD_PRODUIT, payload: newProduit });
    resetForm();
    setShowModal(false);
  };

  const handleUpdateProduit = () => {
    if (!formData.nom || !formData.prixAchat) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    const updatedProduit = {
      ...editingProduit,
      nom: formData.nom,
      reference: formData.reference,
      prixAchat: parseFloat(formData.prixAchat)
    };

    dispatch({ type: ActionTypes.UPDATE_PRODUIT, payload: updatedProduit });
    resetForm();
    setShowModal(false);
    setEditingProduit(null);
  };

  const handleDeleteProduit = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      dispatch({ type: ActionTypes.DELETE_PRODUIT, payload: id });
    }
  };

  const openEditModal = (produit) => {
    setEditingProduit(produit);
    setFormData({
      nom: produit.nom,
      reference: produit.reference || '',
      prixAchat: produit.prixAchat
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ nom: '', reference: '', prixAchat: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Produits</h1>
        <button
          onClick={() => {
            setEditingProduit(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          + Nouveau Produit
        </button>
      </div>

      {/* Products List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="divide-y divide-gray-200">
          {state.produits.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucun produit enregistré
            </div>
          ) : (
            state.produits.map((produit) => (
              <div key={produit.id} className="p-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{produit.nom}</h3>
                    <div className="mt-2 text-sm text-gray-500">
                      <span>Référence: {produit.reference || 'N/A'}</span>
                      <span className="ml-4 text-blue-600 font-semibold">
                        Prix d'achat: {produit.prixAchat} €
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(produit)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      ✏️ Éditer
                    </button>
                    <button
                      onClick={() => handleDeleteProduit(produit.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingProduit ? 'Modifier le Produit' : 'Nouveau Produit'}
            </h3>
            
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
                <label className="block text-sm font-medium text-gray-700">Référence</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Prix d'achat (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.prixAchat}
                  onChange={(e) => setFormData({ ...formData, prixAchat: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingProduit(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={editingProduit ? handleUpdateProduit : handleAddProduit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingProduit ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
