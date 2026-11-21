import { Badge } from '@/components/ui/Badge';
import type { AppointmentStatus } from '@/models';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: 'Pendiente', className: 'bg-warning-bg text-warning-text' },
  confirmed: { label: 'Confirmado', className: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600' },
  completed: { label: 'Realizado', className: 'bg-success-bg text-success-text' },
  cancelled: { label: 'Cancelado', className: 'bg-violet-50 dark:bg-violet-900/20 text-ink-secondary dark:text-violet-200/70 border border-border dark:border-violet-800/30' },
  'no-show': { label: 'Ausente', className: 'bg-error-bg text-error-text' },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}
