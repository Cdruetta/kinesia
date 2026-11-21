import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'subtle' };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 text-center p-10 rounded-xl bg-violet-50 dark:bg-violet-900/20', className)}>
      {icon && <div className="w-12 h-12 rounded-lg bg-white dark:bg-[#251f33] border border-border dark:border-violet-800/30 flex items-center justify-center text-violet-400">{icon}</div>}
      <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">{title}</h3>
      {description && <p className="text-sm text-ink-secondary dark:text-violet-200/70 max-w-xs">{description}</p>}
      {action && (
        <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
