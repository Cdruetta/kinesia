import { db } from '@/db/instance';
import type { Settings } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';
import { normalizeLicenseCode } from '@/services/licenseService';

const SETTINGS_ID = 'settings';

/**
 * Servicio de configuración de la clínica.
 * Único registro en la tabla `settings`, identificado por el id fijo
 * "settings". Los cambios persisten en IndexedDB y se reflejan de
 * inmediato donde se consumen (sidebar, cabecera, pies de página).
 */
export const settingsService = {
  /** Devuelve la configuración actual o los valores por defecto si no existe. */
  async get(): Promise<Settings> {
    try {
      const existing = await db.settings.get(SETTINGS_ID);
      if (existing) return existing;

      // Si todavía no existe, la creación se serializa y vuelve a comprobar
      // dentro de la transacción para que dos pestañas no inserten el mismo ID.
      return await db.transaction('rw', db.settings, async () => {
        const current = await db.settings.get(SETTINGS_ID);
        if (current) return current;

        const now = new Date().toISOString();
        const defaults: Settings = {
          id: SETTINGS_ID,
          ...DEFAULT_SETTINGS,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };
        await db.settings.add(defaults);
        return defaults;
      });
    } catch (error) {
      throw new Error(
        `No se pudo leer la configuración de la clínica: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  },

  /** Actualiza campos parciales de la configuración. */
  async update(patch: Partial<Omit<Settings, 'id' | 'createdAt' | 'archivedAt'>>): Promise<Settings> {
    try {
      // La lectura y la escritura deben compartir una transacción rw. Si dos
      // pestañas cambian campos distintos, la segunda lectura ve el cambio de
      // la primera y conserva ambos valores.
      return await db.transaction('rw', db.settings, async (tx) => {
        const current = await tx.table<Settings>('settings').get(SETTINGS_ID);
        const now = new Date().toISOString();
        const base: Settings = current ?? {
          id: SETTINGS_ID,
          ...DEFAULT_SETTINGS,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };
        const updated: Settings = {
          ...base,
          ...patch,
          id: SETTINGS_ID,
          createdAt: base.createdAt,
          updatedAt: now,
          archivedAt: base.archivedAt,
        };
        await tx.table<Settings>('settings').put(updated);
        return updated;
      });
    } catch (error) {
      throw new Error(
        `No se pudo guardar la configuración de la clínica: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  },

  /**
   * Actualiza el estado de licencia sólo si la clave persistida sigue siendo
   * la esperada. Devuelve `null` si otra pestaña cambió la clave entretanto.
   */
  async updateLicenseState(
    expectedLicenseKey: string | null,
    state: { isLicensed: boolean; licenseKey: string | null }
  ): Promise<Settings | null> {
    try {
      return await db.transaction('rw', db.settings, async (tx) => {
        const current = await tx.table<Settings>('settings').get(SETTINGS_ID);
        const currentKey = current?.licenseKey
          ? normalizeLicenseCode(current.licenseKey) || null
          : null;
        const expectedKey = expectedLicenseKey
          ? normalizeLicenseCode(expectedLicenseKey) || null
          : null;

        if (currentKey !== expectedKey) return null;

        const now = new Date().toISOString();
        const base: Settings = current ?? {
          id: SETTINGS_ID,
          ...DEFAULT_SETTINGS,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };
        const updated: Settings = {
          ...base,
          isLicensed: state.isLicensed,
          licenseKey: state.licenseKey
            ? normalizeLicenseCode(state.licenseKey) || null
            : null,
          updatedAt: now,
        };
        await tx.table<Settings>('settings').put(updated);
        return updated;
      });
    } catch (error) {
      throw new Error(
        `No se pudo guardar el estado de la licencia: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  },

  /** Reemplaza el logotipo (data URL) de la clínica. */
  async setLogo(dataUrl: string | null): Promise<Settings> {
    return this.update({ logo: dataUrl });
  },
};
