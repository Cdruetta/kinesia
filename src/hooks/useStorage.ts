import { useEffect, useState } from 'react';
import type { StorageState } from '@/db/instance';
import { storageService } from '@/services/storageService';

/**
 * Comprueba si el navegador soporta IndexedDB y si el almacenamiento
 * persistente fue concedido. Se ejecuta una sola vez al montar.
 */
export function useStorage(): StorageState | null {
  const [state, setState] = useState<StorageState | null>(null);

  useEffect(() => {
    void storageService.ensurePersistent().then(setState);
  }, []);

  return state;
}
