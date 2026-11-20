import { createPortal } from 'react-dom';
import * as React from 'react';
import { useCallback, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  closable?: boolean;
  children: ReactNode;
}

export function Modal({ open, onClose, title, description, closable = true, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closable && e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden="true"
      onClick={handleBackdropClick}
    >
      <div
        className="absolute inset-0 bg-ink-main/40 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-[#251f33] rounded-xl border border-border dark:border-violet-800/30 shadow-md p-6">
          <div className="flex items-start gap-3">
            {title && (
              <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-ink-secondary dark:text-violet-200/70">{description}</p>
            )}
            {closable && (
              <button
                type="button"
                onClick={onClose}
                className="ml-auto shrink-0 p-1 rounded-sm text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
