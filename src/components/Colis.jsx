/**
 * Colis envoyés — présentation uniquement.
 * Formules, filtres temporels, CRUD, permissions et dual-path
 * Supabase/localStorage inchangés.
 */
import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';
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
  DialogDescription,
} from '@/components/ui/dialog';
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
  Package,
  Calendar,
  Edit,
  Trash2,
  Search,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';

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
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editingColis, setEditingColis] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: ''
  });

  const [formData, setFormData] = useState({
    nombre: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const filteredColis = useMemo(() => {
    let filtered = (state.colis || []).slice().reverse();
    
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

  // Recherche présentationnelle — n’altère pas filteredColis ni les stats
  const displayedColis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredColis;
    return filteredColis.filter((c) => {
      const desc = (c.description || '').toLowerCase();
      const nombre = String(c.nombre ?? '');
      return desc.includes(q) || nombre.includes(q);
    });
  }, [filteredColis, searchQuery]);

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

  const stats = useMemo(() => {
    return calculateStatsColis(filteredColis);
  }, [filteredColis]);

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
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires (nombre, date)",
      });
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
      toast({
        title: "Succès",
        description: "Colis ajouté avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur addColis:', e);
    }
  };

  const handleUpdateColis = async () => {
    if (!formData.nombre || !formData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
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
      toast({
        title: "Succès",
        description: "Colis mis à jour avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
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
      toast({
        title: "Succès",
        description: "Colis supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
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

  const openCreateModal = () => {
    setEditingColis(null);
    resetForm();
    setShowModal(true);
  };

  const hasActiveFilters =
    Boolean(filters.dateStart || filters.dateEnd) || Boolean(searchQuery.trim());

  const resetFilters = () => {
    setFilters({ dateStart: '', dateEnd: '' });
    setSearchQuery('');
  };

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Opérations"
        title="Colis envoyés"
        description="Suivi des volumes d’envois — dates, quantités et descriptions."
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau colis
          </Button>
        }
      />

      {/* KPI compacts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Total des colis" value={formatNum(stats.totalColis)} tone="info" />
        <MetaStat label="Enregistrements" value={formatNum(stats.nombreJours)} />
        <MetaStat label="Jours avec activité" value={formatNum(stats.joursAvecActivite)} tone="success" />
        <MetaStat
          label="Moyenne / jour"
          value={Number(stats.moyenneParJour || 0).toLocaleString('fr-FR', {
            maximumFractionDigits: 1,
            minimumFractionDigits: 0,
          })}
        />
      </div>

      {/* Comparaison périodes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { key: 'today', label: "Aujourd'hui", stats: periodStats.today },
          { key: 'week', label: 'Cette semaine', stats: periodStats.week },
          { key: 'month', label: 'Ce mois', stats: periodStats.month },
        ].map(({ key, label, stats: ps }) => (
          <div
            key={key}
            className="rounded-lg border border-border/80 bg-card px-4 py-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatNum(ps.totalColis)}{' '}
              <span className="text-sm font-normal text-muted-foreground">colis</span>
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <p>Jours</p>
                <p className="font-medium tabular-nums text-foreground">
                  {formatNum(ps.nombreJours)}
                </p>
              </div>
              <div>
                <p>Moy.</p>
                <p className="font-medium tabular-nums text-foreground">
                  {Number(ps.moyenneParJour || 0).toLocaleString('fr-FR', {
                    maximumFractionDigits: 1,
                  })}
                </p>
              </div>
              <div>
                <p>Max</p>
                <p className="font-medium tabular-nums text-foreground">
                  {formatNum(ps.maxColis)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recherche + filtres */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="colis-search">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="colis-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Description ou nombre…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="colis-start">
            Date début
          </label>
          <Input
            id="colis-start"
            type="date"
            value={filters.dateStart}
            onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="colis-end">
            Date fin
          </label>
          <Input
            id="colis-end"
            type="date"
            value={filters.dateEnd}
            onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
            className="h-9"
          />
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </section>

      {/* Liste */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Historique des envois
          </h2>
          <p className="text-xs text-muted-foreground">
            {(!state.colis || state.colis.length === 0)
              ? 'Aucun enregistrement'
              : `${formatNum(displayedColis.length)} enregistrement(s)${
                  hasActiveFilters ? ' (filtrés)' : ''
                } · ${formatNum(stats.totalColis)} colis`}
          </p>
        </div>

        {(!state.colis || state.colis.length === 0) ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun enregistrement de colis</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Commencez par ajouter votre premier envoi
            </p>
            <Button className="mt-4" size="sm" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau colis
            </Button>
          </div>
        ) : filteredColis.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun colis trouvé</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun résultat pour les critères sélectionnés
            </p>
          </div>
        ) : displayedColis.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun enregistrement ne correspond à « {searchQuery.trim()} »
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 text-right font-medium">Nombre</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    {isAdmin() && (
                      <th className="w-12 px-3 py-2.5 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedColis.map((colis) => {
                    const n = parseInt(colis.nombre, 10) || 0;
                    return (
                      <tr
                        key={colis.id}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatDate(colis.date)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-base font-semibold tabular-nums text-[hsl(var(--info))]">
                            {formatNum(n)}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            colis
                          </span>
                        </td>
                        <td className="max-w-[280px] truncate px-3 py-2.5 text-muted-foreground">
                          {colis.description || '—'}
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
                                <DropdownMenuItem onClick={() => openEditModal(colis)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteColis(colis.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {displayedColis.map((colis) => {
                const n = parseInt(colis.nombre, 10) || 0;
                return (
                  <div
                    key={colis.id}
                    className="rounded-lg border border-border/80 bg-card px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(colis.date)}
                        </p>
                        {colis.description ? (
                          <p className="text-sm text-foreground line-clamp-2">
                            {colis.description}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sans description</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular-nums text-[hsl(var(--info))]">
                            {formatNum(n)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {n > 1 ? 'colis' : 'colis'}
                          </p>
                        </div>
                        {isAdmin() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEditModal(colis)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteColis(colis.id)}
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
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Dialog création / modification */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            setEditingColis(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingColis ? 'Modifier le colis' : 'Nouveau colis'}
            </DialogTitle>
            <DialogDescription>
              {editingColis
                ? 'Modifiez les informations du colis'
                : 'Ajoutez un nouvel envoi de colis'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="colis-nombre">
                Nombre de colis *
              </label>
              <Input
                id="colis-nombre"
                type="number"
                min="1"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ex: 5"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="colis-date">
                Date d&apos;envoi *
              </label>
              <Input
                id="colis-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="colis-desc">
                Description / commentaire
              </label>
              <Textarea
                id="colis-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Détails supplémentaires de l'envoi…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingColis(null);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button onClick={editingColis ? handleUpdateColis : handleAddColis}>
              {editingColis ? 'Modifier' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSurface>
  );
};

export default Colis;
