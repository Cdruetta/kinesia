import { useId } from 'react';
import { cn } from '@/utils/cn';

export type YesNoValue = 'yes' | 'no' | null;

interface YesNoSelectorProps {
  label?: string;
  value: YesNoValue;
  onChange: (_value: YesNoValue) => void;
  error?: string;
  className?: string;
}

export function YesNoSelector({ label, value, onChange, error, className }: YesNoSelectorProps) {
  const generatedId = useId();
  const groupId = `yesno-${generatedId}`;
  const hasError = error != null && error !== '';
  const pressedYes = value === 'yes';
  const pressedNo = value === 'no';

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-ink-main dark:text-violet-50 mb-2">{label}</label>
      )}
      <div
        role="radiogroup"
        aria-label={label ?? 'Sí / No'}
        className="inline-flex items-center gap-1 rounded-md border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33]"
      >
        <button
          type="button"
          role="radio"
          aria-checked={pressedYes}
          id={`${groupId}-yes`}
          onClick={() => onChange('yes')}
          className={cn(
            'flex items-center gap-2 rounded-l-md px-3 py-1.5 text-sm font-medium transition-colors',
            pressedYes
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 shadow-sm border-transparent'
              : 'border-transparent text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600'
          )}
        >
          Sí
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={pressedNo}
          id={`${groupId}-no`}
          onClick={() => onChange('no')}
          className={cn(
            'flex items-center gap-2 rounded-r-md px-3 py-1.5 text-sm font-medium transition-colors',
            pressedNo
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 shadow-sm border-transparent'
              : 'border-transparent text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600'
          )}
        >
          No
        </button>
      </div>
      {hasError && (
        <p className="mt-1 text-sm text-error-text" role="alert" id={`${groupId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
