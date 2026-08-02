/**
 * Journal administrateur des opérations acomptes.
 * Lecture via fetchAcompteAuditLogs (RPC) — admin uniquement.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';

const ACTION_LABELS = {
  'acompte.created': 'Acompte ajouté',
  'acompte.deleted': 'Acompte supprimé',
  'acompte.restored': 'Acompte restauré',
};

function formatDa(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;
}

function formatDateTimeFr(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function formatDateFr(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return String(dateStr);
  }
}

function statusMeta(status) {
  switch (status) {
    case 'supprimé':
      return { status: 'litige', label: 'Supprimé' };
    case 'restauré':
      return { status: 'valide', label: 'Restauré' };
    case 'actif':
      return { status: 'en_attente', label: 'Actif' };
    default:
      return { status: 'info', label: status || 'Inconnu' };
  }
}

export function AcompteAuditLog({
  open,
  onOpenChange,
  fetchLogs,
  actor,
  onRestore,
  isMonthClosedFor,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState('');
  const [actorUsername, setActorUsername] = useState('');
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    if (!open || !fetchLogs || !actor) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLogs(
        {
          limit,
          offset,
          action: action || null,
          actorUsername: actorUsername.trim() || null,
          deletedOnly,
        },
        actor
      );
      setRows(result?.data || []);
    } catch (e) {
      setRows([]);
      setError(e?.message || 'Impossible de charger le journal.');
    } finally {
      setLoading(false);
    }
  }, [open, fetchLogs, actor, offset, action, actorUsername, deletedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (open) {
      setOffset(0);
      setError(null);
    }
  }, [open]);

  const handleRestore = async () => {
    if (!restoreTarget?.acompte_id || !onRestore) return;
    setRestoring(true);
    try {
      await onRestore(restoreTarget.acompte_id);
      setRestoreTarget(null);
      await load();
    } catch (e) {
      setError(e?.message || 'Échec de la restauration.');
    } finally {
      setRestoring(false);
    }
  };

  const closedForTarget =
    restoreTarget && isMonthClosedFor
      ? isMonthClosedFor(restoreTarget.mois_annee || restoreTarget.acompte_date)
      : false;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Journal des opérations</DialogTitle>
            <DialogDescription>
              Historique des acomptes (ajout, suppression, restauration). Lecture
              réservée à l’administration.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="audit-action">
                Action
              </label>
              <select
                id="audit-action"
                value={action}
                onChange={(e) => {
                  setOffset(0);
                  setAction(e.target.value);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Toutes</option>
                <option value="acompte.created">Acompte ajouté</option>
                <option value="acompte.deleted">Acompte supprimé</option>
                <option value="acompte.restored">Acompte restauré</option>
              </select>
            </div>
            <div className="min-w-[160px] flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="audit-actor">
                Auteur
              </label>
              <Input
                id="audit-actor"
                value={actorUsername}
                onChange={(e) => setActorUsername(e.target.value)}
                onBlur={() => setOffset(0)}
                placeholder="Filtrer par identifiant…"
                className="h-9"
              />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deletedOnly}
                onChange={(e) => {
                  setOffset(0);
                  setDeletedOnly(e.target.checked);
                }}
              />
              Suppressions / liés
            </label>
            <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')} />
              Actualiser
            </Button>
          </div>

          {error && (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            {loading && rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : rows.length === 0 && !error ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune opération dans le journal pour ces filtres.
              </p>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Date / heure</th>
                        <th className="px-2 py-2 font-medium">Action</th>
                        <th className="px-2 py-2 font-medium">Auteur</th>
                        <th className="px-2 py-2 font-medium">Rôle</th>
                        <th className="px-2 py-2 font-medium">Salarié</th>
                        <th className="px-2 py-2 text-right font-medium">Montant</th>
                        <th className="px-2 py-2 font-medium">Date acompte</th>
                        <th className="px-2 py-2 font-medium">Description</th>
                        <th className="px-2 py-2 font-medium">Motif</th>
                        <th className="px-2 py-2 font-medium">État</th>
                        <th className="px-2 py-2 text-right font-medium"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const st = statusMeta(row.acompte_status);
                        const canRestore =
                          row.acompte_status === 'supprimé' && row.acompte_id;
                        return (
                          <tr
                            key={row.log_id}
                            className="border-b border-border/40 last:border-0"
                          >
                            <td className="px-2 py-2 tabular-nums text-xs">
                              {formatDateTimeFr(row.log_created_at)}
                            </td>
                            <td className="px-2 py-2">
                              {ACTION_LABELS[row.action] || row.action}
                            </td>
                            <td className="px-2 py-2">
                              {row.actor_name || row.actor_username || '—'}
                            </td>
                            <td className="px-2 py-2">{row.actor_role || '—'}</td>
                            <td className="px-2 py-2">{row.salary_nom || '—'}</td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {formatDa(row.montant)}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {formatDateFr(row.acompte_date)}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-2 text-muted-foreground">
                              {row.description || '—'}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-2">
                              {row.deletion_reason || '—'}
                            </td>
                            <td className="px-2 py-2">
                              <StatusBadge status={st.status} label={st.label} />
                            </td>
                            <td className="px-2 py-2 text-right">
                              {canRestore && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => setRestoreTarget(row)}
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Restaurer
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="space-y-2 md:hidden">
                  {rows.map((row) => {
                    const st = statusMeta(row.acompte_status);
                    const canRestore =
                      row.acompte_status === 'supprimé' && row.acompte_id;
                    return (
                      <div
                        key={row.log_id}
                        className="rounded-lg border border-border/80 bg-card px-3 py-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {ACTION_LABELS[row.action] || row.action}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTimeFr(row.log_created_at)}
                            </p>
                          </div>
                          <StatusBadge status={st.status} label={st.label} />
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                          <dt className="text-muted-foreground">Auteur</dt>
                          <dd>{row.actor_name || row.actor_username || '—'}</dd>
                          <dt className="text-muted-foreground">Rôle</dt>
                          <dd>{row.actor_role || '—'}</dd>
                          <dt className="text-muted-foreground">Salarié</dt>
                          <dd>{row.salary_nom || '—'}</dd>
                          <dt className="text-muted-foreground">Montant</dt>
                          <dd className="tabular-nums">{formatDa(row.montant)}</dd>
                          <dt className="text-muted-foreground">Date acompte</dt>
                          <dd>{formatDateFr(row.acompte_date)}</dd>
                          <dt className="text-muted-foreground">Motif</dt>
                          <dd className="col-span-1">{row.deletion_reason || '—'}</dd>
                        </dl>
                        {row.description ? (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {row.description}
                          </p>
                        ) : null}
                        {canRestore && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full"
                            onClick={() => setRestoreTarget(row)}
                          >
                            <RotateCcw className="mr-2 h-3.5 w-3.5" />
                            Restaurer
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Précédent
            </Button>
            <span className="text-xs text-muted-foreground">Offset {offset}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={rows.length < limit || loading}
              onClick={() => setOffset((o) => o + limit)}
            >
              Suivant
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(restoreTarget)}
        onOpenChange={(v) => !v && setRestoreTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurer l’acompte</DialogTitle>
            <DialogDescription>
              L’acompte réapparaîtra dans les calculs actifs. Le journal conserve
              l’historique de suppression et ajoutera une entrée de restauration.
            </DialogDescription>
          </DialogHeader>
          {restoreTarget && (
            <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm">
              <p>
                <span className="text-muted-foreground">Salarié :</span>{' '}
                {restoreTarget.salary_nom || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Montant :</span>{' '}
                {formatDa(restoreTarget.montant)}
              </p>
              <p>
                <span className="text-muted-foreground">Motif de suppression :</span>{' '}
                {restoreTarget.deletion_reason || '—'}
              </p>
            </div>
          )}
          {closedForTarget && (
            <div className="flex gap-2 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] px-3 py-2 text-xs text-[hsl(var(--warning))]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Ce mois est clôturé. Annulez d’abord la clôture avant de restaurer.
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreTarget(null)}
              disabled={restoring}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={restoring || closedForTarget}
              onClick={handleRestore}
            >
              {restoring ? 'Restauration…' : 'Confirmer la restauration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AcompteAuditLog;
