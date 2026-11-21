import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { pinAccessService, type PinUnlockResult } from '@/services/pinAccessService';

function parseLockedUntil(value: string | null | undefined): Date | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp);
}

export function usePin() {
  const { data: settings } = useSettings();
  const isPinEnabled = settings?.pinEnabled ?? false;
  const [locked, setLocked] = useState(isPinEnabled);
  const [attempts, setAttempts] = useState(settings?.pinAttempts ?? 0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(() =>
    parseLockedUntil(settings?.pinLockedUntil)
  );
  const [unlockPending, setUnlockPending] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockPendingRef = useRef(false);

  // Rehidrata el estado desde la configuración persistida. Así una recarga o
  // un segundo control de la aplicación no puede reiniciar el bloqueo.
  useEffect(() => {
    setAttempts(settings?.pinAttempts ?? 0);
    setLockedUntil(parseLockedUntil(settings?.pinLockedUntil));
  }, [settings?.pinAttempts, settings?.pinLockedUntil]);

  useEffect(() => {
    if (isPinEnabled) {
      setLocked(true);
    } else {
      setLocked(false);
    }
  }, [isPinEnabled]);

  // Programa un nuevo render al vencer el bloqueo temporal. Sin este timer,
  // el formulario podía quedar deshabilitado hasta que ocurriera otro render.
  useEffect(() => {
    if (!lockedUntil) return;

    const remaining = lockedUntil.getTime() - Date.now();
    if (remaining <= 0) {
      setLockedUntil(null);
      setClock(Date.now());
      return;
    }

    const timer = window.setTimeout(() => {
      setLockedUntil(null);
      setClock(Date.now());
    }, remaining + 10);
    return () => window.clearTimeout(timer);
  }, [lockedUntil]);

  const unlock = useCallback(async (pin: string): Promise<PinUnlockResult> => {
    if (unlockPendingRef.current) {
      return { status: 'pending' };
    }

    unlockPendingRef.current = true;
    setUnlockPending(true);
    try {
      const result = await pinAccessService.unlock(pin);
      if (result.status === 'success') {
        setLocked(false);
        setAttempts(0);
        setLockedUntil(null);
      } else if (result.status === 'invalid') {
        setAttempts(result.attempts);
        setLockedUntil(parseLockedUntil(result.lockedUntil));
      } else if (result.status === 'locked') {
        setAttempts(result.attempts);
        setLockedUntil(parseLockedUntil(result.lockedUntil));
      }
      return result;
    } finally {
      unlockPendingRef.current = false;
      setUnlockPending(false);
    }
  }, []);

  const lock = useCallback(() => {
    if (isPinEnabled) setLocked(true);
  }, [isPinEnabled]);

  const autoLockMinutes = settings?.autoLockMinutes ?? 0;
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (autoLockMinutes > 0 && isPinEnabled) {
      inactivityTimer.current = setTimeout(() => {
        setLocked(true);
      }, autoLockMinutes * 60 * 1000);
    }
  }, [autoLockMinutes, isPinEnabled]);

  useEffect(() => {
    if (isPinEnabled) {
      resetInactivityTimer();
      const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
      const handler = () => resetInactivityTimer();
      events.forEach((event) => window.addEventListener(event, handler));
      return () => {
        events.forEach((event) => window.removeEventListener(event, handler));
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      };
    }
  }, [isPinEnabled, resetInactivityTimer]);

  const isTemporarilyLocked = Boolean(
    lockedUntil && lockedUntil.getTime() > clock
  );
  const remainingSeconds = isTemporarilyLocked
    ? Math.ceil((lockedUntil!.getTime() - clock) / 1000)
    : 0;

  return {
    locked,
    isPinEnabled,
    attempts,
    lockedUntil,
    isTemporarilyLocked,
    remainingSeconds,
    unlockPending,
    unlock,
    lock,
  };
}
