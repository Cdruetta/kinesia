import { useCallback } from 'react';
import { cn } from '@/utils/cn';
import { X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchInput({ value, onChange, placeholder, disabled }: SearchInputProps) {
  const handleClear = useCallback(() => onChange(''), [onChange]);

  return (
    <div className="relative w-full">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          'flex h-10 w-full rounded-md border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] px-3 py-1.5 pr-10 text-sm text-ink-main dark:text-violet-50 placeholder:text-ink-secondary/60 dark:text-violet-200/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />
      {value !== '' && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 p-1 text-ink-secondary dark:text-violet-200/70 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="Limpiar búsqueda"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
