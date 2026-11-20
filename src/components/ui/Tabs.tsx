import { type ReactNode, useState, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { ChevronRight } from 'lucide-react';

interface TabsListProps {
  className?: string;
  children: ReactNode;
}

export function TabsList({ className, children }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 border-b border-border dark:border-violet-800/30 pb-6', className)}
      aria-label="Pestañas"
    >
      {children}
    </div>
  );
}

interface TabsProps {
  className?: string;
  children: ReactNode;
}

export function Tabs({ className, children }: TabsProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  selected: boolean;
  onSelect: (_value: string) => void;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

export function TabsTrigger({ value, selected, onSelect, className, disabled, children }: TabsTriggerProps) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium transition-colors',
        'border-b-2 pb-6',
        selected
          ? 'border-violet-500 text-violet-600'
          : 'border-transparent text-ink-secondary dark:text-violet-200/70 hover:text-violet-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
      {selected && <ChevronRight className="w-3 h-3 text-violet-600" aria-hidden="true" />}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  currentValue: string;
  className?: string;
  children: ReactNode;
}

export function TabsContent({ value, currentValue, className, children }: TabsContentProps) {
  if (value !== currentValue) return null;
  return <div role="tabpanel" className={cn(className)}>{children}</div>;
}

/** Hook auxiliar para controlar pestañas de forma controlada. */
export function useTabs(defaultValue: string) {
  const [value, setValue] = useState(defaultValue);
  const onValueChange = useCallback((next: string) => setValue(next), []);
  return { value, onValueChange };
}
