/**
 * Dépenses — présentation uniquement.
 * Formules, filtres temporels, regroupement, CRUD, protection catégories,
 * permissions et modes Supabase/localStorage inchangés.
 */
import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';
import {
  Plus,
  ShoppingCart,
  Calendar,
  Edit,
  Trash2,
  List,
  X,
  Search,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-[hsl(var(--warning))]',
          tone === 'info' && 'text-[hsl(var(--info))]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

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
  const [searchQuery, setSearchQuery] = useState('');

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

  // Recherche textuelle présentationnelle — n’altère pas le filtre temporel ni le regroupement
  const displayedDepenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredDepenses;
    return filteredDepenses.filter((d) => {
      const nom = (d.depense_categories?.nom || d.nom || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      return nom.includes(q) || desc.includes(q);
    });
  }, [filteredDepenses, searchQuery]);

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

  const hasActiveFilters =
    searchType !== 'all' || Boolean(searchQuery.trim());

  const resetFilters = () => {
    setSearchType('all');
    setSingleDate('');
    setDateRange({ start: '', end: '' });
    setSearchQuery('');
  };

  const openCreateModal = () => {
    setEditingDepense(null);
    resetForm();
    setShowModal(true);
  };

  const categoryName = (depense) =>
    depense.depense_categories?.nom || depense.nom || 'Sans nom';

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Opérations"
        title="Dépenses"
        description="Suivi des dépenses — montants, catégories et périodes."
        actions={
          <>
            <Dialog open={showCategoriesModal} onOpenChange={setShowCategoriesModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <List className="mr-2 h-4 w-4" />
                  Catégories
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Gérer les catégories</DialogTitle>
                  <DialogDescription>
                    Créez et gérez vos catégories de dépenses
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
                    <p className="mb-2 text-sm font-medium">Nouvelle catégorie</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Ex: Transport, Loyer, Nourriture…"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                      />
                      <Button onClick={handleAddCategory} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {USE_SUPABASE
                        ? 'La catégorie sera créée immédiatement dans la base de données.'
                        : 'En mode local, créez une dépense avec ce nom pour créer la catégorie.'}
                    </p>
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-semibold">
                      Catégories existantes ({depenseCategories.length})
                    </h4>
                    {depenseCategories.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
                        <p>Aucune catégorie créée encore</p>
                        <p className="mt-1 text-xs">
                          Créez votre première dépense pour voir la catégorie apparaître ici
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                            <div
                              key={cat.id || cat.nom}
                              className="flex items-start justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{cat.nom}</p>
                                <p className="text-xs text-muted-foreground">
                                  {count} {count === 1 ? 'dépense' : 'dépenses'}
                                </p>
                                <p className="text-sm font-semibold tabular-nums">
                                  {formatDa(total)}
                                </p>
                              </div>
                              {USE_SUPABASE && isAdmin() && (
                                <Button
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  aria-label={`Supprimer ${cat.nom}`}
                                >
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle dépense
            </Button>
          </>
        }
      />

      {/* KPI principaux */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Montant total" value={formatDa(globalStats.total)} tone="danger" />
        <MetaStat label="Dépenses" value={formatNum(globalStats.count)} />
        <MetaStat label="Moyenne" value={formatDa(globalStats.moyenne)} />
        <MetaStat label="Catégories" value={formatNum(globalStats.nombreCategories)} />
      </div>

      {/* Comparaison périodes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { key: 'today', label: "Aujourd'hui", stats: periodStats.today },
          { key: 'week', label: 'Cette semaine', stats: periodStats.week },
          { key: 'month', label: 'Ce mois', stats: periodStats.month },
        ].map(({ key, label, stats }) => (
          <div
            key={key}
            className="rounded-lg border border-border/80 bg-card px-4 py-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-lg font-semibold tabular-nums">{formatDa(stats.total)}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <p>Nb</p>
                <p className="font-medium tabular-nums text-foreground">
                  {formatNum(stats.count)}
                </p>
              </div>
              <div>
                <p>Moy.</p>
                <p className="font-medium tabular-nums text-foreground">
                  {formatDa(stats.moyenne)}
                </p>
              </div>
              <div>
                <p>Cat.</p>
                <p className="font-medium tabular-nums text-foreground">
                  {formatNum(stats.categories)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recherche + filtres temporels */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="dep-search">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="dep-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Catégorie ou description…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="min-w-[160px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="dep-type">
            Période
          </label>
          <select
            id="dep-type"
            value={searchType}
            onChange={(e) => {
              setSearchType(e.target.value);
              setSingleDate('');
              setDateRange({ start: '', end: '' });
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="all">Toutes les dépenses</option>
            <option value="single">Date unique</option>
            <option value="range">Période (Du…au…)</option>
          </select>
        </div>

        {searchType === 'single' && (
          <div className="min-w-[140px] space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dep-single">
              Date
            </label>
            <Input
              id="dep-single"
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="h-9"
            />
          </div>
        )}

        {searchType === 'range' && (
          <>
            <div className="min-w-[140px] space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="dep-start">
                Date début
              </label>
              <Input
                id="dep-start"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="min-w-[140px] space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="dep-end">
                Date fin
              </label>
              <Input
                id="dep-end"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="h-9"
              />
            </div>
          </>
        )}

        {hasActiveFilters && (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </section>

      {filteredDepenses.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">
            Total filtré ({formatNum(filteredDepenses.length)} dépense
            {filteredDepenses.length !== 1 ? 's' : ''})
          </span>
          <span className="text-base font-semibold tabular-nums">
            {formatDa(calculateTotal())}
          </span>
        </div>
      )}

      {/* Résumé par catégorie */}
      {depensesParNom.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Par catégorie
            </h2>
            <p className="text-xs text-muted-foreground">
              Total, nombre et moyenne — selon le filtre temporel actif
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {depensesParNom.map((groupe) => (
              <div
                key={groupe.nom}
                className="rounded-lg border border-border/80 bg-card px-3 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{groupe.nom}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatNum(groupe.count)}×
                  </span>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatDa(groupe.total)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Moyenne : {formatDa(groupe.total / groupe.count)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Liste des dépenses */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Liste des dépenses
          </h2>
          <p className="text-xs text-muted-foreground">
            {(!state.depenses || state.depenses.length === 0)
              ? 'Aucune dépense'
              : `${formatNum(displayedDepenses.length)} dépense(s)${
                  hasActiveFilters || searchQuery.trim() ? ' (filtrées)' : ''
                }`}
          </p>
        </div>

        {(!state.depenses || state.depenses.length === 0) ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucune dépense enregistrée</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Créez votre première dépense pour démarrer le suivi.
            </p>
            <Button className="mt-4" size="sm" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle dépense
            </Button>
          </div>
        ) : filteredDepenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun résultat</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucune dépense trouvée pour les critères sélectionnés
            </p>
          </div>
        ) : displayedDepenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucune dépense ne correspond à « {searchQuery.trim()} »
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Catégorie</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                    {isAdmin() && (
                      <th className="w-12 px-3 py-2.5 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedDepenses.map((depense) => (
                    <tr
                      key={depense.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDate(depense.date)}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {categoryName(depense)}
                      </td>
                      <td className="max-w-[240px] truncate px-3 py-2.5 text-muted-foreground">
                        {depense.description || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-danger">
                        {formatDa(depense.montant)}
                      </td>
                      {isAdmin() && (
                        <td className="px-3 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEditModal(depense)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteDepense(depense.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {displayedDepenses.map((depense) => (
                <div
                  key={depense.id}
                  className="rounded-lg border border-border/80 bg-card px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{categoryName(depense)}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(depense.date)}
                      </p>
                      {depense.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {depense.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <p className="text-sm font-semibold tabular-nums text-danger">
                        {formatDa(depense.montant)}
                      </p>
                      {isAdmin() && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => openEditModal(depense)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteDepense(depense.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Dialog dépense */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            setEditingDepense(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepense ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </DialogTitle>
            <DialogDescription>
              {editingDepense
                ? 'Modifiez les informations de la dépense'
                : 'Ajoutez une nouvelle dépense'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="dep-nom">
                Nom de la dépense (catégorie) *
              </label>
              <Input
                id="dep-nom"
                type="text"
                list="categories-list"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Tapez un nom ou sélectionnez une catégorie existante…"
                required
              />
              {categoriesExistantes.length > 0 && (
                <datalist id="categories-list">
                  {categoriesExistantes.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              )}
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
                  <List className="mr-1 h-3 w-3" />
                  Gérer les catégories
                </Button>
                {categoriesExistantes.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {categoriesExistantes.length}{' '}
                    {categoriesExistantes.length === 1 ? 'catégorie' : 'catégories'}{' '}
                    disponible{categoriesExistantes.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="dep-montant">
                Montant (DA) *
              </label>
              <Input
                id="dep-montant"
                type="number"
                step="0.01"
                value={formData.montant}
                onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="dep-date">
                Date *
              </label>
              <Input
                id="dep-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="dep-desc">
                Description / commentaire
              </label>
              <Textarea
                id="dep-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Détails supplémentaires de la dépense…"
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
    </PageSurface>
  );
};

export default Depenses;
