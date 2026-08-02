/**
 * Dialogue de soft-delete acompte — motif obligatoire, shadcn accessible.
 * Conserve un snapshot des données jusqu’à la prochaine ouverture (pas de flash vide).
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

function formatDa(n) {
  return `${Number(n || 0).toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;
}

function formatDateFr(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return String(dateStr);
  }
}

export function AcompteDeleteDialog({
  open,
  onOpenChange,
  acompte,
  salaryName,
  isMonthClosed = false,
  isSubmitting = false,
  onConfirm,
}) {
  const [motif, setMotif] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [display, setDisplay] = useState(null);
  const submitLockRef = useRef(false);

  const busy = isSubmitting || localBusy;

  // Snapshot à l’ouverture — ne jamais vider pendant la fermeture (évite flash).
  useEffect(() => {
    if (!open || !acompte) return;
    setDisplay({
      acompte,
      salaryName: salaryName || '',
      isMonthClosed: Boolean(isMonthClosed),
    });
    setMotif('');
    submitLockRef.current = false;
    setLocalBusy(false);
  }, [open, acompte, salaryName, isMonthClosed]);

  const shown = display?.acompte;
  const shownSalary = display?.salaryName ?? '';
  const shownClosed = display?.isMonthClosed ?? false;
  const motifOk = motif.trim().length > 0;
  const disabled = !motifOk || busy || shownClosed || !shown;

  const requestClose = () => {
    if (busy) return;
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (disabled || submitLockRef.current) return;
    submitLockRef.current = true;
    setLocalBusy(true);
    try {
      await onConfirm(motif.trim());
      onOpenChange(false);
    } catch {
      submitLockRef.current = false;
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Supprimer l’acompte</DialogTitle>
          <DialogDescription>
            La ligne sera masquée des calculs actifs et conservée dans le journal
            d’audit. Aucune suppression définitive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 space-y-1">
            <p>
              <span className="text-muted-foreground">Salarié :</span>{' '}
              <span className="font-medium">{shownSalary || '—'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Montant :</span>{' '}
              <span className="font-medium tabular-nums">
                {formatDa(shown?.montant)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Date :</span>{' '}
              <span className="font-medium">{formatDateFr(shown?.date)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Description :</span>{' '}
              <span className="font-medium">{shown?.description || '—'}</span>
            </p>
          </div>

          {shownClosed && (
            <div className="flex gap-2 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] px-3 py-2 text-[hsl(var(--warning))]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs">
                Ce mois est clôturé. Annulez d’abord la clôture avant de supprimer
                cet acompte.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="acompte-delete-motif" className="text-sm font-medium">
              Motif de la suppression <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="acompte-delete-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. saisie en double, erreur de montant…"
              rows={3}
              disabled={busy || shownClosed}
              aria-required="true"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            disabled={busy}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={disabled}
            onClick={handleConfirm}
          >
            {busy ? 'Suppression…' : 'Confirmer la suppression'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AcompteDeleteDialog;
