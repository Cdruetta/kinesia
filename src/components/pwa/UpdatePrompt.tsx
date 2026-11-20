/// <reference types="vite-plugin-pwa/client" />
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {
      // Service worker registrado
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-white dark:bg-[#251f33] border border-border dark:border-violet-800/30 shadow-md px-4 py-3">
      <span className="text-sm text-ink-main dark:text-violet-50">Hay una nueva versión disponible.</span>
      <Button
        variant="primary"
        size="sm"
        onClick={() => updateServiceWorker(true)}
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
      </Button>
      <Button variant="subtle" size="sm" onClick={() => setNeedRefresh(false)}>
        ×
      </Button>
    </div>
  );
}
