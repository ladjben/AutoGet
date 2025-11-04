import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Users, CreditCard, TrendingDown, TrendingUp, DollarSign, Calendar, Trash2, Edit, Phone, Briefcase, ChevronRight } from 'lucide-react';
import SalaryDetail from './SalaryDetail';

const Salaries = () => {
  const [selectedSalaryId, setSelectedSalaryId] = useState(null);

  // Si un salarié est sélectionné, afficher sa page de détail
  if (selectedSalaryId) {
    return <SalaryDetail salaryId={selectedSalaryId} onBack={() => setSelectedSalaryId(null)} />;
  }

  // Sinon, afficher la liste
  return <SalariesList onSelectSalary={setSelectedSalaryId} />;
};

const SalariesList = ({ onSelectSalary }) => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    salaries: dataCtx?.salaries ?? [],
    acomptes: dataCtx?.acomptes ?? []
  };
  const dispatch = dataCtx?.dispatch;
  const generateId = dataCtx?.generateId;
  const addSalary = dataCtx?.addSalary;
  const updateSalary = dataCtx?.updateSalary;
  const deleteSalary = dataCtx?.deleteSalary;
  const addAcompte = dataCtx?.addAcompte;
  const deleteAcompte = dataCtx?.deleteAcompte;
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [showAcompteModal, setShowAcompteModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [filters, setFilters] = useState({
    salaryId: '',
    dateStart: '',
    dateEnd: ''
  });
  const [formData, setFormData] = useState({
    nom: '',
    salaire_mensuel: '',
    contact: '',
    poste: ''
  });
  const [acompteData, setAcompteData] = useState({
    salaryId: '',
    montant: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Charger les données au démarrage (Supabase)
  useEffect(() => {
    if (USE_SUPABASE) {
      if (dataCtx?.fetchSalaries) {
        dataCtx.fetchSalaries();
      }
      if (dataCtx?.fetchAcomptes) {
        dataCtx.fetchAcomptes();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper functions
  const getSalaryAcomptes = useCallback((salaryId) => {
    let filteredAcomptes = (state.acomptes || []).filter(a => {
      const sId = a.salary_id ?? a.salaryId;
      return sId === salaryId;
    });

    // Appliquer les filtres de date si présents
    if (filters.dateStart && filters.dateEnd) {
      filteredAcomptes = filteredAcomptes.filter(a => {
        const acompteDate = a.date;
        return acompteDate >= filters.dateStart && acompteDate <= filters.dateEnd;
      });
    }

    return filteredAcomptes.reverse();
  }, [state.acomptes, filters.dateStart, filters.dateEnd]);

  const calculateTotalAcomptes = useCallback((salaryId) => {
    const acomptes = getSalaryAcomptes(salaryId);
    return acomptes.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0);
  }, [getSalaryAcomptes]);

  const calculateSoldeRestant = useCallback((salary) => {
    const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
    const totalAcomptes = calculateTotalAcomptes(salary.id);
    return salaireMensuel - totalAcomptes;
  }, [calculateTotalAcomptes]);

  // Filtrer les salariés
  const filteredSalaries = useMemo(() => {
    if (!filters.salaryId) return state.salaries || [];
    return (state.salaries || []).filter(s => s.id === filters.salaryId);
  }, [state.salaries, filters.salaryId]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const salaries = filteredSalaries;
    const totalSalaires = salaries.reduce((sum, s) => sum + (parseFloat(s.salaire_mensuel ?? s.salaireMensuel ?? 0)), 0);
    const totalAcomptes = salaries.reduce((sum, s) => {
      return sum + calculateTotalAcomptes(s.id);
    }, 0);
    const soldeTotal = totalSalaires - totalAcomptes;
    const salariesAvecAcomptes = salaries.filter(s => calculateTotalAcomptes(s.id) > 0).length;
    
    return {
      totalSalaries: salaries.length,
      totalSalaires,
      totalAcomptes,
      soldeTotal,
      salariesAvecAcomptes,
      moyenneSalaire: salaries.length > 0 ? totalSalaires / salaries.length : 0,
      moyenneAcomptes: salaries.length > 0 ? totalAcomptes / salaries.length : 0
    };
  }, [filteredSalaries, calculateTotalAcomptes]);

  // Statistiques par période
  const periodStats = useMemo(() => {
    const today = filterByPeriod(state.acomptes || [], 'date', 'today');
    const week = filterByPeriod(state.acomptes || [], 'date', 'week');
    const month = filterByPeriod(state.acomptes || [], 'date', 'month');
    
    const calcStats = (acomptesList) => {
      const total = acomptesList.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0);
      const count = acomptesList.length;
      const moyenne = count > 0 ? total / count : 0;
      return { total, count, moyenne };
    };
    
    return {
      today: calcStats(today),
      week: calcStats(week),
      month: calcStats(month)
    };
  }, [state.acomptes]);

  const handleAddSalary = async () => {
    if (!formData.nom || !formData.salaire_mensuel) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom et le salaire mensuel",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        await addSalary(formData.nom, formData.salaire_mensuel, formData.contact, formData.poste);
      } else {
        const newSalary = {
          id: generateId(),
          nom: formData.nom,
          salaire_mensuel: parseFloat(formData.salaire_mensuel),
          contact: formData.contact || '',
          poste: formData.poste || ''
        };
        dispatch({ type: ActionTypes.ADD_SALARY, payload: newSalary });
      }
      setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
      setShowModal(false);
      toast({
        title: "Succès",
        description: "Salarié ajouté avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleUpdateSalary = async () => {
    if (!formData.nom || !formData.salaire_mensuel) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom et le salaire mensuel",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        await updateSalary(editingSalary.id, {
          nom: formData.nom,
          salaire_mensuel: parseFloat(formData.salaire_mensuel),
          contact: formData.contact,
          poste: formData.poste
        });
      } else {
        const updatedSalary = {
          ...editingSalary,
          nom: formData.nom,
          salaire_mensuel: parseFloat(formData.salaire_mensuel),
          contact: formData.contact || '',
          poste: formData.poste || ''
        };
        dispatch({ type: ActionTypes.UPDATE_SALARY, payload: updatedSalary });
      }
      setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
      setShowModal(false);
      setEditingSalary(null);
      toast({
        title: "Succès",
        description: "Salarié mis à jour avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleDeleteSalary = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce salarié ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteSalary(id);
      } else {
        dispatch({ type: ActionTypes.DELETE_SALARY, payload: id });
      }
      toast({
        title: "Succès",
        description: "Salarié supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleAddAcompte = async () => {
    if (!acompteData.salaryId || !acompteData.montant || !acompteData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        const dateFormatted = acompteData.date.includes('T') 
          ? acompteData.date.split('T')[0] 
          : acompteData.date;
        await addAcompte(acompteData.salaryId, acompteData.montant, dateFormatted, acompteData.description || '');
      } else {
        const dateFormatted = acompteData.date.includes('T') 
          ? acompteData.date.split('T')[0] 
          : acompteData.date;
        const newAcompte = {
          id: generateId(),
          salaryId: acompteData.salaryId,
          montant: parseFloat(acompteData.montant),
          date: dateFormatted,
          description: acompteData.description || ''
        };
        dispatch({ type: ActionTypes.ADD_ACOMPTE, payload: newAcompte });
      }

      setAcompteData({
        salaryId: '',
        montant: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setShowAcompteModal(false);
      
      toast({
        title: "Succès",
        description: "Acompte enregistré avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleAddAcompte:', e);
    }
  };

  const handleDeleteAcompte = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet acompte ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteAcompte(id);
      } else {
        dispatch({ type: ActionTypes.DELETE_ACOMPTE, payload: id });
      }
      toast({
        title: "Succès",
        description: "Acompte supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleDeleteAcompte:', e);
    }
  };

  const openEditModal = (salary) => {
    setEditingSalary(salary);
    setFormData({
      nom: salary.nom,
      salaire_mensuel: salary.salaire_mensuel ?? salary.salaireMensuel ?? '',
      contact: salary.contact || '',
      poste: salary.poste || ''
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Salariés</h1>
        <div className="flex gap-3">
          <Dialog open={showAcompteModal} onOpenChange={setShowAcompteModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white border-green-600">
                <CreditCard className="h-4 w-4 mr-2" />
                Nouvel Acompte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvel Acompte</DialogTitle>
                <DialogDescription>
                  Enregistrez un nouvel acompte pour un salarié
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Salarié *</label>
                  <select
                    value={acompteData.salaryId}
                    onChange={(e) => setAcompteData({ ...acompteData, salaryId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Sélectionner</option>
                    {(state.salaries || []).map((salary) => {
                      const solde = calculateSoldeRestant(salary);
                      const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
                      return (
                        <option key={salary.id} value={salary.id}>
                          {salary.nom} - Salaire: {salaireMensuel.toFixed(2)} DA (Solde: {solde.toFixed(2)} DA)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Montant (DA) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={acompteData.montant}
                    onChange={(e) => setAcompteData({ ...acompteData, montant: e.target.value })}
                  />
                </div>

                {acompteData.salaryId && (
                  <Card>
                    <CardContent className="pt-6">
                      {(() => {
                        const salary = (state.salaries || []).find(s => s.id === acompteData.salaryId);
                        if (!salary) return null;
                        const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
                        const totalAcomptes = calculateTotalAcomptes(salary.id);
                        const soldeActuel = salaireMensuel - totalAcomptes;
                        const montantAcompte = parseFloat(acompteData.montant) || 0;
                        const nouveauSolde = soldeActuel - montantAcompte;
                        
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Salaire mensuel:</span>
                              <span className="font-semibold">{salaireMensuel.toFixed(2)} DA</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Total acomptes:</span>
                              <span className="font-semibold text-orange-600">{totalAcomptes.toFixed(2)} DA</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Solde actuel:</span>
                              <span className="font-semibold">{soldeActuel.toFixed(2)} DA</span>
                            </div>
                            {montantAcompte > 0 && (
                              <>
                                <Separator />
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Nouvel acompte:</span>
                                  <span className="font-semibold text-red-600">-{montantAcompte.toFixed(2)} DA</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-semibold">Nouveau solde:</span>
                                  <span className={`font-bold text-lg ${nouveauSolde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {nouveauSolde.toFixed(2)} DA
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Date *</label>
                  <Input
                    type="date"
                    value={acompteData.date}
                    onChange={(e) => setAcompteData({ ...acompteData, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    value={acompteData.description}
                    onChange={(e) => setAcompteData({ ...acompteData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAcompteModal(false);
                    setAcompteData({
                      salaryId: '',
                      montant: '',
                      date: new Date().toISOString().split('T')[0],
                      description: ''
                    });
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleAddAcompte}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showModal} onOpenChange={(open) => {
            setShowModal(open);
            if (!open) {
              setEditingSalary(null);
              setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Salarié
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSalary ? 'Modifier le Salarié' : 'Nouveau Salarié'}</DialogTitle>
                <DialogDescription>
                  {editingSalary ? 'Modifiez les informations du salarié' : 'Ajoutez un nouveau salarié à votre base de données'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nom *</label>
                  <Input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Salaire Mensuel (DA) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.salaire_mensuel}
                    onChange={(e) => setFormData({ ...formData, salaire_mensuel: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Contact</label>
                  <Input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Poste</label>
                  <Input
                    type="text"
                    value={formData.poste}
                    onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSalary(null);
                    setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={editingSalary ? handleUpdateSalary : handleAddSalary}>
                  {editingSalary ? 'Modifier' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Résumé Global */}
      <Card>
        <CardHeader>
          <CardTitle>Vue d'Ensemble Globale</CardTitle>
          <CardDescription>Statistiques complètes sur tous les salariés</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Salariés</p>
                    <p className="text-3xl font-bold">{globalStats.totalSalaries}</p>
                    <p className="text-xs text-muted-foreground mt-1">Employés actifs</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Salaires</p>
                    <p className="text-3xl font-bold">{globalStats.totalSalaires.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">Salaire mensuel total</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Acomptes</p>
                    <p className="text-3xl font-bold text-orange-600">{globalStats.totalAcomptes.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">Acomptes versés</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Solde Restant</p>
                    <p className={`text-3xl font-bold ${globalStats.soldeTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {globalStats.soldeTotal.toFixed(2)} DA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">À verser à la fin du mois</p>
                  </div>
                  {globalStats.soldeTotal >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Moyenne Salaire</p>
              <p className="text-xl font-bold">{globalStats.moyenneSalaire.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Moyenne Acomptes</p>
              <p className="text-xl font-bold">{globalStats.moyenneAcomptes.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Salariés avec Acomptes</p>
              <p className="text-xl font-bold">{globalStats.salariesAvecAcomptes}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Taux Versé</p>
              <p className="text-xl font-bold">
                {globalStats.totalSalaires > 0 ? ((globalStats.totalAcomptes / globalStats.totalSalaires) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques par Période */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques par Période</CardTitle>
          <CardDescription>Vue détaillée des acomptes par jour, semaine et mois</CardDescription>
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
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Salarié</label>
              <select
                value={filters.salaryId}
                onChange={(e) => setFilters({ ...filters, salaryId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Tous les salariés</option>
                {(state.salaries || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>
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
          {(filters.salaryId || filters.dateStart || filters.dateEnd) && (
            <Button
              onClick={() => setFilters({ salaryId: '', dateStart: '', dateEnd: '' })}
              variant="outline"
              className="mt-4"
            >
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Liste des salariés */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSalaries.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Aucun salarié trouvé</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredSalaries.map((salary) => {
            const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
            const totalAcomptes = calculateTotalAcomptes(salary.id);
            const soldeRestant = calculateSoldeRestant(salary);
            const acomptes = getSalaryAcomptes(salary.id);
            
            return (
              <Card 
                key={salary.id} 
                className="overflow-hidden cursor-pointer hover:shadow-xl transition-all border-2 hover:border-primary hover:scale-[1.02]"
                onClick={() => onSelectSalary(salary.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-1">{salary.nom}</h3>
                        <p className="text-sm text-muted-foreground">
                          Cliquez pour voir les détails
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin() && (
                        <>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(salary);
                            }}
                            variant="ghost"
                            size="icon"
                          >
                            <Edit className="h-5 w-5" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSalary(salary.id);
                            }}
                            variant="ghost"
                            size="icon"
                          >
                            <Trash2 className="h-5 w-5 text-destructive" />
                          </Button>
                        </>
                      )}
                      <ChevronRight className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-500/50" />
                      <p className="text-xl font-bold">{salaireMensuel.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Salaire</p>
                    </div>
                    <div className="text-center">
                      <CreditCard className="h-5 w-5 mx-auto mb-1 text-green-500/50" />
                      <p className="text-xl font-bold">{acomptes.length}</p>
                      <p className="text-xs text-muted-foreground">Acomptes</p>
                    </div>
                    <div className="text-center">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500/50" />
                      <p className="text-xl font-bold text-green-600">{totalAcomptes.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Versé</p>
                    </div>
                    <div className="text-center">
                      {soldeRestant > 0 ? (
                        <TrendingDown className="h-5 w-5 mx-auto mb-1 text-orange-500/50" />
                      ) : (
                        <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-500/50" />
                      )}
                      <p className={`text-xl font-bold ${soldeRestant > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                        {Math.abs(soldeRestant).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">{soldeRestant > 0 ? 'Reste' : 'Crédit'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Salaries;

