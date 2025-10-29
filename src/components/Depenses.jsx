import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';

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
  const updateDepense = dataCtx?.updateDepense;
  const deleteDepense = dataCtx?.deleteDepense;
  const fetchDepenseCategories = dataCtx?.fetchDepenseCategories;
  const addDepenseCategory = dataCtx?.addDepenseCategory;
  const deleteDepenseCategory = dataCtx?.deleteDepenseCategory;
  const { isAdmin } = useAuth();

  // Récupérer les catégories selon le mode
  const depenseCategories = USE_SUPABASE 
    ? (dataCtx?.depenseCategories ?? [])
    : (state.depenseCategories ?? []);
  const [showModal, setShowModal] = useState(false);
  const [editingDepense, setEditingDepense] = useState(null);
  const [searchType, setSearchType] = useState('all'); // 'all', 'single', 'range'
  const [singleDate, setSingleDate] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Charger les catégories au démarrage (mode Supabase)
  useEffect(() => {
    if (USE_SUPABASE && fetchDepenseCategories) {
      fetchDepenseCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Utiliser les catégories depuis la table (mode Supabase) ou extraire depuis dépenses (mode local)
  const categoriesExistantes = useMemo(() => {
    if (USE_SUPABASE) {
      // Mode Supabase : utiliser les catégories de la table
      return depenseCategories.map(cat => cat.nom).sort();
    } else {
      // Mode local : extraire depuis les dépenses
      if (!state.depenses || !Array.isArray(state.depenses)) return [];
      const noms = new Set();
      state.depenses.forEach(d => {
        if (d.nom && d.nom.trim()) {
          noms.add(d.nom.trim());
        }
      });
      return Array.from(noms).sort();
    }
  }, [depenseCategories, state.depenses, USE_SUPABASE]);

  const [formData, setFormData] = useState({
    nom: '',
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

  // Grouper les dépenses par nom et calculer les totaux
  const depensesParNom = useMemo(() => {
    const groupes = {};
    filteredDepenses.forEach(depense => {
      const nom = depense.nom || depense.description || 'Sans nom';
      if (!groupes[nom]) {
        groupes[nom] = {
          nom,
          total: 0,
          count: 0,
          depenses: []
        };
      }
      groupes[nom].total += depense.montant || 0;
      groupes[nom].count += 1;
      groupes[nom].depenses.push(depense);
    });
    
    // Trier par total décroissant
    return Object.values(groupes).sort((a, b) => b.total - a.total);
  }, [filteredDepenses]);

  const handleAddDepense = async () => {
    if (!formData.nom || !formData.montant || !formData.date) {
      alert('Veuillez remplir le nom, le montant et la date');
      return;
    }

    if (USE_SUPABASE) {
      await addDepense(formData.nom, parseFloat(formData.montant), formData.description || '', formData.date);
    } else {
      const newDepense = {
        id: generateId(),
        nom: formData.nom,
        montant: parseFloat(formData.montant),
        description: formData.description,
        date: formData.date
      };
      dispatch({ type: ActionTypes.ADD_DEPENSE, payload: newDepense });
    }
    resetForm();
    setShowModal(false);
  };

  const handleUpdateDepense = async () => {
    if (!formData.nom || !formData.montant || !formData.date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      if (USE_SUPABASE) {
        await updateDepense(editingDepense.id, {
          nom: formData.nom,
          montant: parseFloat(formData.montant),
          description: formData.description,
          date: formData.date
        });
      } else {
        const updatedDepense = {
          ...editingDepense,
          nom: formData.nom,
          montant: parseFloat(formData.montant),
          description: formData.description,
          date: formData.date
        };
        dispatch({ type: ActionTypes.UPDATE_DEPENSE, payload: updatedDepense });
      }
      resetForm();
      setShowModal(false);
      setEditingDepense(null);
    } catch (e) {
      alert('Erreur lors de la mise à jour: ' + (e?.message || 'inconnue'));
      console.error('Erreur updateDepense:', e);
    }
  };

  const handleDeleteDepense = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteDepense(id);
      } else {
        dispatch({ type: ActionTypes.DELETE_DEPENSE, payload: id });
      }
    } catch (e) {
      alert('Erreur lors de la suppression: ' + (e?.message || 'inconnue'));
      console.error('Erreur deleteDepense:', e);
    }
  };

  const openEditModal = (depense) => {
    setEditingDepense(depense);
    // Utiliser le nom de la catégorie si disponible (Supabase), sinon le nom direct
    const nomDepense = depense.depense_categories?.nom || depense.nom || '';
    setFormData({
      nom: nomDepense,
      montant: depense.montant || '',
      description: depense.description || '',
      date: depense.date || new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ nom: '', montant: '', description: '', date: new Date().toISOString().split('T')[0] });
  };

  // Gérer les catégories
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      alert('Veuillez entrer un nom de catégorie');
      return;
    }

    try {
      if (USE_SUPABASE && addDepenseCategory) {
        await addDepenseCategory(newCategory.trim());
        setNewCategory('');
      } else {
        // Mode local : la catégorie sera créée quand on crée une dépense avec ce nom
        alert('En mode local, créez une dépense avec ce nom pour créer la catégorie');
        setNewCategory('');
      }
    } catch (e) {
      alert('Erreur lors de la création de la catégorie: ' + (e?.message || 'inconnue'));
      console.error('Erreur addDepenseCategory:', e);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      return;
    }

    try {
      if (USE_SUPABASE && deleteDepenseCategory) {
        await deleteDepenseCategory(id);
      } else {
        alert('Suppression de catégorie non disponible en mode local');
      }
    } catch (e) {
      alert('Erreur lors de la suppression: ' + (e?.message || 'inconnue'));
      console.error('Erreur deleteDepenseCategory:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dépenses</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <span>📋</span>
            <span>Gérer les Catégories</span>
          </button>
          <button
            onClick={() => {
              setEditingDepense(null);
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>Nouvelle Dépense</span>
          </button>
        </div>
      </div>

      {/* Modal Gestion des Catégories */}
      {showCategoriesModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">📋 Gérer les Catégories de Dépenses</h3>
              <button
                onClick={() => {
                  setShowCategoriesModal(false);
                  setNewCategory('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* Créer une nouvelle catégorie */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Créer une nouvelle catégorie</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ex: Transport, Loyer, Nourriture..."
                  className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button
                  onClick={handleAddCategory}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  ➕ Ajouter
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {USE_SUPABASE 
                  ? '💡 La catégorie sera créée immédiatement dans la base de données.'
                  : '💡 En mode local, créez une dépense avec ce nom pour créer la catégorie.'
                }
              </p>
            </div>

            {/* Liste des catégories existantes */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Catégories existantes ({depenseCategories.length})
              </h4>
              {depenseCategories.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Aucune catégorie créée encore</p>
                  <p className="text-xs text-gray-400 mt-1">Créez votre première dépense pour voir la catégorie apparaître ici</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {depenseCategories.map((cat) => {
                    const count = (state.depenses || []).filter(d => 
                      USE_SUPABASE 
                        ? (d.categorie_id === cat.id || d.depense_categories?.id === cat.id)
                        : d.nom === cat.nom
                    ).length;
                    const total = (state.depenses || []).filter(d => 
                      USE_SUPABASE 
                        ? (d.categorie_id === cat.id || d.depense_categories?.id === cat.id)
                        : d.nom === cat.nom
                    ).reduce((sum, d) => sum + (d.montant || 0), 0);
                    return (
                      <div key={cat.id || cat.nom} className="bg-white border-2 border-purple-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-gray-900 text-sm">{cat.nom}</h5>
                          {USE_SUPABASE && isAdmin() && (
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                              title="Supprimer la catégorie"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{count} {count === 1 ? 'dépense' : 'dépenses'}</p>
                        <p className="text-sm font-semibold text-purple-700">{total.toFixed(2)} DA</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowCategoriesModal(false);
                  setNewCategory('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-3 border-gray-300 shadow-lg p-5">
        <h2 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-blue-500 text-white p-2 rounded-lg">🔍</span>
          <span>Recherche par Date</span>
        </h2>
        
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

        {/* Total Général */}
        {filteredDepenses.length > 0 && (
          <div className="mt-4 p-5 bg-gradient-to-r from-blue-100 to-indigo-100 border-3 border-blue-400 rounded-xl shadow-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                <span>📊</span>
                <span>Total dépenses ({filteredDepenses.length}):</span>
              </span>
              <span className="text-3xl font-extrabold text-blue-800">
                {calculateTotal().toFixed(2)} DA
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques par Période */}
      {(() => {
        const today = filterByPeriod(state.depenses || [], 'date', 'today');
        const week = filterByPeriod(state.depenses || [], 'date', 'week');
        const month = filterByPeriod(state.depenses || [], 'date', 'month');
        
        const calcStats = (items) => {
          const total = items.reduce((sum, d) => sum + (d.montant || 0), 0);
          const count = items.length;
          const moyenne = count > 0 ? total / count : 0;
          const categories = new Set(items.map(d => d.depense_categories?.nom || d.nom || 'Sans nom').filter(Boolean));
          return { total, count, moyenne, categories: categories.size };
        };
        
        const statsToday = calcStats(today);
        const statsWeek = calcStats(week);
        const statsMonth = calcStats(month);
        
        return (
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
                    <span className="text-sm font-bold text-blue-900">{statsToday.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Total:</span>
                    <span className="text-sm font-bold text-blue-900">{statsToday.total.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Moyenne:</span>
                    <span className="text-sm font-bold text-blue-900">{statsToday.moyenne.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Catégories:</span>
                    <span className="text-sm font-bold text-blue-900">{statsToday.categories}</span>
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
                    <span className="text-sm font-bold text-green-900">{statsWeek.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Total:</span>
                    <span className="text-sm font-bold text-green-900">{statsWeek.total.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Moyenne:</span>
                    <span className="text-sm font-bold text-green-900">{statsWeek.moyenne.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Catégories:</span>
                    <span className="text-sm font-bold text-green-900">{statsWeek.categories}</span>
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
                    <span className="text-sm font-bold text-purple-900">{statsMonth.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-700 font-medium">Total:</span>
                    <span className="text-sm font-bold text-purple-900">{statsMonth.total.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-700 font-medium">Moyenne:</span>
                    <span className="text-sm font-bold text-purple-900">{statsMonth.moyenne.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-700 font-medium">Catégories:</span>
                    <span className="text-sm font-bold text-purple-900">{statsMonth.categories}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Résumé par nom de dépense */}
      {depensesParNom.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Résumé par Catégorie</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {depensesParNom.map((groupe) => (
              <div key={groupe.nom} className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 text-sm">{groupe.nom}</h3>
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    {groupe.count} {groupe.count === 1 ? 'fois' : 'fois'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {groupe.total.toFixed(2)} DA
                </p>
                <div className="mt-2 pt-2 border-t border-purple-200">
                  <p className="text-xs text-gray-600">
                    Moyenne: {(groupe.total / groupe.count).toFixed(2)} DA
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Depenses List */}
      <div className="space-y-4">
        {(!state.depenses || state.depenses.length === 0) ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucune dépense enregistrée</p>
          </div>
        ) : filteredDepenses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg">Aucune dépense trouvée pour les critères sélectionnés</p>
          </div>
        ) : (
          filteredDepenses.map((depense) => (
            <div key={depense.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-4 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-500 text-white p-3 rounded-xl shadow-lg">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-extrabold text-gray-900">
                          {depense.montant.toFixed(2)} DA
                        </h3>
                        {(depense.nom || depense.depense_categories?.nom) && (
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 text-xs font-bold rounded-full border-2 border-purple-300">
                            {depense.depense_categories?.nom || depense.nom}
                          </span>
                        )}
                      </div>
                      {depense.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {depense.description}
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
                      <p className="text-base font-bold text-blue-900">{depense.date}</p>
                    </div>
                    {depense.description && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1 font-semibold flex items-center gap-1">
                          <span>📝</span>
                          <span>Description</span>
                        </p>
                        <p className="text-sm font-medium text-gray-800">{depense.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin() && (
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => openEditModal(depense)}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <span>✏️</span>
                      <span>Éditer</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDepense(depense.id)}
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
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingDepense ? 'Modifier la Dépense' : 'Nouvelle Dépense'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la dépense (Catégorie) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="categories-list"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Tapez un nom ou sélectionnez une catégorie existante..."
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    required
                  />
                  {categoriesExistantes.length > 0 && (
                    <datalist id="categories-list">
                      {categoriesExistantes.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCategoriesModal(true)}
                    className="text-xs text-purple-600 hover:text-purple-800 underline flex items-center gap-1"
                  >
                    <span>📋</span>
                    <span>Gérer les catégories</span>
                  </button>
                  {categoriesExistantes.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {categoriesExistantes.length} {categoriesExistantes.length === 1 ? 'catégorie' : 'catégories'} disponible{categoriesExistantes.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Montant (DA) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
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
                  placeholder="Détails supplémentaires de la dépense..."
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

