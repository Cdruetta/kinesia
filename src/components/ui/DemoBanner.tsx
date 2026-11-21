import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Lock, Sparkles } from 'lucide-react';
import { useLicense } from '@/hooks/useLicense';
import { LicenseActivationModal } from '@/components/settings/LicenseActivationModal';

export function DemoBanner() {
  const { isLicensed } = useLicense();
  const [open, setOpen] = useState(false);

  if (isLicensed) return null;

  return (
    <>
      <div className="rounded-xl border border-warning-text/20 bg-warning-bg p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-text mb-1">
              Modo demo — funciones limitadas
            </p>
            <p className="text-xs text-warning-text/80">
              Estás usando la versión gratuita. Activá una licencia para desbloquear exportación PDF, WhatsApp, y registros ilimitados.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Activar licencia
          </Button>
        </div>
      </div>
      <LicenseActivationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
