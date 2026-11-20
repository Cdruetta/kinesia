import { db } from '@/db/instance';
import type { Settings } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';

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
      const current = await this.get();
      const now = new Date().toISOString();
      const updated: Settings = {
        ...current,
        ...patch,
        updatedAt: now,
      };
      await db.settings.put(updated);
      return updated;
    } catch (error) {
      throw new Error(
        `No se pudo guardar la configuración de la clínica: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  },

  /** Reemplaza el logotipo (data URL) de la clínica. */
  async setLogo(dataUrl: string | null): Promise<Settings> {
    return this.update({ logo: dataUrl });
  },
};
