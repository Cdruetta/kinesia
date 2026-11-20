import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';
import { settingsService } from '@/services/settingsService';

/**
 * Suscribe a la configuración de la clínica. Se reactiva automáticamente
 * cuando el registro de settings cambia en IndexedDB.
 * Si no existe un registro, lo crea con los valores por defecto.
 */
export function useSettings() {
  const data = useLiveQuery(() => db.settings.get('settings'));

  useEffect(() => {
    // Si no hay registro, crearlo con valores por defecto
    if (data === undefined) {
      void settingsService.get().catch(() => {
        // silencioso
      });
    }
  }, [data]);

  return {
    data,
    loading: data === undefined,
  };
}
