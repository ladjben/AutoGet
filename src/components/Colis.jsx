import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';
import { filterByPeriod } from '../utils/dateUtils';

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

  // Fonction pour calculer les stats d'une liste de colis
  const calculateStatsColis = (colisList) => {
    const totalColis = colisList.reduce((sum, c) => sum + (parseInt(c.nombre) || 0), 0);
    const nombreJours = colisList.length;
    const moyenneParJour = nombreJours > 0 ? totalColis / nombreJours : 0;
    const maxColis = colisList.length > 0 ? Math.max(...colisList.map(c => parseInt(c.nombre) || 0)) : 0;
    const minColis = colisList.length > 0 ? Math.min(...colisList.map(c => parseInt(c.nombre) || 0).filter(n => n > 0)) : 0;
    const joursAvecActivite = colisList.filter(c => parseInt(c.nombre) > 0).length;
    const tauxActivite = nombreJours > 0 ? (joursAvecActivite / nombreJours) * 100 : 0;
    
    return {
      totalColis,
      nombreJours,
      moyenneParJour,
      maxColis,
      minColis,
      joursAvecActivite,
      tauxActivite: tauxActivite.toFixed(1) + '%'
    };
  };

  // Statistiques globales
  const stats = useMemo(() => {
    return calculateStatsColis(filteredColis);
  }, [filteredColis]);

  // Statistiques par période
  const periodStats = useMemo(() => {
    const today = filterByPeriod(state.colis || [], 'date', 'today');
    const week = filterByPeriod(state.colis || [], 'date', 'week');
    const month = filterByPeriod(state.colis || [], 'date', 'month');
    
    return {
      today: calculateStatsColis(today),
      week: calculateStatsColis(week),
      month: calculateStatsColis(month)
    };
  }, [state.colis]);

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
      {/* En-tête amélioré */}
      <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-xl shadow-lg">
            <span className="text-4xl">📦</span>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white">Colis Envoyés</h1>
            <p className="text-blue-100 text-sm mt-1">Suivi quotidien des envois</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingColis(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-white hover:bg-gray-100 text-blue-700 font-bold py-3 px-6 rounded-xl shadow-lg transition-all hover:shadow-xl flex items-center gap-2 transform hover:scale-105"
        >
          <span className="text-xl">+</span>
          <span>Nouveau Colis</span>
        </button>
      </div>

      {/* Résumé Global Amélioré */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="bg-white p-3 rounded-xl shadow-lg text-2xl">📊</span>
          <span>Vue d'Ensemble Globale</span>
        </h2>
        
        {/* Ligne 1: Cartes principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-blue-500 text-white p-3 rounded-xl text-2xl shadow-md">📦</span>
              <span className="text-xs text-blue-700 font-bold bg-blue-300 px-3 py-1.5 rounded-full shadow-sm">
                Total Colis
              </span>
            </div>
            <p className="text-4xl font-extrabold text-blue-800 mb-2">{stats.totalColis}</p>
            <p className="text-xs text-blue-600 font-medium">
              Colis envoyés au total
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-green-500 text-white p-3 rounded-xl text-2xl shadow-md">📅</span>
              <span className="text-xs text-green-700 font-bold bg-green-300 px-3 py-1.5 rounded-full shadow-sm">
                Jours Suivis
              </span>
            </div>
            <p className="text-4xl font-extrabold text-green-800 mb-2">{stats.nombreJours}</p>
            <p className="text-xs text-green-600 font-medium">
              Jours avec enregistrements
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-purple-500 text-white p-3 rounded-xl text-2xl shadow-md">📊</span>
              <span className="text-xs text-purple-700 font-bold bg-purple-300 px-3 py-1.5 rounded-full shadow-sm">
                Moyenne/Jour
              </span>
            </div>
            <p className="text-4xl font-extrabold text-purple-800 mb-2">{stats.moyenneParJour.toFixed(1)}</p>
            <p className="text-xs text-purple-600 font-medium">
              Colis en moyenne par jour
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-100 to-orange-200 border-3 border-orange-400 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-orange-500 text-white p-3 rounded-xl text-2xl shadow-md">⬆️</span>
              <span className="text-xs text-orange-700 font-bold bg-orange-300 px-3 py-1.5 rounded-full shadow-sm">
                Maximum
              </span>
            </div>
            <p className="text-4xl font-extrabold text-orange-800 mb-2">{stats.maxColis}</p>
            <p className="text-xs text-orange-600 font-medium">
              Plus grand envoi
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-100 to-indigo-200 border-3 border-indigo-400 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-indigo-500 text-white p-3 rounded-xl text-2xl shadow-md">⬇️</span>
              <span className="text-xs text-indigo-700 font-bold bg-indigo-300 px-3 py-1.5 rounded-full shadow-sm">
                Minimum
              </span>
            </div>
            <p className="text-4xl font-extrabold text-indigo-800 mb-2">{stats.minColis}</p>
            <p className="text-xs text-indigo-600 font-medium">
              Plus petit envoi
            </p>
          </div>
        </div>

        {/* Ligne 2: Statistiques additionnelles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t-3 border-gray-400">
          <div className="bg-white/90 rounded-lg p-4 text-center border-2 border-gray-300 shadow-sm">
            <p className="text-xs text-gray-600 mb-1 font-medium">Total Jours</p>
            <p className="text-2xl font-bold text-gray-900">{stats.nombreJours}</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-4 text-center border-2 border-cyan-300 shadow-sm">
            <p className="text-xs text-cyan-600 mb-1 font-medium">Jours avec Activité</p>
            <p className="text-2xl font-bold text-cyan-800">{stats.joursAvecActivite}</p>
          </div>
          <div className="bg-teal-50 rounded-lg p-4 text-center border-2 border-teal-300 shadow-sm">
            <p className="text-xs text-teal-600 mb-1 font-medium">Taux d'Activité</p>
            <p className="text-2xl font-bold text-teal-800">{stats.tauxActivite}</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4 text-center border-2 border-pink-300 shadow-sm">
            <p className="text-xs text-pink-600 mb-1 font-medium">Moyenne par Jour Actif</p>
            <p className="text-2xl font-bold text-pink-800">
              {stats.joursAvecActivite > 0 ? (stats.totalColis / stats.joursAvecActivite).toFixed(1) : '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques par Période */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
          <span className="bg-white p-2 rounded-lg shadow-sm text-lg">📅</span>
          <span>Statistiques par Période</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Journalier */}
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-blue-500 text-white p-2 rounded-lg text-xl">📆</span>
              <span className="text-xs text-blue-700 font-bold bg-blue-300 px-3 py-1 rounded-full">Aujourd'hui</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-blue-700 font-medium">Nombre:</span>
                <span className="text-sm font-bold text-blue-900">{periodStats.today.totalColis}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-blue-700 font-medium">Jours:</span>
                <span className="text-sm font-bold text-blue-900">{periodStats.today.nombreJours}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-blue-700 font-medium">Moyenne:</span>
                <span className="text-sm font-bold text-blue-900">{periodStats.today.moyenneParJour.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-blue-700 font-medium">Max:</span>
                <span className="text-sm font-bold text-blue-900">{periodStats.today.maxColis}</span>
              </div>
            </div>
          </div>

          {/* Hebdomadaire */}
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-green-500 text-white p-2 rounded-lg text-xl">📅</span>
              <span className="text-xs text-green-700 font-bold bg-green-300 px-3 py-1 rounded-full">Cette Semaine</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-700 font-medium">Nombre:</span>
                <span className="text-sm font-bold text-green-900">{periodStats.week.totalColis}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-700 font-medium">Jours:</span>
                <span className="text-sm font-bold text-green-900">{periodStats.week.nombreJours}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-700 font-medium">Moyenne:</span>
                <span className="text-sm font-bold text-green-900">{periodStats.week.moyenneParJour.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-700 font-medium">Max:</span>
                <span className="text-sm font-bold text-green-900">{periodStats.week.maxColis}</span>
              </div>
            </div>
          </div>

          {/* Mensuel */}
          <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-purple-500 text-white p-2 rounded-lg text-xl">📊</span>
              <span className="text-xs text-purple-700 font-bold bg-purple-300 px-3 py-1 rounded-full">Ce Mois</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-700 font-medium">Nombre:</span>
                <span className="text-sm font-bold text-purple-900">{periodStats.month.totalColis}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-700 font-medium">Jours:</span>
                <span className="text-sm font-bold text-purple-900">{periodStats.month.nombreJours}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-700 font-medium">Moyenne:</span>
                <span className="text-sm font-bold text-purple-900">{periodStats.month.moyenneParJour.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-700 font-medium">Max:</span>
                <span className="text-sm font-bold text-purple-900">{periodStats.month.maxColis}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres améliorés */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-3 border-gray-300 shadow-lg p-5">
        <h3 className="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-blue-500 text-white p-2 rounded-lg shadow-md">🔍</span>
          <span>Filtres de Recherche</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/90 rounded-lg p-4 border-2 border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
              <span>📅</span>
              <span>Date début</span>
            </label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg py-3 px-4 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
            />
          </div>
          <div className="bg-white/90 rounded-lg p-4 border-2 border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
              <span>📅</span>
              <span>Date fin</span>
            </label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg py-3 px-4 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
            />
          </div>
        </div>
        {(filters.dateStart || filters.dateEnd) && (
          <button
            onClick={() => setFilters({ dateStart: '', dateEnd: '' })}
            className="mt-4 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* Liste des colis améliorée */}
      <div className="space-y-4">
        {(!state.colis || state.colis.length === 0) ? (
          <div className="bg-white rounded-2xl border-4 border-gray-300 shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-xl font-bold text-gray-700 mb-2">Aucun enregistrement de colis</p>
            <p className="text-sm text-gray-500">Commencez par ajouter votre premier envoi</p>
          </div>
        ) : filteredColis.length === 0 ? (
          <div className="bg-white rounded-2xl border-4 border-gray-300 shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-xl font-bold text-gray-700 mb-2">Aucun colis trouvé</p>
            <p className="text-sm text-gray-500">Aucun résultat pour les critères sélectionnés</p>
          </div>
        ) : (
          filteredColis.map((colis) => (
            <div key={colis.id} className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 rounded-2xl border-4 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-xl">
                      <span className="text-4xl">📦</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-extrabold text-gray-900">
                          {colis.nombre}
                        </h3>
                        <span className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 text-sm font-bold px-4 py-1.5 rounded-full border-2 border-blue-300 shadow-sm">
                          {colis.nombre > 1 ? 'colis envoyés' : 'colis envoyé'}
                        </span>
                      </div>
                      {colis.description && (
                        <p className="text-sm text-gray-600 font-medium mt-2">
                          {colis.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-3 border-blue-300 rounded-xl p-5 shadow-md">
                      <p className="text-xs text-blue-600 mb-2 font-extrabold flex items-center gap-2">
                        <span className="text-lg">📅</span>
                        <span>Date d'envoi</span>
                      </p>
                      <p className="text-lg font-extrabold text-blue-900">{colis.date}</p>
                    </div>
                    {colis.description && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-3 border-gray-300 rounded-xl p-5 shadow-md">
                        <p className="text-xs text-gray-600 mb-2 font-extrabold flex items-center gap-2">
                          <span className="text-lg">📝</span>
                          <span>Description</span>
                        </p>
                        <p className="text-sm font-bold text-gray-800">{colis.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin() && (
                  <div className="flex flex-col gap-3 ml-6">
                    <button
                      onClick={() => openEditModal(colis)}
                      className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-extrabold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105"
                    >
                      <span>✏️</span>
                      <span>Éditer</span>
                    </button>
                    <button
                      onClick={() => handleDeleteColis(colis.id)}
                      className="px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-extrabold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105"
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

      {/* Modal amélioré */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-4 border-gray-300">
            <div className="flex justify-between items-center mb-6 pb-4 border-b-3 border-gray-300">
              <h3 className="text-2xl font-extrabold text-gray-900">
                {editingColis ? '✏️ Modifier le Colis' : '➕ Nouveau Colis'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingColis(null);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span>📦</span>
                  <span>Nombre de colis *</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border-3 border-gray-300 rounded-xl shadow-sm py-3 px-4 text-base font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  required
                  placeholder="Ex: 5"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span>📅</span>
                  <span>Date d'envoi *</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border-3 border-gray-300 rounded-xl shadow-sm py-3 px-4 text-base font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span>📝</span>
                  <span>Description/Commentaire</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                  className="w-full border-3 border-gray-300 rounded-xl shadow-sm py-3 px-4 text-base font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  placeholder="Détails supplémentaires de l'envoi..."
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3 pt-4 border-t-3 border-gray-300">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingColis(null);
                  resetForm();
                }}
                className="px-5 py-2.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded-xl transition-all shadow-md"
              >
                Annuler
              </button>
              <button
                onClick={editingColis ? handleUpdateColis : handleAddColis}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                {editingColis ? '✅ Modifier' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Colis;
