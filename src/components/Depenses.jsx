import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, ShoppingCart, Calendar, Edit, Trash2, TrendingUp, List, X } from 'lucide-react';

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
  const { toast } = useToast();

  const depenseCategories = USE_SUPABASE 
    ? (dataCtx?.depenseCategories ?? [])
    : (state.depenseCategories ?? []);
  const [showModal, setShowModal] = useState(false);
  const [editingDepense, setEditingDepense] = useState(null);
  const [searchType, setSearchType] = useState('all');
  const [singleDate, setSingleDate] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (USE_SUPABASE && fetchDepenseCategories) {
      fetchDepenseCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const categoriesExistantes = useMemo(() => {
    if (USE_SUPABASE) {
      return depenseCategories.map(cat => cat.nom).sort();
    } else {
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

  const calculateTotal = () => {
    return filteredDepenses.reduce((sum, d) => sum + (d.montant || 0), 0);
  };

  const depensesParNom = useMemo(() => {
    const groupes = {};
    filteredDepenses.forEach(depense => {
      const nom = depense.depense_categories?.nom || depense.nom || 'Sans nom';
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
    
    return Object.values(groupes).sort((a, b) => b.total - a.total);
  }, [filteredDepenses]);

  const handleAddDepense = async () => {
    if (!formData.nom || !formData.montant || !formData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom, le montant et la date",
      });
      return;
    }

    try {
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
      toast({
        title: "Succès",
        description: "Dépense ajoutée avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleUpdateDepense = async () => {
    if (!formData.nom || !formData.montant || !formData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
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
      toast({
        title: "Succès",
        description: "Dépense mise à jour avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
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
      toast({
        title: "Succès",
        description: "Dépense supprimée avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur deleteDepense:', e);
    }
  };

  const openEditModal = (depense) => {
    setEditingDepense(depense);
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

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez entrer un nom de catégorie",
      });
      return;
    }

    try {
      if (USE_SUPABASE && addDepenseCategory) {
        await addDepenseCategory(newCategory.trim());
        setNewCategory('');
        toast({
          title: "Succès",
          description: "Catégorie créée avec succès",
        });
      } else {
        toast({
          title: "Information",
          description: "En mode local, créez une dépense avec ce nom pour créer la catégorie",
        });
        setNewCategory('');
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
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
        toast({
          title: "Succès",
          description: "Catégorie supprimée avec succès",
        });
      } else {
        toast({
          title: "Information",
          description: "Suppression de catégorie non disponible en mode local",
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur deleteDepenseCategory:', e);
    }
  };

  // Statistiques par période
  const periodStats = useMemo(() => {
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
    
    return {
      today: calcStats(today),
      week: calcStats(week),
      month: calcStats(month)
    };
  }, [state.depenses]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const depenses = state.depenses || [];
    const total = depenses.reduce((sum, d) => sum + (d.montant || 0), 0);
    const count = depenses.length;
    const moyenne = count > 0 ? total / count : 0;
    const categories = new Set(depenses.map(d => d.depense_categories?.nom || d.nom || 'Sans nom').filter(Boolean));
    
    return {
      total,
      count,
      moyenne,
      nombreCategories: categories.size
    };
  }, [state.depenses]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Dépenses</h1>
        <div className="flex gap-3">
          <Dialog open={showCategoriesModal} onOpenChange={setShowCategoriesModal}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <List className="h-4 w-4 mr-2" />
                Gérer les Catégories
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Gérer les Catégories de Dépenses</DialogTitle>
                <DialogDescription>
                  Créez et gérez vos catégories de dépenses
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Créer une nouvelle catégorie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Ex: Transport, Loyer, Nourriture..."
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                      />
                      <Button onClick={handleAddCategory}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {USE_SUPABASE 
                        ? 'La catégorie sera créée immédiatement dans la base de données.'
                        : 'En mode local, créez une dépense avec ce nom pour créer la catégorie.'
                      }
                    </p>
                  </CardContent>
                </Card>

                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Catégories existantes ({depenseCategories.length})
                  </h4>
                  {depenseCategories.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground py-4">
                          <p className="text-sm">Aucune catégorie créée encore</p>
                          <p className="text-xs mt-1">Créez votre première dépense pour voir la catégorie apparaître ici</p>
                        </div>
                      </CardContent>
                    </Card>
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
                          <Card key={cat.id || cat.nom}>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-sm">{cat.nom}</h5>
                                {USE_SUPABASE && isAdmin() && (
                                  <Button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">{count} {count === 1 ? 'dépense' : 'dépenses'}</p>
                              <p className="text-sm font-semibold">{total.toFixed(2)} DA</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showModal} onOpenChange={(open) => {
            setShowModal(open);
            if (!open) {
              setEditingDepense(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Dépense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDepense ? 'Modifier la Dépense' : 'Nouvelle Dépense'}</DialogTitle>
                <DialogDescription>
                  {editingDepense ? 'Modifiez les informations de la dépense' : 'Ajoutez une nouvelle dépense'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Nom de la dépense (Catégorie) *
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      list="categories-list"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="Tapez un nom ou sélectionnez une catégorie existante..."
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
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setShowModal(false);
                        setShowCategoriesModal(true);
                      }}
                      className="h-auto p-0 text-xs"
                    >
                      <List className="h-3 w-3 mr-1" />
                      Gérer les catégories
                    </Button>
                    {categoriesExistantes.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {categoriesExistantes.length} {categoriesExistantes.length === 1 ? 'catégorie' : 'catégories'} disponible{categoriesExistantes.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Montant (DA) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.montant}
                    onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Date *</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description/Commentaire</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Détails supplémentaires de la dépense..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDepense(null);
                    resetForm();
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={editingDepense ? handleUpdateDepense : handleAddDepense}>
                  {editingDepense ? 'Modifier' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recherche par Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Type de recherche</label>
              <select
                value={searchType}
                onChange={(e) => {
                  setSearchType(e.target.value);
                  setSingleDate('');
                  setDateRange({ start: '', end: '' });
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Toutes les dépenses</option>
                <option value="single">Date unique</option>
                <option value="range">Période (Du...au...)</option>
              </select>
            </div>

            {searchType === 'single' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </div>
            )}

            {searchType === 'range' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date début</label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date fin</label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          {filteredDepenses.length > 0 && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Total dépenses ({filteredDepenses.length}):
                  </span>
                  <span className="text-2xl font-bold">
                    {calculateTotal().toFixed(2)} DA
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Résumé Global */}
      <Card>
        <CardHeader>
          <CardTitle>Vue d'Ensemble Globale</CardTitle>
          <CardDescription>Statistiques sur toutes vos dépenses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Dépenses</p>
                    <p className="text-3xl font-bold">{globalStats.total.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">{globalStats.count} dépense(s)</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de Catégories</p>
                    <p className="text-3xl font-bold">{globalStats.nombreCategories}</p>
                    <p className="text-xs text-muted-foreground mt-1">Catégories actives</p>
                  </div>
                  <List className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dépense Moyenne</p>
                    <p className="text-3xl font-bold">{globalStats.moyenne.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">Par dépense</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entrées</p>
                    <p className="text-3xl font-bold">{globalStats.count}</p>
                    <p className="text-xs text-muted-foreground mt-1">Dépenses enregistrées</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques par Période */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques par Période</CardTitle>
          <CardDescription>Vue détaillée par jour, semaine et mois</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aujourd'hui</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Nombre:</span>
                  <span className="text-sm font-semibold">{periodStats.today.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-sm font-semibold">{periodStats.today.total.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Moyenne:</span>
                  <span className="text-sm font-semibold">{periodStats.today.moyenne.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Catégories:</span>
                  <span className="text-sm font-semibold">{periodStats.today.categories}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cette Semaine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Nombre:</span>
                  <span className="text-sm font-semibold">{periodStats.week.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-sm font-semibold">{periodStats.week.total.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Moyenne:</span>
                  <span className="text-sm font-semibold">{periodStats.week.moyenne.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Catégories:</span>
                  <span className="text-sm font-semibold">{periodStats.week.categories}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ce Mois</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Nombre:</span>
                  <span className="text-sm font-semibold">{periodStats.month.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-sm font-semibold">{periodStats.month.total.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Moyenne:</span>
                  <span className="text-sm font-semibold">{periodStats.month.moyenne.toFixed(2)} DA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Catégories:</span>
                  <span className="text-sm font-semibold">{periodStats.month.categories}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Résumé par Catégorie */}
      {depensesParNom.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résumé par Catégorie</CardTitle>
            <CardDescription>Répartition des dépenses par catégorie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {depensesParNom.map((groupe) => (
                <Card key={groupe.nom}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{groupe.nom}</h3>
                      <Badge variant="outline">
                        {groupe.count} {groupe.count === 1 ? 'fois' : 'fois'}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{groupe.total.toFixed(2)} DA</p>
                    <Separator className="my-2" />
                    <p className="text-xs text-muted-foreground">
                      Moyenne: {(groupe.total / groupe.count).toFixed(2)} DA
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Depenses List */}
      <div className="space-y-4">
        {(!state.depenses || state.depenses.length === 0) ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg">Aucune dépense enregistrée</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredDepenses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg">Aucune dépense trouvée pour les critères sélectionnés</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredDepenses.map((depense) => (
            <Card key={depense.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{depense.montant.toFixed(2)} DA</CardTitle>
                      {(depense.nom || depense.depense_categories?.nom) && (
                        <Badge variant="secondary" className="mt-1">
                          {depense.depense_categories?.nom || depense.nom}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isAdmin() && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openEditModal(depense)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Éditer
                      </Button>
                      <Button
                        onClick={() => handleDeleteDepense(depense.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {depense.description && (
                  <p className="text-sm text-muted-foreground mb-4">{depense.description}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Date
                    </p>
                    <p className="font-semibold">{depense.date}</p>
                  </div>
                  {depense.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{depense.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Depenses;
