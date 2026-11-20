import { useEffect, useState } from 'react';
import { ensureStorage, type StorageState } from '@/db/instance';

/**
 * Comprueba si el navegador soporta IndexedDB y si el almacenamiento
 * persistente fue concedido. Se ejecuta una sola vez al montar.
 */
export function useStorage(): StorageState | null {
  const [state, setState] = useState<StorageState | null>(null);

  useEffect(() => {
    void ensureStorage().then(setState);
  }, []);

  return state;
}
