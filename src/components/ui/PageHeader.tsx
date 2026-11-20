import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2', className)}>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl font-bold text-ink-main dark:text-violet-50 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-secondary dark:text-violet-200/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
