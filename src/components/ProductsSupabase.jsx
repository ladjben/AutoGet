import { useData, ActionTypes } from '../context/DataContextSupabase';
import { useState } from 'react';
import { supabase } from '../config/supabase';

const Products = () => {
  const { state, dispatch, generateId, loadAllData } = useData();
  const [showModal, setShowModal] = useState(false);
  const [showVarianteModal, setShowVarianteModal] = useState(false);
  const [selectedProduitId, setSelectedProduitId] = useState(null);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    reference: '',
    prixAchat: ''
  });
  const [varianteData, setVarianteData] = useState({
    taille: '',
    couleur: '',
    modele: '',
    quantite: ''
  });

  const handleAddProduit = async () => {
    if (!formData.nom || !formData.prixAchat) {
      alert('Veuillez remplir les champs obligatoires (nom, prix d\'achat)');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('produits')
        .insert({
          nom: formData.nom,
          reference: formData.reference || null,
          prix_achat: parseFloat(formData.prixAchat)
        })
        .select()
        .single();

      if (error) throw error;

      const newProduit = {
        id: data.id,
        nom: data.nom,
        reference: data.reference,
        prixAchat: data.prix_achat,
        variantes: []
      };

      dispatch({ type: ActionTypes.ADD_PRODUIT, payload: newProduit });
      resetForm();
      setShowModal(false);
    } catch (error) {
      console.error('Error adding produit:', error);
      alert('Erreur lors de l\'ajout du produit');
    }
  };

  const handleUpdateProduit = async () => {
    if (!formData.nom || !formData.prixAchat) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      const { error } = await supabase
        .from('produits')
        .update({
          nom: formData.nom,
          reference: formData.reference || null,
          prix_achat: parseFloat(formData.prixAchat)
        })
        .eq('id', editingProduit.id);

      if (error) throw error;

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
    } catch (error) {
      console.error('Error updating produit:', error);
      alert('Erreur lors de la modification du produit');
    }
  };

  const handleDeleteProduit = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        const { error } = await supabase
          .from('produits')
          .delete()
          .eq('id', id);

        if (error) throw error;
        dispatch({ type: ActionTypes.DELETE_PRODUIT, payload: id });
      } catch (error) {
        console.error('Error deleting produit:', error);
        alert('Erreur lors de la suppression du produit');
      }
    }
  };

  const handleAddVariante = async () => {
    if (!selectedProduitId || !varianteData.taille) {
      alert('Veuillez sélectionner un produit et indiquer la taille');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('variantes')
        .insert({
          produit_id: selectedProduitId,
          taille: varianteData.taille,
          couleur: varianteData.couleur || null,
          modele: varianteData.modele || null,
          quantite: parseInt(varianteData.quantite) || 0
        })
        .select()
        .single();

      if (error) throw error;

      const newVariante = {
        id: data.id,
        taille: data.taille,
        couleur: data.couleur,
        modele: data.modele,
        quantite: data.quantite
      };

      dispatch({
        type: ActionTypes.ADD_VARIANTE,
        payload: { produitId: selectedProduitId, variante: newVariante }
      });

      setVarianteData({ taille: '', couleur: '', modele: '', quantite: '' });
      setShowVarianteModal(false);
    } catch (error) {
      console.error('Error adding variante:', error);
      alert('Erreur lors de l\'ajout de la variante');
    }
  };

  const handleDeleteVariante = async (produitId, varianteId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette variante ?')) {
      try {
        const { error } = await supabase
          .from('variantes')
          .delete()
          .eq('id', varianteId);

        if (error) throw error;

        dispatch({
          type: ActionTypes.DELETE_VARIANTE,
          payload: { produitId, varianteId }
        });
      } catch (error) {
        console.error('Error deleting variante:', error);
        alert('Erreur lors de la suppression de la variante');
      }
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

  // Keep the same JSX as before...
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
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{produit.nom}</h3>
                    <p className="text-sm text-gray-500">
                      Ref: {produit.reference || 'N/A'} | Prix: {produit.prixAchat} DA
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Variantes: {produit.variantes?.length || 0}
                    </p>

                    {/* Variantes list */}
                    {produit.variantes && produit.variantes.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Variantes:</h4>
                        {produit.variantes.map((variante) => (
                          <div key={variante.id} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                            <div className="text-sm">
                              <span className="font-medium">Taille: {variante.taille}</span>
                              {variante.couleur && <span className="ml-2">Couleur: {variante.couleur}</span>}
                              {variante.modele && <span className="ml-2">Modèle: {variante.modele}</span>}
                              <span className="ml-2 text-blue-600">Qté: {variante.quantite}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteVariante(produit.id, variante.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Supprimer
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Variante button */}
                    <button
                      onClick={() => {
                        setSelectedProduitId(produit.id);
                        setShowVarianteModal(true);
                      }}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Ajouter une variante
                    </button>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(produit)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✏️ Éditer
                    </button>
                    <button
                      onClick={() => handleDeleteProduit(produit.id)}
                      className="text-red-600 hover:text-red-800"
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

      {/* Add Variante Modal */}
      {showVarianteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ajouter une Variante</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Taille *</label>
                <input
                  type="text"
                  value={varianteData.taille}
                  onChange={(e) => setVarianteData({ ...varianteData, taille: e.target.value })}
                  placeholder="Ex: 40, 42, etc."
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Couleur</label>
                <input
                  type="text"
                  value={varianteData.couleur}
                  onChange={(e) => setVarianteData({ ...varianteData, couleur: e.target.value })}
                  placeholder="Ex: noir, blanc, rouge"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Modèle</label>
                <input
                  type="text"
                  value={varianteData.modele}
                  onChange={(e) => setVarianteData({ ...varianteData, modele: e.target.value })}
                  placeholder="Ex: homme, femme, enfant"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quantité en stock</label>
                <input
                  type="number"
                  value={varianteData.quantite}
                  onChange={(e) => setVarianteData({ ...varianteData, quantite: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowVarianteModal(false);
                  setVarianteData({ taille: '', couleur: '', modele: '', quantite: '' });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={handleAddVariante}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

