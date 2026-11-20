import { useId } from 'react';
import { cn } from '@/utils/cn';
import type { InputHTMLAttributes } from 'react';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helper?: string;
}

export function DatePicker({ label, error, helper, className, id, ...rest }: DatePickerProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasError = error != null && error !== '';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-main dark:text-violet-50 mb-1">
          {label}
        </label>
      )}
      <input
        type="date"
        id={inputId}
        className={cn(
          'flex h-10 w-full rounded-md border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] px-3 py-1.5 text-sm text-ink-main dark:text-violet-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-error-text focus-visible:ring-error-text',
          className
        )}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${inputId}-error` : undefined}
        {...rest}
      />
      {hasError && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-error-text" role="alert">
          {error}
        </p>
      )}
      {!hasError && helper && (
        <p className="mt-1 text-sm text-ink-secondary dark:text-violet-200/70">{helper}</p>
      )}
    </div>
  );
}
