import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { settingsService } from '@/services/settingsService';
import {
  licenseService,
  normalizeLicenseCode,
  type LicenseService,
} from '@/services/licenseService';

export type LicenseValidator = Pick<LicenseService, 'validateLicense'>;

/**
 * Estado de licencia derivado del código persistido.
 *
 * El booleano guardado en settings es solo un estado auxiliar: nunca concede
 * funciones premium por sí solo. El código se revalida contra los hashes de la
 * versión instalada cada vez que cambia.
 */
export function useLicense(validator: LicenseValidator = licenseService) {
  const { data: settings } = useSettings();
  const [isLicensed, setIsLicensed] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const settingsLoaded = settings !== undefined;
  const persistedLicenseKey = settings?.licenseKey ?? null;
  const persistedLicenseFlag = settings?.isLicensed ?? false;

  useEffect(() => {
    let cancelled = false;

    if (!settingsLoaded) {
      setIsLicensed(false);
      setLicenseKey(null);
      setIsValidating(false);
      return;
    }

    const normalizedKey = persistedLicenseKey
      ? normalizeLicenseCode(persistedLicenseKey)
      : null;

    if (!normalizedKey) {
      setIsLicensed(false);
      setLicenseKey(null);
      setIsValidating(false);

      if (persistedLicenseFlag || persistedLicenseKey !== null) {
        void settingsService
          .update({ isLicensed: false, licenseKey: null })
          .catch(() => {
            // La UI sigue en modo demo aunque no se pueda persistir la revocación.
          });
      }
      return;
    }

    setIsValidating(true);

    void (async () => {
      try {
        const valid = await validator.validateLicense(normalizedKey);
        if (cancelled) return;

        // Relee settings para no revocar una licencia que se activó mientras
        // esta validación estaba en curso.
        const current = await settingsService.get();
        if (cancelled) return;

        const currentKey = current.licenseKey
          ? normalizeLicenseCode(current.licenseKey)
          : null;
        if (currentKey !== normalizedKey) {
          setIsLicensed(false);
          setLicenseKey(null);
          return;
        }

        if (valid) {
          setIsLicensed(true);
          setLicenseKey(normalizedKey);

          if (!current.isLicensed || current.licenseKey !== normalizedKey) {
            await settingsService.update({
              isLicensed: true,
              licenseKey: normalizedKey,
            });
          }
        } else {
          setIsLicensed(false);
          setLicenseKey(null);
          await settingsService.update({ isLicensed: false, licenseKey: null });
        }
      } catch {
        if (cancelled) return;

        // Ante un error de validación o almacenamiento se falla de forma
        // cerrada: el estado premium nunca se concede sin una validación OK.
        setIsLicensed(false);
        setLicenseKey(null);

        try {
          const current = await settingsService.get();
          const currentKey = current.licenseKey
            ? normalizeLicenseCode(current.licenseKey)
            : null;
          if (currentKey === normalizedKey) {
            await settingsService.update({ isLicensed: false, licenseKey: null });
          }
        } catch {
          // Si tampoco se puede leer settings, se mantiene el modo demo.
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    persistedLicenseFlag,
    persistedLicenseKey,
    settingsLoaded,
    validator,
  ]);

  const activateLicense = useCallback(
    async (code: string): Promise<boolean> => {
      const normalizedCode = normalizeLicenseCode(code);
      const valid = await validator.validateLicense(normalizedCode);
      if (!valid) return false;

      await settingsService.update({
        isLicensed: true,
        licenseKey: normalizedCode,
      });
      setIsLicensed(true);
      setLicenseKey(normalizedCode);
      setIsValidating(false);
      return true;
    },
    [validator]
  );

  const deactivateLicense = useCallback(async (): Promise<void> => {
    await settingsService.update({ isLicensed: false, licenseKey: null });
    setIsLicensed(false);
    setLicenseKey(null);
    setIsValidating(false);
  }, []);

  return {
    isLicensed,
    licenseKey,
    isValidating,
    activateLicense,
    deactivateLicense,
  };
}
