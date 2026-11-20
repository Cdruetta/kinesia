import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useSettings } from '@/hooks/useSettings';
import { settingsService } from '@/services/settingsService';
import { pinService } from '@/services/pinService';
import { Lock, AlertTriangle } from 'lucide-react';

export function PinSettings() {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [autoLock, setAutoLock] = useState(settings?.autoLockMinutes ?? 5);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const isEnabled = settings?.pinEnabled ?? false;

  const handleEnable = async () => {
    if (!pinService.isValidPin(pin)) {
      toast({ variant: 'error', title: 'PIN inválido', description: 'El PIN debe tener entre 4 y 6 dígitos numéricos.' });
      return;
    }
    if (pin !== confirmPin) {
      toast({ variant: 'error', title: 'Los PIN no coinciden' });
      return;
    }

    setEnabling(true);
    try {
      const salt = await pinService.generateSalt();
      const hash = await pinService.hashPin(pin, salt);
      await settingsService.update({
        pinEnabled: true,
        pinHash: hash,
        pinSalt: salt,
        pinAttempts: 0,
        pinLockedUntil: null,
        autoLockMinutes: autoLock,
      });
      toast({ variant: 'success', title: 'PIN activado' });
      setPin('');
      setConfirmPin('');
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo activar el PIN', description: error instanceof Error ? error.message : 'Error inesperado.' });
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    if (!currentPin) {
      toast({ variant: 'error', title: 'Ingresá el PIN actual' });
      return;
    }
    if (!settings?.pinSalt || !settings?.pinHash) return;

    const valid = await pinService.verifyPin(currentPin, settings.pinSalt, settings.pinHash);
    if (!valid) {
      toast({ variant: 'error', title: 'PIN incorrecto' });
      return;
    }

    setDisabling(true);
    try {
      await settingsService.update({
        pinEnabled: false,
        pinHash: null,
        pinSalt: null,
        pinAttempts: 0,
        pinLockedUntil: null,
        autoLockMinutes: 0,
      });
      toast({ variant: 'success', title: 'PIN desactivado' });
      setCurrentPin('');
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo desactivar el PIN', description: error instanceof Error ? error.message : 'Error inesperado.' });
    } finally {
      setDisabling(false);
    }
  };

  const handleUpdateAutoLock = async () => {
    try {
      await settingsService.update({ autoLockMinutes: autoLock });
      toast({ variant: 'success', title: 'Tiempo de bloqueo actualizado' });
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo actualizar', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-5 h-5 text-violet-600" />
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Bloqueo local con PIN</h3>
      </div>

      <div className="rounded-lg border border-warning-text/20 bg-warning-bg p-3 text-xs text-warning-text">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Este es un bloqueo de pantalla, no un cifrado de los datos. Los datos siguen guardados en IndexedDB sin cifrar.
            Si olvidás el PIN, la única salida es borrar los datos locales y restaurar un respaldo. No hay recuperación de PIN.
          </p>
        </div>
      </div>

      {isEnabled ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary dark:text-violet-200/70">El PIN está activo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="PIN actual"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="Ingresá el PIN actual"
            />
          </div>
          <Button variant="destructive" onClick={handleDisable} disabled={disabling}>
            {disabling ? 'Desactivando…' : 'Desactivar PIN'}
          </Button>

          <div className="border-t border-border dark:border-violet-800/30 pt-4 space-y-3">
            <label className="block text-sm font-medium text-ink-main dark:text-violet-50">
              Bloqueo automático por inactividad (minutos, 0 = desactivado)
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={autoLock}
                onChange={(e) => setAutoLock(Number(e.target.value))}
              />
              <Button variant="subtle" onClick={handleUpdateAutoLock}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary dark:text-violet-200/70">Activá un PIN numérico (4 a 6 dígitos) para bloquear la app.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nuevo PIN"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4 a 6 dígitos"
            />
            <Input
              label="Confirmar PIN"
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Repetí el PIN"
            />
          </div>
          <Button variant="primary" onClick={handleEnable} disabled={enabling}>
            {enabling ? 'Activando…' : 'Activar PIN'}
          </Button>
        </div>
      )}
    </div>
  );
}
