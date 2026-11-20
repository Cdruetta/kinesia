import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-warning-bg border border-warning-text/20 px-3 py-2 text-sm text-warning-text shadow-md">
      <WifiOff className="w-4 h-4" />
      <span>Sin conexión</span>
    </div>
  );
}
