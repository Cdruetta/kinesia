import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 border border-violet-200',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  error: 'bg-error-bg text-error-text',
  outline: 'bg-white dark:bg-[#251f33] text-ink-secondary dark:text-violet-200/70 border border-border dark:border-violet-800/30',
};

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none uppercase tracking-tighter',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
