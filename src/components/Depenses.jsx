import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const Depenses = () => {
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
  const addDepense = dataCtx?.addDepense;
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingDepense, setEditingDepense] = useState(null);
  const [searchType, setSearchType] = useState('all'); // 'all', 'single', 'range'
  const [singleDate, setSingleDate] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const [formData, setFormData] = useState({
    montant: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Filter depenses based on search
  const getFilteredDepenses = () => {
    if (!state.depenses || !Array.isArray(state.depenses)) {
      return [];
    }
    let filtered = [...state.depenses].reverse();
    
    if (searchType === 'single' && singleDate) {
      filtered = filtered.filter(d => d.date === singleDate);
    } else if (searchType === 'range' && dateRange.start && dateRange.end) {
      filtered = filtered.filter(d => 
        d.date >= dateRange.start && d.date <= dateRange.end
      );
    }
    
    return filtered;
  };

  const filteredDepenses = getFilteredDepenses();

  // Calculate total
  const calculateTotal = () => {
    return filteredDepenses.reduce((sum, d) => sum + (d.montant || 0), 0);
  };

  const handleAddDepense = async () => {
    if (!formData.montant || !formData.date) {
      alert('Veuillez remplir le montant et la date');
      return;
    }

    if (USE_SUPABASE) {
      await addDepense(parseFloat(formData.montant), formData.description, formData.date);
    } else {
      const newDepense = {
        id: generateId(),
        montant: parseFloat(formData.montant),
        description: formData.description,
        date: formData.date
      };
      dispatch({ type: ActionTypes.ADD_DEPENSE, payload: newDepense });
    }
    resetForm();
    setShowModal(false);
  };

  const handleUpdateDepense = () => {
    if (!formData.montant || !formData.date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const updatedDepense = {
      ...editingDepense,
      montant: parseFloat(formData.montant),
      description: formData.description,
      date: formData.date
    };

    dispatch({ type: ActionTypes.UPDATE_DEPENSE, payload: updatedDepense });
    resetForm();
    setShowModal(false);
    setEditingDepense(null);
  };

  const handleDeleteDepense = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      dispatch({ type: ActionTypes.DELETE_DEPENSE, payload: id });
    }
  };

  const openEditModal = (depense) => {
    setEditingDepense(depense);
    setFormData({
      montant: depense.montant,
      description: depense.description || '',
      date: depense.date
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ montant: '', description: '', date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dépenses</h1>
        <button
          onClick={() => {
            setEditingDepense(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          + Nouvelle Dépense
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🔍 Recherche par Date</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de recherche</label>
            <select
              value={searchType}
              onChange={(e) => {
                setSearchType(e.target.value);
                setSingleDate('');
                setDateRange({ start: '', end: '' });
              }}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
            >
              <option value="all">Toutes les dépenses</option>
              <option value="single">Date unique</option>
              <option value="range">Période (Du...au...)</option>
            </select>
          </div>

          {/* Single Date */}
          {searchType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
          )}

          {/* Date Range */}
          {searchType === 'range' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
            </>
          )}
        </div>

        {/* Total */}
        {filteredDepenses.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">
                Total dépenses ({filteredDepenses.length}):
              </span>
              <span className="text-2xl font-bold text-blue-600">
                {calculateTotal().toFixed(2)} DA
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Depenses List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="divide-y divide-gray-200">
          {(!state.depenses || state.depenses.length === 0) ? (
            <div className="p-6 text-center text-gray-500">
              Aucune dépense enregistrée
            </div>
          ) : filteredDepenses.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucune dépense trouvée pour les critères sélectionnés
            </div>
          ) : (
            filteredDepenses.map((depense) => (
              <div key={depense.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">💰</div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {depense.montant.toFixed(2)} DA
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {depense.description || 'Aucune description'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          📅 {depense.date}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isAdmin() && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(depense)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        ✏️ Éditer
                      </button>
                      <button
                        onClick={() => handleDeleteDepense(depense.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingDepense ? 'Modifier la Dépense' : 'Nouvelle Dépense'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Montant (DA) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description/Commentaire</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  placeholder="Détails de la dépense..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingDepense(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={editingDepense ? handleUpdateDepense : handleAddDepense}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingDepense ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Depenses;

