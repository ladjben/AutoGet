/**
 * Validation réception — présentation uniquement.
 * Formules manque, qteRecue initiale, validateEntree, payload,
 * règle valide/litige et notification fournisseur inchangés.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../context/UnifiedDataContext';
import { useAuth } from '../context/AuthContext';
import { USE_SUPABASE } from '../config';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowLeft,
  Package,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Loader2,
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

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums sm:text-base',
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

function LoadingBlock({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 px-4 py-12 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin opacity-60" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyBlock({ icon: Icon, title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
      {Icon ? <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
  const statutPrevu = hasManque ? 'litige' : 'valide';

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

      setConfirmOpen(false);
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
    setConfirmOpen(false);
    setScreen('list');
    setSelectedEntree(null);
    setLignes([]);
  };

  const getFournisseurNom = (entree) =>
    entree.fournisseurs?.nom || 'Fournisseur inconnu';

  if (!USE_SUPABASE) {
    return (
      <PageSurface className="space-y-6">
        <PageHeader
          eyebrow="Réception"
          title="Validation des envois"
          description="Contrôle des quantités reçues à la réception."
        />
        <EmptyBlock
          icon={AlertTriangle}
          title="Supabase requis"
          description="La validation des envois nécessite Supabase."
        />
      </PageSurface>
    );
  }

  // Écran validation
  if (screen === 'validate' && selectedEntree) {
    return (
      <PageSurface className="space-y-5 sm:space-y-6">
        <PageHeader
          eyebrow="Réception"
          title="Contrôle de réception"
          description={`${getFournisseurNom(selectedEntree)} — ${formatDate(selectedEntree.date)}`}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
          }
        />

        <section className="space-y-4 rounded-lg border border-border/80 bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Validation de l&apos;envoi
                </h2>
                <p className="text-xs text-muted-foreground">
                  Saisissez les quantités réellement reçues. Les manques déclenchent un litige.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">
                  {getFournisseurNom(selectedEntree)}
                </span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(selectedEntree.date)}
              </span>
            </div>
          </div>

          <Separator />

          {loadingLignes ? (
            <LoadingBlock label="Chargement des lignes…" />
          ) : lignes.length === 0 ? (
            <EmptyBlock
              icon={Package}
              title="Aucune ligne dans cet envoi"
              description="Impossible de valider un envoi sans produit."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Produit</th>
                      <th className="px-3 py-2.5 text-right font-medium">Envoyé</th>
                      <th className="px-3 py-2.5 text-right font-medium">Reçu</th>
                      <th className="px-3 py-2.5 text-right font-medium">Manque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((ligne) => {
                      const manqueQte = Math.max(ligne.qte_envoyee - ligne.qteRecue, 0);
                      const manqueDa = manqueQte * ligne.prix_achat;
                      return (
                        <tr
                          key={ligne.ligne_id}
                          className={cn(
                            'border-b border-border/60 last:border-0',
                            manqueQte > 0 && 'bg-[hsl(var(--danger)/0.05)]'
                          )}
                        >
                          <td className="px-3 py-3 align-top">
                            <p className="font-medium">{ligne.produit_nom}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDa(ligne.prix_achat)} / paire
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right align-top tabular-nums">
                            {ligne.qte_envoyee}
                          </td>
                          <td className="px-3 py-3 text-right align-top">
                            <Input
                              type="number"
                              min="0"
                              className="ml-auto h-9 w-24 text-right"
                              value={ligne.qteRecue}
                              onChange={(e) =>
                                handleQteRecueChange(ligne.ligne_id, e.target.value)
                              }
                              disabled={submitting}
                            />
                          </td>
                          <td className="px-3 py-3 text-right align-top">
                            <p
                              className={cn(
                                'font-semibold tabular-nums',
                                manqueQte > 0 ? 'text-danger' : 'text-success'
                              )}
                            >
                              {manqueQte > 0
                                ? `−${formatPaires(manqueQte)} · −${formatDaAmount(manqueDa)} DA`
                                : '—'}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablette cards */}
              <div className="space-y-3 md:hidden">
                {lignes.map((ligne) => {
                  const manqueQte = Math.max(ligne.qte_envoyee - ligne.qteRecue, 0);
                  const manqueDa = manqueQte * ligne.prix_achat;
                  return (
                    <div
                      key={ligne.ligne_id}
                      className={cn(
                        'rounded-lg border border-border/80 px-3 py-3',
                        manqueQte > 0 &&
                          'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.05)]'
                      )}
                    >
                      <p className="font-medium">{ligne.produit_nom}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Envoyé : <span className="font-semibold text-foreground">{ligne.qte_envoyee}</span>{' '}
                        paire(s)
                        {' · '}
                        {formatDa(ligne.prix_achat)} / paire
                      </p>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Reçu
                          </label>
                          <Input
                            type="number"
                            min="0"
                            className="h-9 w-24"
                            value={ligne.qteRecue}
                            onChange={(e) =>
                              handleQteRecueChange(ligne.ligne_id, e.target.value)
                            }
                            disabled={submitting}
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Manque</p>
                          <p
                            className={cn(
                              'font-semibold',
                              manqueQte > 0 ? 'text-danger' : 'text-success'
                            )}
                          >
                            {manqueQte > 0
                              ? `−${formatPaires(manqueQte)} · −${formatDaAmount(manqueDa)} DA`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 sm:grid-cols-4">
                <MetaStat label="Valeur envoyée" value={formatDa(totals.envoye)} tone="info" />
                <MetaStat label="Valeur reçue" value={formatDa(totals.recu)} tone="success" />
                <MetaStat
                  label="Manque total"
                  value={
                    hasManque
                      ? `${formatDa(totals.manque)} · ${formatPaires(totals.manquePaires)}`
                      : '—'
                  }
                  tone={hasManque ? 'danger' : 'success'}
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Statut prévu</p>
                  <div className="mt-1">
                    {hasManque ? (
                      <StatusBadge status="litige" label="Litige" />
                    ) : (
                      <StatusBadge status="valide" label="Validé" />
                    )}
                  </div>
                </div>
              </div>

              {hasManque && (
                <div className="flex gap-3 rounded-lg border border-[hsl(var(--warning)/0.55)] bg-[hsl(var(--warning)/0.1)] px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--warning))]" />
                  <div>
                    <p className="font-medium text-[hsl(var(--warning))]">Manque constaté</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cet envoi sera marqué <strong className="text-foreground">litige</strong> et
                      le fournisseur sera automatiquement notifié du manquant (
                      {formatDa(totals.manque)} · {formatPaires(totals.manquePaires)}).
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Statut produit :{' '}
                  <span className="font-semibold text-foreground">
                    {statutPrevu === 'litige' ? 'litige' : 'valide'}
                  </span>
                  {hasManque
                    ? ' — notification fournisseur à l’enregistrement.'
                    : ' — réception conforme.'}
                </p>
                <Button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={submitting || loadingLignes || lignes.length === 0}
                  className={cn(
                    'sm:min-w-[220px]',
                    hasManque &&
                      'bg-danger text-danger-foreground hover:bg-danger/90'
                  )}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmer la validation
                </Button>
              </div>
            </>
          )}
        </section>

        <Dialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {hasManque ? 'Confirmer le litige ?' : 'Confirmer la validation ?'}
              </DialogTitle>
              <DialogDescription>
                {hasManque
                  ? `Un manque de ${formatPaires(totals.manquePaires)} (${formatDa(totals.manque)}) sera enregistré. Le statut passera à litige et le fournisseur sera notifié.`
                  : 'Aucune différence détectée. Le statut passera à valide.'}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Fournisseur</span>
                <span className="font-medium">{getFournisseurNom(selectedEntree)}</span>
              </div>
              <div className="mt-1.5 flex justify-between gap-3">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{formatDate(selectedEntree.date)}</span>
              </div>
              <div className="mt-1.5 flex justify-between gap-3">
                <span className="text-muted-foreground">Statut prévu</span>
                <span className="font-medium">{statutPrevu}</span>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className={cn(
                  hasManque && 'bg-danger text-danger-foreground hover:bg-danger/90'
                )}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {submitting ? 'Validation…' : 'Valider définitivement'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageSurface>
    );
  }

  // Écran liste
  return (
    <PageSurface className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Réception"
        title="Validation des envois"
        description="Contrôlez les quantités reçues, puis validez. Un manque crée automatiquement un litige."
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-3">
        <MetaStat
          label="En attente"
          value={loadingList ? '…' : Number(entreesEnAttente.length).toLocaleString('fr-FR')}
          tone="warning"
        />
        <MetaStat label="Action" value="Contrôler puis valider" />
        <MetaStat label="Règle" value="Manque → litige" tone="info" />
      </div>

      <section className="space-y-4 rounded-lg border border-border/80 bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Envois en attente
              </h2>
              <p className="text-xs text-muted-foreground">
                Vérifiez les quantités reçues et validez chaque envoi
              </p>
            </div>
          </div>
          {!loadingList && (
            <StatusBadge
              status="en_attente"
              label={`${entreesEnAttente.length} en attente`}
            />
          )}
        </div>

        {loadingList ? (
          <LoadingBlock label="Chargement…" />
        ) : entreesEnAttente.length === 0 ? (
          <EmptyBlock
            icon={CheckCircle2}
            title="Aucun envoi en attente"
            description="Tous les envois ont été traités."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Fournisseur</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Statut</th>
                    <th className="w-[140px] px-3 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entreesEnAttente.map((entree) => (
                    <tr
                      key={entree.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{getFournisseurNom(entree)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(entree.date)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status="en_attente" label="en attente" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openValidation(entree)}
                        >
                          <ClipboardCheck className="mr-1.5 h-4 w-4" />
                          Valider
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {entreesEnAttente.map((entree) => (
                <div
                  key={entree.id}
                  className="rounded-lg border border-border/80 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{getFournisseurNom(entree)}</p>
                        <StatusBadge status="en_attente" label="en attente" />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(entree.date)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      onClick={() => openValidation(entree)}
                    >
                      <ClipboardCheck className="mr-1.5 h-4 w-4" />
                      Valider
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </PageSurface>
  );
};

export default EmployeeValidation;
