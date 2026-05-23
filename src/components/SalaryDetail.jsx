import { useData } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, CreditCard, TrendingDown, TrendingUp, DollarSign, Calendar, Trash2, Phone, Briefcase, Plus, Printer } from 'lucide-react';
import cosmosLogo from '../assets/cosmos-logo.svg';

const SPECIAL_DESCRIPTIONS = new Set(['Retard', 'Absence', 'Bonus']);

const formatDa = (amount) => `${Number(amount).toFixed(2)} DA`;

const formatDateFr = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

const getAcompteCategory = (acompte) => {
  const desc = (acompte.description || '').trim();
  const montant = parseFloat(acompte.montant) || 0;
  if (desc === 'Retard') return 'retards';
  if (desc === 'Absence') return 'absences';
  if (desc === 'Bonus') return 'bonus';
  if (montant > 0 && !SPECIAL_DESCRIPTIONS.has(desc)) return 'avances';
  return null;
};

const FICHE_CATEGORIES = [
  { key: 'avances', title: 'Avances / Acomptes' },
  { key: 'retards', title: 'Retards' },
  { key: 'absences', title: 'Absences' },
  { key: 'bonus', title: 'Primes / Bonus' },
];

const SalaryDetail = ({ salaryId, onBack }) => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    salaries: dataCtx?.salaries ?? [],
    acomptes: dataCtx?.acomptes ?? []
  };
  const salaryHistory = dataCtx?.salaryHistory ?? [];
  const fetchSalaryHistory = dataCtx?.fetchSalaryHistory;
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Charger l'historique au montage
  useEffect(() => {
    if (USE_SUPABASE && fetchSalaryHistory) {
      fetchSalaryHistory(salaryId);
    }
  }, [salaryId, fetchSalaryHistory]);

  const [showAcompteModal, setShowAcompteModal] = useState(false);
  const [showFichePaie, setShowFichePaie] = useState(false);
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

  // Helper pour obtenir le mois actuel
  const getCurrentMonth = useCallback(() => {
    if (dataCtx?.getCurrentMonth) {
      return dataCtx.getCurrentMonth();
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [dataCtx]);

  // Helper functions - Récupérer TOUS les acomptes du salarié
  const getSalaryAcomptes = useCallback(() => {
    return (state.acomptes || []).filter(a => {
      const sId = a.salary_id ?? a.salaryId;
      return sId === salaryId;
    }).reverse(); // Trier du plus récent au plus ancien
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
      if (USE_SUPABASE) {
        await dataCtx?.addAcompte?.(
          salaryId,
          acompteData.montant,
          acompteData.date,
          acompteData.description || ''
        );
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

  const currentMonthKey = getCurrentMonth();
  const periodeFr = (() => {
    const [year, month] = currentMonthKey.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();
  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const acomptesMois = acomptes.filter((a) => {
    const moisAnnee = a.mois_annee || (a.date ? a.date.substring(0, 7) : '');
    return moisAnnee === currentMonthKey || (a.date && a.date.startsWith(currentMonthKey));
  });

  const groupedMouvements = FICHE_CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = [];
    return acc;
  }, {});
  acomptesMois.forEach((a) => {
    const category = getAcompteCategory(a);
    if (category && groupedMouvements[category]) {
      groupedMouvements[category].push(a);
    }
  });

  const totalDeductions = acomptes.reduce((sum, a) => {
    const m = parseFloat(a.montant) || 0;
    return m > 0 ? sum + m : sum;
  }, 0);

  const totalPrimes = acomptes.reduce((sum, a) => {
    const m = parseFloat(a.montant) || 0;
    return m < 0 ? sum + Math.abs(m) : sum;
  }, 0);

  const renderMontantCell = (acompte, category) => {
    const montant = parseFloat(acompte.montant) || 0;
    if (category === 'bonus') {
      return (
        <span className="font-medium text-green-700">
          +{formatDa(Math.abs(montant))}
        </span>
      );
    }
    return (
      <span className="font-medium text-orange-700">
        −{formatDa(montant)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Bouton retour + fiche de paie */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onBack} variant="outline" size="lg">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la liste
        </Button>
        <Button variant="outline" size="lg" onClick={() => setShowFichePaie(true)}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimer fiche de paie
        </Button>
      </div>

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

      {/* Historique mensuel des salaires */}
      {salaryHistory && salaryHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historique Mensuel ({salaryHistory.length} mois)
            </CardTitle>
            <CardDescription>
              Historique des salaires et acomptes par mois
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salaryHistory.map((history) => (
                <Card key={history.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-lg font-bold text-primary">
                            {history.mois_annee}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Nom: {history.nom}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {new Date(history.created_at).toLocaleDateString('fr-FR')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-xs text-muted-foreground mb-1">Salaire</p>
                        <p className="text-lg font-bold text-blue-600">
                          {parseFloat(history.salaire_mensuel).toFixed(2)} DA
                        </p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-xs text-muted-foreground mb-1">Acomptes</p>
                        <p className="text-lg font-bold text-orange-600">
                          {parseFloat(history.total_acomptes).toFixed(2)} DA
                        </p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-xs text-muted-foreground mb-1">Solde Restant</p>
                        <p className={`text-lg font-bold ${history.solde_restant >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(history.solde_restant).toFixed(2)} DA
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique des acomptes (tous les acomptes) */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tous les Acomptes ({acomptes.length})
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
              <p>Aucun acompte enregistré ce mois</p>
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
                          {acompte.mois_annee && (
                            <Badge variant="outline" className="text-xs">
                              {acompte.mois_annee}
                            </Badge>
                          )}
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

      {/* Aperçu fiche de paie */}
      {showFichePaie && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16">
          <div className="no-print fixed right-4 top-4 z-[60] flex gap-2">
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            <Button type="button" variant="outline" className="bg-white" onClick={() => setShowFichePaie(false)}>
              Fermer
            </Button>
          </div>

          <div
            id="fiche-paie-print"
            className="my-4 w-full max-w-[800px] bg-white p-8 text-black shadow-2xl print:my-0 print:shadow-none"
          >
            {/* En-tête */}
            <div className="mb-8 flex items-start justify-between gap-6 border-b border-gray-300 pb-6">
              <div className="flex items-center gap-3">
                <img src={cosmosLogo} alt="Cosmos" className="h-14 w-auto" />
                <div>
                  <p className="text-lg font-bold tracking-wide">COSMOS ALGÉRIE</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold tracking-wider">FICHE DE PAIE</h2>
                <p className="mt-1 text-sm text-gray-700">Période : {periodeFr}</p>
                <p className="text-sm text-gray-600">Édité le {dateEdition}</p>
              </div>
            </div>

            {/* Salarié */}
            <div className="mb-8 rounded border border-gray-200 bg-gray-50 p-4">
              <p className="text-lg font-semibold">{salary.nom}</p>
              <p className="mt-1 text-sm text-gray-700">
                Salaire de base : <span className="font-medium">{formatDa(salaireMensuel)}</span>
              </p>
            </div>

            {/* Tableau mouvements */}
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                Mouvements du mois
              </h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-800 text-left">
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Description</th>
                    <th className="py-2 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {FICHE_CATEGORIES.map((cat) => {
                    const rows = groupedMouvements[cat.key];
                    if (!rows?.length) return null;
                    return (
                      <React.Fragment key={cat.key}>
                        <tr className="bg-gray-100">
                          <td colSpan={3} className="py-2 pl-1 text-xs font-bold uppercase tracking-wide text-gray-700">
                            {cat.title}
                          </td>
                        </tr>
                        {rows.map((a) => (
                          <tr key={a.id} className="border-b border-gray-200">
                            <td className="py-2 pr-4">{formatDateFr(a.date)}</td>
                            <td className="py-2 pr-4">{a.description || '—'}</td>
                            <td className="py-2 text-right">{renderMontantCell(a, cat.key)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {acomptesMois.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-gray-500">
                        Aucun mouvement pour ce mois
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Récapitulatif */}
            <div className="mb-10 border-t-2 border-gray-800 pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span>Salaire de base</span>
                  <span className="font-medium tabular-nums">+{formatDa(salaireMensuel)}</span>
                </div>
                <div className="flex justify-between gap-4 text-orange-800">
                  <span>Total déductions</span>
                  <span className="font-medium tabular-nums">−{formatDa(totalDeductions)}</span>
                </div>
                <div className="flex justify-between gap-4 text-green-800">
                  <span>Total primes</span>
                  <span className="font-medium tabular-nums">+{formatDa(totalPrimes)}</span>
                </div>
                <div className="my-2 border-t border-gray-400" />
                <div className="flex justify-between gap-4 text-base font-bold">
                  <span>NET À PAYER</span>
                  <span className="tabular-nums">{formatDa(soldeRestant)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div>
                <p className="mb-12 text-sm font-medium">Signature employeur</p>
                <div className="border-t border-gray-800" />
              </div>
              <div>
                <p className="mb-12 text-sm font-medium">Signature salarié</p>
                <div className="border-t border-gray-800" />
              </div>
            </div>
          </div>
        </div>
      )}

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

