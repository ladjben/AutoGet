import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Calendar, TrendingUp, TrendingDown, Edit, Trash2 } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Colis Envoyés</h1>
        <Dialog open={showModal} onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            setEditingColis(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Colis
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingColis ? 'Modifier le Colis' : 'Nouveau Colis'}</DialogTitle>
              <DialogDescription>
                {editingColis ? 'Modifiez les informations du colis' : 'Ajoutez un nouvel envoi de colis'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nombre de colis *</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ex: 5"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date d'envoi *</label>
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
                  rows={4}
                  placeholder="Détails supplémentaires de l'envoi..."
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
      </div>

      {/* Résumé Global */}
      <Card>
        <CardHeader>
          <CardTitle>Vue d'Ensemble Globale</CardTitle>
          <CardDescription>Statistiques sur les colis envoyés</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Colis</p>
                    <p className="text-3xl font-bold">{stats.totalColis}</p>
                    <p className="text-xs text-muted-foreground mt-1">Colis envoyés au total</p>
                  </div>
                  <Package className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Jours Suivis</p>
                    <p className="text-3xl font-bold">{stats.nombreJours}</p>
                    <p className="text-xs text-muted-foreground mt-1">Jours avec enregistrements</p>
                  </div>
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Moyenne/Jour</p>
                    <p className="text-3xl font-bold">{stats.moyenneParJour.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Colis en moyenne</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Maximum</p>
                    <p className="text-3xl font-bold">{stats.maxColis}</p>
                    <p className="text-xs text-muted-foreground mt-1">Plus grand envoi</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Minimum</p>
                    <p className="text-3xl font-bold">{stats.minColis}</p>
                    <p className="text-xs text-muted-foreground mt-1">Plus petit envoi</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Jours</p>
              <p className="text-2xl font-bold">{stats.nombreJours}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Jours avec Activité</p>
              <p className="text-2xl font-bold">{stats.joursAvecActivite}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Taux d'Activité</p>
              <p className="text-2xl font-bold">{stats.tauxActivite}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Moyenne par Jour Actif</p>
              <p className="text-2xl font-bold">
                {stats.joursAvecActivite > 0 ? (stats.totalColis / stats.joursAvecActivite).toFixed(1) : '0'}
              </p>
            </div>
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
                  <span className="text-sm font-semibold">{periodStats.today.totalColis}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Jours:</span>
                  <span className="text-sm font-semibold">{periodStats.today.nombreJours}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Moyenne:</span>
                  <span className="text-sm font-semibold">{periodStats.today.moyenneParJour.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Max:</span>
                  <span className="text-sm font-semibold">{periodStats.today.maxColis}</span>
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
                  <span className="text-sm font-semibold">{periodStats.week.totalColis}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Jours:</span>
                  <span className="text-sm font-semibold">{periodStats.week.nombreJours}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Moyenne:</span>
                  <span className="text-sm font-semibold">{periodStats.week.moyenneParJour.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Max:</span>
                  <span className="text-sm font-semibold">{periodStats.week.maxColis}</span>
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
                  <span className="text-sm font-semibold">{periodStats.month.totalColis}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Jours:</span>
                  <span className="text-sm font-semibold">{periodStats.month.nombreJours}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Moyenne:</span>
                  <span className="text-sm font-semibold">{periodStats.month.moyenneParJour.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Max:</span>
                  <span className="text-sm font-semibold">{periodStats.month.maxColis}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres de Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date début</label>
              <Input
                type="date"
                value={filters.dateStart}
                onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date fin</label>
              <Input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              />
            </div>
          </div>
          {(filters.dateStart || filters.dateEnd) && (
            <Button
              onClick={() => setFilters({ dateStart: '', dateEnd: '' })}
              variant="outline"
              className="mt-4"
            >
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Liste des colis */}
      <div className="space-y-4">
        {(!state.colis || state.colis.length === 0) ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold">Aucun enregistrement de colis</p>
                <p className="text-sm mt-2">Commencez par ajouter votre premier envoi</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredColis.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-semibold">Aucun colis trouvé</p>
                <p className="text-sm mt-2">Aucun résultat pour les critères sélectionnés</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredColis.map((colis) => (
            <Card key={colis.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{colis.nombre} {colis.nombre > 1 ? 'colis envoyés' : 'colis envoyé'}</CardTitle>
                    {colis.description && (
                      <CardDescription className="mt-2">{colis.description}</CardDescription>
                    )}
                  </div>
                  {isAdmin() && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openEditModal(colis)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Éditer
                      </Button>
                      <Button
                        onClick={() => handleDeleteColis(colis.id)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Date d'envoi
                    </p>
                    <p className="font-semibold">{colis.date}</p>
                  </div>
                  {colis.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{colis.description}</p>
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

export default Colis;
