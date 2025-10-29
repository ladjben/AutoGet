import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';

const Colis = () => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
    depenses: dataCtx?.depenses ?? [],
    colis: dataCtx?.colis ?? []
  };
  const dispatch = dataCtx?.dispatch;
  const generateId = dataCtx?.generateId;
  const addColis = dataCtx?.addColis;
  const updateColis = dataCtx?.updateColis;
  const deleteColis = dataCtx?.deleteColis;
  const { isAdmin } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [editingColis, setEditingColis] = useState(null);
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: ''
  });

  const [formData, setFormData] = useState({
    nombre: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Filtrer les colis selon les filtres
  const filteredColis = useMemo(() => {
    let filtered = (state.colis || []).slice().reverse(); // Plus récents en premier
    
    if (filters.dateStart && filters.dateEnd) {
      filtered = filtered.filter(c => {
        const colisDate = c.date;
        return colisDate >= filters.dateStart && colisDate <= filters.dateEnd;
      });
    } else if (filters.dateStart) {
      filtered = filtered.filter(c => c.date >= filters.dateStart);
    } else if (filters.dateEnd) {
      filtered = filtered.filter(c => c.date <= filters.dateEnd);
    }
    
    return filtered;
  }, [state.colis, filters]);

  // Statistiques globales
  const stats = useMemo(() => {
    const colis = filteredColis;
    const totalColis = colis.reduce((sum, c) => sum + (parseInt(c.nombre) || 0), 0);
    const nombreJours = colis.length;
    const moyenneParJour = nombreJours > 0 ? totalColis / nombreJours : 0;
    const maxColis = colis.length > 0 ? Math.max(...colis.map(c => parseInt(c.nombre) || 0)) : 0;
    const minColis = colis.length > 0 ? Math.min(...colis.map(c => parseInt(c.nombre) || 0).filter(n => n > 0)) : 0;
    
    return {
      totalColis,
      nombreJours,
      moyenneParJour,
      maxColis,
      minColis
    };
  }, [filteredColis]);

  const handleAddColis = async () => {
    if (!formData.nombre || !formData.date) {
      alert('Veuillez remplir tous les champs obligatoires (nombre, date)');
      return;
    }

    try {
      if (USE_SUPABASE) {
        await addColis(parseInt(formData.nombre), formData.date, formData.description || '');
      } else {
        const newColis = {
          id: generateId(),
          nombre: parseInt(formData.nombre),
          date: formData.date,
          description: formData.description || ''
        };
        dispatch({ type: ActionTypes.ADD_COLIS, payload: newColis });
      }
      resetForm();
      setShowModal(false);
    } catch (e) {
      alert('Erreur lors de l\'ajout: ' + (e?.message || 'inconnue'));
      console.error('Erreur addColis:', e);
    }
  };

  const handleUpdateColis = async () => {
    if (!formData.nombre || !formData.date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      if (USE_SUPABASE) {
        await updateColis(editingColis.id, {
          nombre: parseInt(formData.nombre),
          date: formData.date,
          description: formData.description || ''
        });
      } else {
        const updatedColis = {
          ...editingColis,
          nombre: parseInt(formData.nombre),
          date: formData.date,
          description: formData.description || ''
        };
        dispatch({ type: ActionTypes.UPDATE_COLIS, payload: updatedColis });
      }
      resetForm();
      setShowModal(false);
      setEditingColis(null);
    } catch (e) {
      alert('Erreur lors de la mise à jour: ' + (e?.message || 'inconnue'));
      console.error('Erreur updateColis:', e);
    }
  };

  const handleDeleteColis = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet enregistrement ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteColis(id);
      } else {
        dispatch({ type: ActionTypes.DELETE_COLIS, payload: id });
      }
    } catch (e) {
      alert('Erreur lors de la suppression: ' + (e?.message || 'inconnue'));
      console.error('Erreur deleteColis:', e);
    }
  };

  const openEditModal = (colis) => {
    setEditingColis(colis);
    setFormData({
      nombre: colis.nombre || '',
      date: colis.date || new Date().toISOString().split('T')[0],
      description: colis.description || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ nombre: '', date: new Date().toISOString().split('T')[0], description: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">📦 Colis Envoyés</h1>
        <button
          onClick={() => {
            setEditingColis(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouveau Colis</span>
        </button>
      </div>

      {/* Résumé Global */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-white p-2 rounded-lg shadow-sm">📊</span>
          <span>Résumé Global</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-blue-500 text-white p-2 rounded-lg text-xl">📦</span>
              <span className="text-xs text-blue-700 font-semibold bg-blue-300 px-2 py-1 rounded-full">
                Total Colis
              </span>
            </div>
            <p className="text-3xl font-extrabold text-blue-800 mb-1">{stats.totalColis}</p>
            <p className="text-xs text-blue-600 mt-2">
              Colis envoyés au total
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-green-500 text-white p-2 rounded-lg text-xl">📅</span>
              <span className="text-xs text-green-700 font-semibold bg-green-300 px-2 py-1 rounded-full">
                Jours Suivis
              </span>
            </div>
            <p className="text-3xl font-extrabold text-green-800 mb-1">{stats.nombreJours}</p>
            <p className="text-xs text-green-600 mt-2">
              Jours avec enregistrements
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-purple-500 text-white p-2 rounded-lg text-xl">📊</span>
              <span className="text-xs text-purple-700 font-semibold bg-purple-300 px-2 py-1 rounded-full">
                Moyenne/Jour
              </span>
            </div>
            <p className="text-3xl font-extrabold text-purple-800 mb-1">{stats.moyenneParJour.toFixed(1)}</p>
            <p className="text-xs text-purple-600 mt-2">
              Colis en moyenne par jour
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-100 to-orange-200 border-3 border-orange-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-orange-500 text-white p-2 rounded-lg text-xl">⬆️</span>
              <span className="text-xs text-orange-700 font-semibold bg-orange-300 px-2 py-1 rounded-full">
                Maximum
              </span>
            </div>
            <p className="text-3xl font-extrabold text-orange-800 mb-1">{stats.maxColis}</p>
            <p className="text-xs text-orange-600 mt-2">
              Plus grand envoi
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-100 to-indigo-200 border-3 border-indigo-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-indigo-500 text-white p-2 rounded-lg text-xl">⬇️</span>
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-300 px-2 py-1 rounded-full">
                Minimum
              </span>
            </div>
            <p className="text-3xl font-extrabold text-indigo-800 mb-1">{stats.minColis}</p>
            <p className="text-xs text-indigo-600 mt-2">
              Plus petit envoi
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-3 border-gray-300 shadow-lg p-5">
        <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-blue-500 text-white p-2 rounded-lg">🔍</span>
          <span>Filtres de Recherche</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        {(filters.dateStart || filters.dateEnd) && (
          <button
            onClick={() => setFilters({ dateStart: '', dateEnd: '' })}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* Liste des colis */}
      <div className="space-y-4">
        {(!state.colis || state.colis.length === 0) ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucun enregistrement de colis</p>
          </div>
        ) : filteredColis.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucun colis trouvé pour les critères sélectionnés</p>
          </div>
        ) : (
          filteredColis.map((colis) => (
            <div key={colis.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-4 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-500 text-white p-3 rounded-xl shadow-lg">
                      <span className="text-2xl">📦</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-extrabold text-gray-900">
                          {colis.nombre} {colis.nombre > 1 ? 'colis' : 'colis'}
                        </h3>
                      </div>
                      {colis.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {colis.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-blue-600 mb-1 font-semibold flex items-center gap-1">
                        <span>📅</span>
                        <span>Date</span>
                      </p>
                      <p className="text-base font-bold text-blue-900">{colis.date}</p>
                    </div>
                    {colis.description && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1 font-semibold flex items-center gap-1">
                          <span>📝</span>
                          <span>Description</span>
                        </p>
                        <p className="text-sm font-medium text-gray-800">{colis.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin() && (
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => openEditModal(colis)}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <span>✏️</span>
                      <span>Éditer</span>
                    </button>
                    <button
                      onClick={() => handleDeleteColis(colis.id)}
                      className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <span>🗑️</span>
                      <span>Supprimer</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingColis ? 'Modifier le Colis' : 'Nouveau Colis'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre de colis *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description/Commentaire</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  placeholder="Détails supplémentaires..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingColis(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={editingColis ? handleUpdateColis : handleAddColis}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingColis ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Colis;

