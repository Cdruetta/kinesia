import { useId } from 'react';
import { cn } from '@/utils/cn';
import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  error?: string;
  helper?: string;
  rows?: number;
}

export function Textarea({ label, error, helper, rows = 3, className, id, ...rest }: TextareaProps) {
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
      <textarea
        id={inputId}
        rows={rows}
        className={cn(
          'flex w-full rounded-md border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] px-3 py-1.5 text-sm text-ink-main dark:text-violet-50',
          'placeholder:text-ink-secondary/60 dark:text-violet-200/40 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-violet-500',
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
