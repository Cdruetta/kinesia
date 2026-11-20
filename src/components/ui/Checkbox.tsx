import { useId } from 'react';
import { cn } from '@/utils/cn';
import type { InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
}

export function Checkbox({ label, error, className, id, ...rest }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasError = error != null && error !== '';

  return (
    <div className={cn('items-center gap-2', hasError && 'text-error-text', className)}>
      <input
        type="checkbox"
        id={inputId}
        className={cn(
          'h-4 w-4 shrink-0 rounded border-border dark:border-violet-800/30 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-error-text'
        )}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${inputId}-error` : undefined}
        {...rest}
      />
      <label htmlFor={inputId} className="text-sm text-ink-main dark:text-violet-50 cursor-pointer select-none">
        {label}
      </label>
      {hasError && (
        <p className="mt-1 text-sm text-error-text" role="alert" id={`${inputId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
