import { useData } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, CreditCard, TrendingDown, TrendingUp, DollarSign, Calendar, Trash2, Phone, Briefcase, Plus } from 'lucide-react';

const SalaryDetail = ({ salaryId, onBack }) => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    salaries: dataCtx?.salaries ?? [],
    acomptes: dataCtx?.acomptes ?? []
  };
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [showAcompteModal, setShowAcompteModal] = useState(false);
  const [acompteData, setAcompteData] = useState({
    salaryId: salaryId,
    montant: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Trouver le salarié
  const salary = useMemo(() => {
    return (state.salaries || []).find(s => s.id === salaryId);
  }, [state.salaries, salaryId]);

  if (!salary) {
    return (
      <div className="space-y-6">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg">Salarié non trouvé</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper functions
  const getSalaryAcomptes = useCallback(() => {
    return (state.acomptes || []).filter(a => {
      const sId = a.salary_id ?? a.salaryId;
      return sId === salaryId;
    });
  }, [state.acomptes, salaryId]);

  const calculateTotalAcomptes = useCallback(() => {
    const acomptes = getSalaryAcomptes();
    return acomptes.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0);
  }, [getSalaryAcomptes]);

  const calculateSoldeRestant = useCallback(() => {
    const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
    const totalAcomptes = calculateTotalAcomptes();
    return salaireMensuel - totalAcomptes;
  }, [salary, calculateTotalAcomptes]);

  const handleAddAcompte = async () => {
    if (!acompteData.montant || !acompteData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }

    try {
      const payload = {
        salary_id: salaryId,
        montant: parseFloat(acompteData.montant),
        date: acompteData.date,
        description: acompteData.description || ''
      };

      if (USE_SUPABASE) {
        await dataCtx?.addAcompte?.(payload);
        await dataCtx?.fetchAcomptes?.();
      }

      toast({
        title: "Succès",
        description: "Acompte enregistré avec succès",
      });

      setAcompteData({
        salaryId: salaryId,
        montant: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setShowAcompteModal(false);
    } catch (e) {
      console.error('Erreur handleAddAcompte:', e);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || "Erreur lors de l'ajout de l'acompte",
      });
    }
  };

  const handleDeleteAcompte = async (acompteId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet acompte ?')) return;

    try {
      if (USE_SUPABASE) {
        await dataCtx?.deleteAcompte?.(acompteId);
        await dataCtx?.fetchAcomptes?.();
      }

      toast({
        title: "Succès",
        description: "Acompte supprimé avec succès",
      });
    } catch (e) {
      console.error('Erreur handleDeleteAcompte:', e);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur lors de la suppression',
      });
    }
  };

  const acomptes = getSalaryAcomptes();
  const totalAcomptes = calculateTotalAcomptes();
  const soldeRestant = calculateSoldeRestant();
  const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
  const tauxPaye = salaireMensuel > 0 ? ((totalAcomptes / salaireMensuel) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Bouton retour */}
      <Button onClick={onBack} variant="outline" size="lg">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour à la liste
      </Button>

      {/* En-tête du salarié */}
      <Card className="overflow-hidden border-2 border-primary">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-3xl text-primary-foreground mb-2">{salary.nom}</CardTitle>
                <CardDescription className="text-primary-foreground/90">
                  <div className="flex flex-col gap-1.5">
                    {salary.poste && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span className="font-medium">{salary.poste}</span>
                      </div>
                    )}
                    {salary.contact && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="font-medium">{salary.contact}</span>
                      </div>
                    )}
                  </div>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Salaire Mensuel</p>
                <p className="text-2xl font-bold">{salaireMensuel.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">Montant total</p>
              </div>
              <DollarSign className="h-10 w-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Acomptes versés</p>
                <p className="text-2xl font-bold">{acomptes.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Transactions</p>
              </div>
              <CreditCard className="h-10 w-10 text-green-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total versé</p>
                <p className="text-2xl font-bold text-green-600">{totalAcomptes.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">{tauxPaye.toFixed(0)}% payé</p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm mb-1 ${soldeRestant > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {soldeRestant > 0 ? 'Reste à payer' : 'Surpayé'}
                </p>
                <p className={`text-2xl font-bold ${soldeRestant > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  {Math.abs(soldeRestant).toFixed(2)} DA
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {soldeRestant > 0 ? 'En attente' : 'Crédit'}
                </p>
              </div>
              {soldeRestant > 0 ? (
                <TrendingDown className="h-10 w-10 text-orange-500/30" />
              ) : (
                <TrendingUp className="h-10 w-10 text-blue-500/30" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Résumé financier */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé Financier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Salaire Dû</p>
                <p className="text-3xl font-bold text-blue-600">{salaireMensuel.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">Salaire mensuel</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Versé</p>
                <p className="text-3xl font-bold text-green-600">{totalAcomptes.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">{acomptes.length} acompte{acomptes.length > 1 ? 's' : ''}</p>
              </CardContent>
            </Card>

            <Card className={soldeRestant > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}>
              <CardContent className="pt-6 text-center">
                <p className={`text-xs mb-1 ${soldeRestant > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {soldeRestant > 0 ? 'Reste à Payer' : 'Trop Payé'}
                </p>
                <p className={`text-3xl font-bold ${soldeRestant > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                  {Math.abs(soldeRestant).toFixed(2)} DA
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {soldeRestant > 0 ? 'En attente' : 'Crédit'}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Historique des acomptes */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Historique des Acomptes ({acomptes.length})
            </CardTitle>
            {isAdmin() && (
              <Button onClick={() => setShowAcompteModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un acompte
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {acomptes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Aucun acompte enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {acomptes.map((acompte) => (
                <Card key={acompte.id} className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{acompte.date}</span>
                        </div>
                        {acompte.description && (
                          <p className="text-sm text-muted-foreground">{acompte.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600 text-lg px-3 py-1">
                          {parseFloat(acompte.montant).toFixed(2)} DA
                        </Badge>
                        {isAdmin() && (
                          <Button
                            onClick={() => handleDeleteAcompte(acompte.id)}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Acompte */}
      <Dialog open={showAcompteModal} onOpenChange={setShowAcompteModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enregistrer un Acompte</DialogTitle>
            <DialogDescription>
              Ajouter un acompte pour {salary.nom}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Montant (DA) *</label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 10000"
                value={acompteData.montant}
                onChange={(e) => setAcompteData({ ...acompteData, montant: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date *</label>
              <Input
                type="date"
                value={acompteData.date}
                onChange={(e) => setAcompteData({ ...acompteData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optionnel)</label>
              <Input
                type="text"
                placeholder="Ex: Acompte du mois..."
                value={acompteData.description}
                onChange={(e) => setAcompteData({ ...acompteData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcompteModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddAcompte}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalaryDetail;

