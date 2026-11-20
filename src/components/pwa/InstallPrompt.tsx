import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/Button';
import { Download } from 'lucide-react';

export function InstallPrompt() {
  const { canInstall, install } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button variant="primary" size="sm" onClick={install}>
        <Download className="w-4 h-4 mr-2" /> Instalar aplicación
      </Button>
    </div>
  );
}
