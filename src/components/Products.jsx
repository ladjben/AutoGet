import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';

const Products = () => {
  const dataCtx = useData();
  const state = dataCtx?.state
    ?? {
      produits: dataCtx?.produits ?? [],
      fournisseurs: dataCtx?.fournisseurs ?? [],
      entrees: dataCtx?.entrees ?? [],
      paiements: dataCtx?.paiements ?? [],
      depenses: dataCtx?.depenses ?? []
    };
  const dispatch = dataCtx?.dispatch;
  const generateId = dataCtx?.generateId;
  const addProduit = dataCtx?.addProduit;
  const updateProduit = dataCtx?.updateProduit;
  const deleteProduit = dataCtx?.deleteProduit;
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    reference: '',
    prixAchat: ''
  });

  // Statistiques globales
  const stats = useMemo(() => {
    const produits = state.produits || [];
    const totalProduits = produits.length;
    const valeurTotale = produits.reduce((sum, p) => {
      const prix = p.prix_achat ?? p.prixAchat ?? 0;
      return sum + prix;
    }, 0);
    const prixMoyen = totalProduits > 0 ? valeurTotale / totalProduits : 0;
    const prixMax = produits.length > 0 ? Math.max(...produits.map(p => p.prix_achat ?? p.prixAchat ?? 0)) : 0;
    const prixMin = produits.length > 0 ? Math.min(...produits.map(p => p.prix_achat ?? p.prixAchat ?? 0).filter(p => p > 0)) : 0;
    
    return {
      totalProduits,
      valeurTotale,
      prixMoyen,
      prixMax,
      prixMin
    };
  }, [state.produits]);

  const handleAddProduit = async () => {
    if (!formData.nom || !formData.prixAchat) {
      alert('Veuillez remplir les champs obligatoires (nom, prix d\'achat)');
      return;
    }

    if (USE_SUPABASE) {
      await addProduit(formData.nom, formData.reference, parseFloat(formData.prixAchat));
    } else {
      const newProduit = {
        id: generateId(),
        nom: formData.nom,
        reference: formData.reference,
        prixAchat: parseFloat(formData.prixAchat)
      };
      dispatch({ type: ActionTypes.ADD_PRODUIT, payload: newProduit });
    }
    resetForm();
    setShowModal(false);
  };

  const handleUpdateProduit = async () => {
    if (!formData.nom || !formData.prixAchat) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    if (USE_SUPABASE) {
      const prix_achat = parseFloat(formData.prixAchat)
      await dataCtx?.updateProduit?.(editingProduit.id, {
        nom: formData.nom,
        reference: formData.reference,
        prix_achat,
      })
      resetForm()
      setShowModal(false)
      setEditingProduit(null)
    } else {
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
    }
  };

  const handleDeleteProduit = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteProduit?.(id);
      } else {
        dispatch?.({ type: ActionTypes.DELETE_PRODUIT, payload: id });
      }
    } catch (e) {
      alert('Erreur lors de la suppression: ' + (e?.message || 'inconnue'));
      console.error('Erreur deleteProduit:', e);
    }
  };

  const openEditModal = (produit) => {
    setEditingProduit(produit);
    setFormData({
      nom: produit.nom,
      reference: produit.reference || '',
      prixAchat: produit.prix_achat ?? produit.prixAchat ?? ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ nom: '', reference: '', prixAchat: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">📦 Produits</h1>
        <button
          onClick={() => {
            setEditingProduit(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouveau Produit</span>
        </button>
      </div>

      {/* Résumé Global */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-white p-2 rounded-lg shadow-sm">📊</span>
          <span>Résumé Global</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-blue-500 text-white p-2 rounded-lg text-xl">📦</span>
              <span className="text-xs text-blue-700 font-semibold bg-blue-300 px-2 py-1 rounded-full">
                Total Produits
              </span>
            </div>
            <p className="text-2xl font-extrabold text-blue-800">{stats.totalProduits}</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-green-500 text-white p-2 rounded-lg text-xl">💰</span>
              <span className="text-xs text-green-700 font-semibold bg-green-300 px-2 py-1 rounded-full">
                Valeur Totale
              </span>
            </div>
            <p className="text-2xl font-extrabold text-green-800">{stats.valeurTotale.toFixed(2)} DA</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-purple-500 text-white p-2 rounded-lg text-xl">📊</span>
              <span className="text-xs text-purple-700 font-semibold bg-purple-300 px-2 py-1 rounded-full">
                Prix Moyen
              </span>
            </div>
            <p className="text-2xl font-extrabold text-purple-800">{stats.prixMoyen.toFixed(2)} DA</p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-100 to-orange-200 border-3 border-orange-400 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-orange-500 text-white p-2 rounded-lg text-xl">⬆️</span>
              <span className="text-xs text-orange-700 font-semibold bg-orange-300 px-2 py-1 rounded-full">
                Prix Max
              </span>
            </div>
            <p className="text-2xl font-extrabold text-orange-800">{stats.prixMax.toFixed(2)} DA</p>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-100 to-indigo-200 border-3 border-indigo-400 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-indigo-500 text-white p-2 rounded-lg text-xl">⬇️</span>
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-300 px-2 py-1 rounded-full">
                Prix Min
              </span>
            </div>
            <p className="text-2xl font-extrabold text-indigo-800">{stats.prixMin.toFixed(2)} DA</p>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {state.produits.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucun produit enregistré</p>
          </div>
        ) : (
          state.produits.map((produit) => (
            <div key={produit.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-4 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-500 text-white p-3 rounded-xl shadow-lg">
                      <span className="text-2xl">👟</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-gray-900">{produit.nom}</h3>
                      {produit.reference && (
                        <p className="text-xs text-gray-500 mt-1">Référence: {produit.reference}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-green-600 mb-1 font-semibold flex items-center gap-1">
                        <span>💰</span>
                        <span>Prix d'achat</span>
                      </p>
                      <p className="text-xl font-extrabold text-green-800">
                        {produit.prix_achat ?? produit.prixAchat ?? 0} DA
                      </p>
                    </div>
                    {produit.reference && (
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-purple-600 mb-1 font-semibold flex items-center gap-1">
                          <span>🏷️</span>
                          <span>Référence</span>
                        </p>
                        <p className="text-base font-bold text-purple-900">{produit.reference}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-6">
                  <button
                    onClick={() => openEditModal(produit)}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    <span>✏️</span>
                    <span>Éditer</span>
                  </button>
                  {isAdmin() && (
                    <button
                      onClick={() => handleDeleteProduit(produit.id)}
                      className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <span>🗑️</span>
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
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
                <label className="block text-sm font-medium text-gray-700">Prix d'achat (DA) *</label>
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
