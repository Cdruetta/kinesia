import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { settingsService } from '@/services/settingsService';
import { pinService } from '@/services/pinService';

export function usePin() {
  const { data: settings } = useSettings();
  const [locked, setLocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPinEnabled = settings?.pinEnabled ?? false;

  // Bloqueo inicial si el PIN está activo
  useEffect(() => {
    if (isPinEnabled) {
      setLocked(true);
    }
  }, [isPinEnabled]);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    if (!settings?.pinHash || !settings?.pinSalt) return false;

    // Verificar bloqueo temporal
    if (lockedUntil && new Date() < lockedUntil) {
      return false;
    }

    const valid = await pinService.verifyPin(pin, settings.pinSalt, settings.pinHash);
    if (valid) {
      setLocked(false);
      setAttempts(0);
      setLockedUntil(null);
      await settingsService.update({ pinAttempts: 0, pinLockedUntil: null });
      return true;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    await settingsService.update({ pinAttempts: newAttempts });

    // Espera creciente: 0, 0, 0, 5s, 15s, 30s, 60s...
    if (newAttempts >= 4) {
      const delay = Math.min(5 * Math.pow(2, newAttempts - 4), 60) * 1000;
      const until = new Date(Date.now() + delay);
      setLockedUntil(until);
      await settingsService.update({ pinLockedUntil: until.toISOString() });
    }

    return false;
  }, [settings, attempts, lockedUntil]);

  const lock = useCallback(() => {
    if (isPinEnabled) setLocked(true);
  }, [isPinEnabled]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    const minutes = settings?.autoLockMinutes ?? 0;
    if (minutes > 0 && isPinEnabled) {
      inactivityTimer.current = setTimeout(() => {
        setLocked(true);
      }, minutes * 60 * 1000);
    }
  }, [settings, isPinEnabled]);

  useEffect(() => {
    if (isPinEnabled) {
      resetInactivityTimer();
      const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
      const handler = () => resetInactivityTimer();
      events.forEach((e) => window.addEventListener(e, handler));
      return () => {
        events.forEach((e) => window.removeEventListener(e, handler));
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      };
    }
  }, [isPinEnabled, resetInactivityTimer]);

  return {
    locked,
    isPinEnabled,
    attempts,
    lockedUntil,
    unlock,
    lock,
  };
}
