import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePin } from '@/hooks/usePin';
import { Lock } from 'lucide-react';

export function PinLockScreen() {
  const { locked, attempts, lockedUntil, unlock } = usePin();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!locked) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const valid = await unlock(pin);
    if (valid) {
      setPin('');
    } else {
      setError('PIN incorrecto. Intentá de nuevo.');
      setPin('');
    }
  };

  const isLocked = lockedUntil && new Date() < lockedUntil;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background dark:bg-[#1a1625]">
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-violet-600" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink-main dark:text-violet-50 mb-2">Kinesia</h1>
          <p className="text-sm text-ink-secondary dark:text-violet-200/70 mb-6">Ingresá tu PIN para desbloquear.</p>

          {isLocked && (
            <div className="mb-4 p-3 rounded-lg bg-warning-bg text-warning-text text-sm">
              Demasiados intentos. Esperá {Math.ceil((lockedUntil!.getTime() - Date.now()) / 1000)} segundos.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              disabled={!!isLocked}
              autoFocus
            />
            {error && <p className="text-sm text-error-text">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={!!isLocked || pin.length < 4}>
              Desbloquear
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
