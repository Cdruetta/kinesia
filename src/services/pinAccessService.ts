import Dexie from 'dexie';
import { db } from '@/db/instance';
import type { Settings } from '@/models';
import { pinService } from '@/services/pinService';

const SETTINGS_ID = 'settings';
const FIRST_LOCKED_ATTEMPT = 4;
const BASE_LOCK_DELAY_MS = 5_000;
const MAX_LOCK_DELAY_MS = 60_000;

export type PinVerifier = (
  pin: string,
  salt: string,
  hash: string
) => Promise<boolean>;

export type PinUnlockResult =
  | { status: 'pending' }
  | { status: 'unavailable' }
  | { status: 'locked'; attempts: number; lockedUntil: string }
  | { status: 'success'; attempts: 0 }
  | { status: 'invalid'; attempts: number; lockedUntil: string | null };

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getPinLockDelayMs(attempts: number): number | null {
  if (attempts < FIRST_LOCKED_ATTEMPT) return null;
  return Math.min(
    BASE_LOCK_DELAY_MS * 2 ** (attempts - FIRST_LOCKED_ATTEMPT),
    MAX_LOCK_DELAY_MS
  );
}

/**
 * Verifica un PIN y registra el intento fallido de forma atómica.
 *
 * El contador y el bloqueo persistido son la fuente de verdad. La transacción
 * serializa intentos simultáneos —incluidos los que llegan desde otra
 * pestaña— para que dos verificaciones no calculen el mismo incremento.
 */
export const pinAccessService = {
  async unlock(
    pin: string,
    verify: PinVerifier = pinService.verifyPin.bind(pinService)
  ): Promise<PinUnlockResult> {
    return db.transaction('rw', db.settings, async (tx) => {
      const settings = await tx.table<Settings>('settings').get(SETTINGS_ID);
      if (
        !settings?.pinEnabled ||
        !settings.pinHash ||
        !settings.pinSalt
      ) {
        return { status: 'unavailable' };
      }

      const persistedAttempts = Math.max(0, settings.pinAttempts);
      const persistedLockTimestamp = parseTimestamp(settings.pinLockedUntil);
      const now = Date.now();

      if (persistedLockTimestamp !== null && persistedLockTimestamp > now) {
        return {
          status: 'locked',
          attempts: persistedAttempts,
          lockedUntil: settings.pinLockedUntil as string,
        };
      }

      const valid = await Dexie.waitFor(
        verify(pin, settings.pinSalt, settings.pinHash)
      );
      const updatedAt = new Date().toISOString();

      if (valid) {
        await tx.table<Settings>('settings').update(SETTINGS_ID, {
          pinAttempts: 0,
          pinLockedUntil: null,
          updatedAt,
        });
        return { status: 'success', attempts: 0 };
      }

      const attempts = persistedAttempts + 1;
      const delayMs = getPinLockDelayMs(attempts);
      const lockedUntil =
        delayMs === null
          ? null
          : new Date(now + delayMs).toISOString();

      await tx.table<Settings>('settings').update(SETTINGS_ID, {
        pinAttempts: attempts,
        pinLockedUntil: lockedUntil,
        updatedAt,
      });

      return { status: 'invalid', attempts, lockedUntil };
    });
  },
};
