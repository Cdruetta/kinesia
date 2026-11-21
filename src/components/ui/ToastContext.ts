import { createContext, useContext } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
  duration?: number;
}

export interface ToastContextValue {
  toasts: Toast[];
  toast: (_props: Omit<Toast, 'id'>) => string;
  dismiss: (_id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** Accede al sistema de notificaciones de la aplicación. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context;
}
