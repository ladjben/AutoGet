/**
 * Badges de statut présentationnels.
 * Vert = validé/payé · Orange = en attente · Rouge = litige/dette · Bleu = info
 * Aucune logique métier.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  en_attente:
    'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
  valide:
    'border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  litige:
    'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]',
  paye:
    'border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  info:
    'border-[hsl(var(--info)/0.45)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]',
};

const STATUS_LABELS = {
  en_attente: 'En attente',
  valide: 'Validé',
  litige: 'Litige',
  paye: 'Payé',
  info: 'Info',
};

export function StatusBadge({ status, className, label }) {
  const key = String(status || '').toLowerCase();
  const style =
    STATUS_STYLES[key] ||
    'border-border bg-muted text-muted-foreground';
  const text = label || STATUS_LABELS[key] || status || '—';

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', style, className)}
    >
      {text}
    </Badge>
  );
}

export default StatusBadge;
