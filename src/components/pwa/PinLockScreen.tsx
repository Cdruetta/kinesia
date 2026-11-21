import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePin } from '@/hooks/usePin';
import { Lock } from 'lucide-react';

export function PinLockScreen() {
  const {
    locked,
    attempts,
    isTemporarilyLocked,
    remainingSeconds,
    unlockPending,
    unlock,
  } = usePin();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!locked) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const result = await unlock(pin);
      if (result.status === 'success') {
        setPin('');
        return;
      }

      setPin('');
      if (result.status === 'locked') {
        setError('Todavía hay un bloqueo temporal. Esperá a que termine.');
      } else if (result.status === 'pending') {
        setError('Ya hay una verificación en curso.');
      } else if (result.status === 'unavailable') {
        setError('El PIN no está configurado correctamente.');
      } else {
        setError('PIN incorrecto. Intentá de nuevo.');
      }
    } catch {
      setPin('');
      setError('No se pudo verificar el PIN. Intentá de nuevo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background dark:bg-[#1a1625]">
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-violet-600" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink-main dark:text-violet-50 mb-2">Kinesia</h1>
          <p className="text-sm text-ink-secondary dark:text-violet-200/70 mb-6">Ingresá tu PIN para desbloquear.</p>

          {isTemporarilyLocked && (
            <div className="mb-4 p-3 rounded-lg bg-warning-bg text-warning-text text-sm">
              Demasiados intentos. Esperá {remainingSeconds} segundos.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN"
              disabled={isTemporarilyLocked || unlockPending}
              autoFocus
            />
            {error && <p className="text-sm text-error-text">{error}</p>}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={
                isTemporarilyLocked || unlockPending || pin.length < 4
              }
            >
              {unlockPending ? 'Verificando…' : 'Desbloquear'}
            </Button>
          </form>

          {attempts > 0 && (
            <p className="mt-4 text-xs text-ink-secondary dark:text-violet-200/70">
              Intentos fallidos: {attempts}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
