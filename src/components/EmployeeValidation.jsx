import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../context/UnifiedDataContext';
import { useAuth } from '../context/AuthContext';
import { USE_SUPABASE } from '../config';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Package,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatDaAmount = (value) =>
  Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR');

const formatPaires = (count) => {
  const n = Number(count) || 0;
  return `${n.toLocaleString('fr-FR')} paire${n > 1 ? 's' : ''}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

const EmployeeValidation = () => {
  const dataCtx = useData();
  const { user } = useAuth();
  const { toast } = useToast();

  const [screen, setScreen] = useState('list');
  const [entreesEnAttente, setEntreesEnAttente] = useState([]);
  const [selectedEntree, setSelectedEntree] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingLignes, setLoadingLignes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadEntreesEnAttente = useCallback(async () => {
    if (!dataCtx?.fetchEntreesEnAttente) return;
    setLoadingList(true);
    try {
      const data = await dataCtx.fetchEntreesEnAttente();
      setEntreesEnAttente(data || []);
    } catch (e) {
      console.error('Erreur chargement envois en attente:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger les envois en attente',
      });
    } finally {
      setLoadingList(false);
    }
  }, [dataCtx, toast]);

  useEffect(() => {
    if (USE_SUPABASE) {
      loadEntreesEnAttente();
    }
  }, [loadEntreesEnAttente]);

  const openValidation = async (entree) => {
    setSelectedEntree(entree);
    setScreen('validate');
    setLoadingLignes(true);
    setLignes([]);

    try {
      const detail = await dataCtx.fetchEntreeLignesDetail(entree.id);
      setLignes(
        (detail || []).map((l) => ({
          ligne_id: l.ligne_id,
          produit_nom: l.produit_nom || 'Produit',
          qte_envoyee: parseInt(l.qte_envoyee, 10) || 0,
          prix_achat: parseFloat(l.prix_achat) || 0,
          qteRecue: parseInt(l.qte_envoyee, 10) || 0,
        }))
      );
    } catch (e) {
      console.error('Erreur chargement lignes:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger les lignes',
      });
      setScreen('list');
      setSelectedEntree(null);
    } finally {
      setLoadingLignes(false);
    }
  };

  const handleQteRecueChange = (ligneId, value) => {
    const parsed = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setLignes((prev) =>
      prev.map((l) => (l.ligne_id === ligneId ? { ...l, qteRecue: parsed } : l))
    );
  };

  const totals = useMemo(() => {
    return lignes.reduce(
      (acc, l) => {
        const manqueQte = Math.max(l.qte_envoyee - l.qteRecue, 0);
        acc.envoye += l.qte_envoyee * l.prix_achat;
        acc.recu += l.qteRecue * l.prix_achat;
        acc.manque += manqueQte * l.prix_achat;
        acc.manquePaires += manqueQte;
        return acc;
      },
      { envoye: 0, recu: 0, manque: 0, manquePaires: 0 }
    );
  }, [lignes]);

  const hasManque = totals.manquePaires > 0;

  const handleConfirm = async () => {
    if (!selectedEntree || !user?.id) return;

    setSubmitting(true);
    try {
      const result = await dataCtx.validateEntree({
        entreeId: selectedEntree.id,
        fournisseurId: selectedEntree.fournisseur_id,
        validatedBy: user.id,
        lignesRecues: lignes.map((l) => ({
          ligne_id: l.ligne_id,
          quantite_recue: l.qteRecue,
        })),
      });

      const isLitige = result.statut === 'litige';
      toast({
        title: isLitige ? 'Envoi en litige' : 'Envoi validé',
        description: isLitige
          ? `Manque : ${result.totalManquePaires} paire(s), ${formatDa(result.totalManqueValeur)}. Le fournisseur a été notifié.`
          : 'Réception conforme — envoi validé avec succès.',
        variant: isLitige ? 'destructive' : 'default',
      });

      setScreen('list');
      setSelectedEntree(null);
      setLignes([]);
      await loadEntreesEnAttente();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de valider l\'envoi',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setScreen('list');
    setSelectedEntree(null);
    setLignes([]);
  };

  const getFournisseurNom = (entree) =>
    entree.fournisseurs?.nom || 'Fournisseur inconnu';

  if (!USE_SUPABASE) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center text-muted-foreground">
          La validation des envois nécessite Supabase.
        </CardContent>
      </Card>
    );
  }

  // Écran validation
  if (screen === 'validate' && selectedEntree) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={handleBack} disabled={submitting}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la liste
        </Button>

        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Validation de l&apos;envoi
            </CardTitle>
            <CardDescription>
              {getFournisseurNom(selectedEntree)} — {formatDate(selectedEntree.date)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingLignes ? (
              <p className="text-center text-muted-foreground py-8">Chargement des lignes…</p>
            ) : lignes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune ligne dans cet envoi</p>
            ) : (
              <>
                <div className="space-y-3">
                  {lignes.map((ligne) => {
                    const manqueQte = Math.max(ligne.qte_envoyee - ligne.qteRecue, 0);
                    const manqueDa = manqueQte * ligne.prix_achat;
                    return (
                      <Card key={ligne.ligne_id} className="bg-muted/20">
                        <CardContent className="p-4">
                          <div className="flex flex-wrap justify-between gap-4 items-start">
                            <div className="flex-1 min-w-[200px]">
                              <p className="font-medium">{ligne.produit_nom}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Envoyé : <span className="font-semibold">{ligne.qte_envoyee}</span> paire(s)
                                {' · '}
                                {formatDa(ligne.prix_achat)} / paire
                              </p>
                            </div>
                            <div className="flex flex-wrap items-end gap-4">
                              <div>
                                <label className="text-xs font-medium mb-1 block">Reçu</label>
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-24"
                                  value={ligne.qteRecue}
                                  onChange={(e) =>
                                    handleQteRecueChange(ligne.ligne_id, e.target.value)
                                  }
                                  disabled={submitting}
                                />
                              </div>
                              <div className="text-right min-w-[160px]">
                                <p className="text-xs text-muted-foreground mb-1">Manque</p>
                                <p
                                  className={`font-semibold ${
                                    manqueQte > 0 ? 'text-red-600' : 'text-green-600'
                                  }`}
                                >
                                  {manqueQte > 0
                                    ? `−${formatPaires(manqueQte)} · −${formatDaAmount(manqueDa)} DA`
                                    : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="bg-muted/30">
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total envoyé</span>
                      <span className="font-semibold">{formatDa(totals.envoye)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total reçu</span>
                      <span className="font-semibold text-green-600">{formatDa(totals.recu)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total manque</span>
                      <span className={`font-semibold ${hasManque ? 'text-red-600' : 'text-green-600'}`}>
                        {hasManque
                          ? `${formatDa(totals.manque)} · ${formatPaires(totals.manquePaires)}`
                          : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {hasManque && (
                  <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                    <CardContent className="pt-6 flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800 dark:text-orange-300">
                          Manque constaté
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                          Cet envoi sera marqué <strong>litige</strong> et le fournisseur sera
                          automatiquement notifié du manquant ({formatDa(totals.manque)} · {formatPaires(totals.manquePaires)}).
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                <Button
                  onClick={handleConfirm}
                  disabled={submitting || loadingLignes || lignes.length === 0}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {submitting ? 'Validation…' : 'Confirmer la validation'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Écran liste
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Validation des envois</h1>
        <p className="text-muted-foreground mt-1">
          Envois fournisseurs en attente de réception
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Envois en attente
            {!loadingList && (
              <Badge variant="secondary" className="ml-2">
                {entreesEnAttente.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Vérifiez les quantités reçues et validez chaque envoi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-center text-muted-foreground py-8">Chargement…</p>
          ) : entreesEnAttente.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30 text-green-500" />
              <p className="text-lg">Aucun envoi en attente</p>
              <p className="text-sm mt-1">Tous les envois ont été traités</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entreesEnAttente.map((entree) => (
                <Card key={entree.id} className="border hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap justify-between gap-4 items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-lg">
                            {getFournisseurNom(entree)}
                          </span>
                          <Badge variant="outline">en attente</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(entree.date)}
                        </div>
                      </div>
                      <Button onClick={() => openValidation(entree)}>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Valider
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeValidation;
