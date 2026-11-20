import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/utils/cn';
import { generateId } from '@/utils/id';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 4000;

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
  duration?: number;
}

interface ToastProviderProps {
  children: ReactNode;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (_props: Omit<Toast, 'id'>) => string;
  dismiss: (_id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (props: Omit<Toast, 'id'>) => {
      const id = generateId();
      const toastEntry: Toast = { id, ...props, duration: props.duration ?? TOAST_REMOVE_DELAY };
      setToasts((current) => [...current, toastEntry].slice(-TOAST_LIMIT));
      setTimeout(() => {
        setToasts((current) => current.filter((x) => x.id !== id));
      }, toastEntry.duration);
      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((x) => x.id !== id));
  }, []);

  const variantIcons: Record<string, ReactNode> = {
    default: <Info className="w-4 h-4" />,
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
  };

  const variantClasses: Record<string, string> = {
    default: 'bg-white dark:bg-[#251f33] text-ink-main dark:text-violet-50 border border-border dark:border-violet-800/30',
    success: 'bg-success-bg text-success-text',
    error: 'bg-error-bg text-error-text',
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onPointerEnter={() => {}}
            className="pointer-events-auto"
          >
            <div
              className={cn(
                'flex items-start gap-3 rounded-md border p-3 shadow-md animate-in fade-in slide-in-from-right-2 duration-200',
                variantClasses[t.variant ?? 'default']
              )}
              role="alert"
              aria-live="polite"
            >
              <div className="shrink-0 w-4 h-4 flex-shrink-0">{variantIcons[t.variant ?? 'default']}</div>
              <div className="text-sm">
                {t.title && <p className="font-semibold leading-none">{t.title}</p>}
                {t.description && <p className="text-sm text-opacity-80 leading-relaxed">{t.description}</p>}
              </div>
              <button
                type="button"
                className="ml-auto shrink-0 rounded-sm p-1 text-current opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                onClick={() => dismiss(t.id)}
                aria-label="Descartar notificación"
              >
                <span className="sr-only">Descartar notificación</span>
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
