/**
 * Fiche salarié — présentation uniquement.
 * Formules, catégories, mois, snapshots, CRUD, permissions
 * et dual-path inchangés. Salaries.jsx non modifié.
 */
import { useData } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowLeft,
  Users,
  CreditCard,
  Trash2,
  Phone,
  Briefcase,
  Plus,
  Printer,
  Calendar,
  MoreHorizontal,
  Clock,
  UserX,
  Gift,
  AlertTriangle,
} from 'lucide-react';
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

const CATEGORY_UI = {
  avances: {
    label: 'Acompte',
    status: 'info',
    Icon: CreditCard,
    tone: 'text-[hsl(var(--info))]',
  },
  retards: {
    label: 'Retard',
    status: 'litige',
    Icon: Clock,
    tone: 'text-danger',
  },
  absences: {
    label: 'Absence',
    status: 'en_attente',
    Icon: UserX,
    tone: 'text-[hsl(var(--warning))]',
  },
  bonus: {
    label: 'Bonus',
    status: 'paye',
    Icon: Gift,
    tone: 'text-success',
  },
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
  const [ficheMois, setFicheMois] = useState(null); // YYYY-MM — mois affiché sur la fiche
  const [viewMois, setViewMois] = useState(null); // YYYY-MM — mois consulté à l'écran
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
      <PageSurface className="space-y-6">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Salarié non trouvé</p>
        </div>
      </PageSurface>
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

  // Helper functions - Récupérer TOUS les acomptes du salarié (tous mois, conservés en base)
  const getSalaryAcomptes = useCallback(() => {
    return (state.acomptes || []).filter(a => {
      const sId = a.salary_id ?? a.salaryId;
      return sId === salaryId;
    }).reverse();
  }, [state.acomptes, salaryId]);

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

  const formatMoisLabel = (moisKey) => {
    const [year, month] = moisKey.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const getAcompteMoisKey = (a) => a.mois_annee || (a.date ? String(a.date).substring(0, 7) : '');

  const allAcomptes = getSalaryAcomptes();
  const currentMonthKey = getCurrentMonth();
  const availableMonths = (() => {
    const keys = new Set();
    allAcomptes.forEach((a) => {
      const key = getAcompteMoisKey(a);
      if (key) keys.add(key);
    });
    (salaryHistory || []).forEach((h) => {
      if (h.mois_annee) keys.add(h.mois_annee);
    });
    keys.add(currentMonthKey);
    return Array.from(keys).sort().reverse();
  })();

  const viewMonthKey = viewMois || currentMonthKey;
  const acomptes = allAcomptes.filter((a) => getAcompteMoisKey(a) === viewMonthKey);
  const totalAcomptes = acomptes.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0);
  const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
  const soldeRestant = salaireMensuel - totalAcomptes;
  const tauxPaye = salaireMensuel > 0 ? ((totalAcomptes / salaireMensuel) * 100) : 0;

  // Mois de la fiche : sélection, sinon mois consulté, sinon dernier avec mouvements
  const ficheMonthKey = ficheMois
    || viewMonthKey
    || availableMonths.find((m) => allAcomptes.some((a) => getAcompteMoisKey(a) === m))
    || currentMonthKey;

  const periodeFr = formatMoisLabel(ficheMonthKey);
  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const acomptesMois = allAcomptes.filter((a) => getAcompteMoisKey(a) === ficheMonthKey);

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

  const totalDeductions = acomptesMois.reduce((sum, a) => {
    const m = parseFloat(a.montant) || 0;
    return m > 0 ? sum + m : sum;
  }, 0);

  const totalPrimes = acomptesMois.reduce((sum, a) => {
    const m = parseFloat(a.montant) || 0;
    return m < 0 ? sum + Math.abs(m) : sum;
  }, 0);

  const netAPayerFiche = salaireMensuel - totalDeductions + totalPrimes;

  const isViewMonthClosed = (salaryHistory || []).some(
    (h) => h.mois_annee === viewMonthKey
  );
  const isCurrentViewMonth = viewMonthKey === currentMonthKey;

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

  const operationLabel = (acompte) => {
    const cat = getAcompteCategory(acompte);
    if (cat && CATEGORY_UI[cat]) return CATEGORY_UI[cat];
    return {
      label: 'Opération',
      status: 'info',
      Icon: CreditCard,
      tone: 'text-muted-foreground',
    };
  };

  const displayMontant = (acompte) => {
    const cat = getAcompteCategory(acompte);
    const montant = parseFloat(acompte.montant) || 0;
    if (cat === 'bonus') {
      return { text: `+${formatDa(Math.abs(montant))}`, className: 'text-success' };
    }
    return { text: formatDa(montant), className: 'text-[hsl(var(--warning))]' };
  };

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Opérations · Paie"
        title={salary.nom}
        description={[
          salary.poste || null,
          salary.contact || null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Fiche salarié'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFicheMois(viewMonthKey);
                setShowFichePaie(true);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer fiche de paie
            </Button>
            {isAdmin() && viewMonthKey === currentMonthKey && (
              <Button size="sm" onClick={() => setShowAcompteModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un acompte
              </Button>
            )}
          </div>
        }
      />

      {/* Identité + salaire */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="truncate font-semibold">{salary.nom}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {salary.poste ? (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {salary.poste}
                </span>
              ) : (
                <span>Sans poste</span>
              )}
              {salary.contact ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {salary.contact}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Salaire mensuel</p>
          <p className="text-lg font-semibold tabular-nums text-[hsl(var(--info))]">
            {formatDa(salaireMensuel)}
          </p>
        </div>
      </section>

      {/* Mois + état */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="detail-month">
              Mois sélectionné
            </label>
            <select
              id="detail-month"
              className="flex h-9 w-full min-w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              value={viewMonthKey}
              onChange={(e) => setViewMois(e.target.value)}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMoisLabel(m)}
                  {m === currentMonthKey ? ' (en cours)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            {isCurrentViewMonth && !isViewMonthClosed ? (
              <StatusBadge status="en_attente" label="Mois ouvert" />
            ) : null}
            {isViewMonthClosed ? (
              <StatusBadge status="valide" label="Mois clôturé" />
            ) : null}
            {!isCurrentViewMonth && !isViewMonthClosed ? (
              <StatusBadge status="info" label="Historique" />
            ) : null}
            {isCurrentViewMonth && isViewMonthClosed ? (
              <StatusBadge status="info" label="Mois en cours · snapshot" />
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <Calendar className="mr-1 inline h-3.5 w-3.5" />
          {acomptes.length} opération(s) · {formatMoisLabel(viewMonthKey)}
        </p>
      </section>

      {/* Résumé financier */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Salaire mensuel" value={formatDa(salaireMensuel)} tone="info" />
        <MetaStat
          label="Acomptes & ajustements"
          value={formatDa(totalAcomptes)}
          tone="warning"
        />
        <MetaStat
          label={soldeRestant > 0 ? 'Solde restant' : soldeRestant < 0 ? 'Surpaiement' : 'Solde'}
          value={formatDa(Math.abs(soldeRestant))}
          tone={soldeRestant > 0 ? 'warning' : soldeRestant < 0 ? 'danger' : 'success'}
        />
        <MetaStat label="Taux versé" value={`${tauxPaye.toFixed(0)} %`} />
      </div>

      {soldeRestant < 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger)/0.08)] px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-danger">Surpaiement</p>
            <p className="text-xs text-muted-foreground">
              Les acomptes et ajustements dépassent le salaire de{' '}
              <span className="font-semibold tabular-nums">{formatDa(Math.abs(soldeRestant))}</span>
              .
            </p>
          </div>
        </div>
      )}

      {/* Historique snapshots */}
      {salaryHistory && salaryHistory.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Snapshots de clôture
            </h2>
            <p className="text-xs text-muted-foreground">
              Historique mensuel ({salaryHistory.length} mois) — lecture seule
            </p>
          </div>
          <div className="space-y-2">
            {salaryHistory.map((history) => (
              <div
                key={history.id}
                className="rounded-lg border border-border/80 bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {formatMoisLabel(history.mois_annee)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {history.nom}
                      {history.created_at
                        ? ` · ${new Date(history.created_at).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="valide" label="Clôturé" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewMois(history.mois_annee);
                        setFicheMois(history.mois_annee);
                        setShowFichePaie(true);
                      }}
                    >
                      <Printer className="mr-1 h-3.5 w-3.5" />
                      Imprimer
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Salaire</p>
                    <p className="font-semibold tabular-nums text-[hsl(var(--info))]">
                      {formatDa(parseFloat(history.salaire_mensuel))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Acomptes</p>
                    <p className="font-semibold tabular-nums text-[hsl(var(--warning))]">
                      {formatDa(parseFloat(history.total_acomptes))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Solde</p>
                    <p
                      className={cn(
                        'font-semibold tabular-nums',
                        history.solde_restant >= 0 ? 'text-success' : 'text-danger'
                      )}
                    >
                      {formatDa(parseFloat(history.solde_restant))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Opérations du mois */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Opérations — {formatMoisLabel(viewMonthKey)}
            </h2>
            <p className="text-xs text-muted-foreground">
              Acomptes, retards, absences et bonus du mois sélectionné
            </p>
          </div>
          {isAdmin() && viewMonthKey === currentMonthKey && (
            <Button size="sm" variant="outline" onClick={() => setShowAcompteModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un acompte
            </Button>
          )}
        </div>

        {acomptes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucune opération ce mois</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun acompte, retard, absence ou bonus pour {formatMoisLabel(viewMonthKey)}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
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
                  {acomptes.map((acompte) => {
                    const ui = operationLabel(acompte);
                    const mt = displayMontant(acompte);
                    const Icon = ui.Icon;
                    return (
                      <tr
                        key={acompte.id}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatDateFr(acompte.date)}
                          {acompte.mois_annee ? (
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              {acompte.mois_annee}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className={cn('h-3.5 w-3.5', ui.tone)} />
                            <StatusBadge status={ui.status} label={ui.label} />
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-2.5 text-muted-foreground">
                          {acompte.description || '—'}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right font-semibold tabular-nums',
                            mt.className
                          )}
                        >
                          {mt.text}
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
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteAcompte(acompte.id)}
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
              {acomptes.map((acompte) => {
                const ui = operationLabel(acompte);
                const mt = displayMontant(acompte);
                const Icon = ui.Icon;
                return (
                  <div
                    key={acompte.id}
                    className="rounded-lg border border-border/80 bg-card px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDateFr(acompte.date)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3.5 w-3.5', ui.tone)} />
                          <StatusBadge status={ui.status} label={ui.label} />
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">
                          {acompte.description || 'Sans description'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <p className={cn('text-base font-semibold tabular-nums', mt.className)}>
                          {mt.text}
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
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteAcompte(acompte.id)}
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

      {/* Aperçu fiche de paie */}
      {showFichePaie && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16">
          <div className="no-print fixed right-4 top-4 z-[60] flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm shadow">
              <span className="text-muted-foreground">Mois</span>
              <select
                className="rounded border border-input bg-background px-2 py-1 text-sm"
                value={ficheMonthKey}
                onChange={(e) => setFicheMois(e.target.value)}
              >
                {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMoisLabel(m)}
                    </option>
                  ))}
              </select>
            </label>
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={() => {
                setShowFichePaie(false);
                setFicheMois(null);
              }}
            >
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
                  <span className="tabular-nums">{formatDa(netAPayerFiche)}</span>
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
              <label className="mb-2 block text-sm font-medium">Montant (DA) *</label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 10000"
                value={acompteData.montant}
                onChange={(e) => setAcompteData({ ...acompteData, montant: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={acompteData.date}
                onChange={(e) => setAcompteData({ ...acompteData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Description (optionnel)</label>
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
    </PageSurface>
  );
};

export default SalaryDetail;
