import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export function SyncBadge({
  status,
  label,
  className = '',
}: {
  status: 'pending' | 'synced' | 'rejected';
  label?: string;
  className?: string;
}) {
  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className={`border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700 gap-1 text-[11px] font-medium shadow-none ${className}`}
      >
        <Clock className="h-3 w-3 animate-pulse text-amber-600 dark:text-amber-400" />
        <span>{label || 'Pending Sync'}</span>
      </Badge>
    );
  }

  if (status === 'rejected') {
    return (
      <Badge
        variant="destructive"
        className={`gap-1 text-[11px] font-medium ${className}`}
      >
        <AlertCircle className="h-3 w-3" />
        <span>{label || 'Rejected'}</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`border-green-300 bg-green-50/60 text-green-700 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800 gap-1 text-[11px] font-normal shadow-none ${className}`}
    >
      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
      <span>{label || 'Synced'}</span>
    </Badge>
  );
}
