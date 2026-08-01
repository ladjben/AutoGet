/**
 * Surface de contenu partagée — sobre, sans gradient marketing.
 */
import { cn } from '@/lib/utils';

export function PageSurface({ children, className }) {
  return (
    <div className={cn('relative min-h-full', className)}>
      {children}
    </div>
  );
}

export default PageSurface;
