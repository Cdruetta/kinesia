import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';

/**
 * Suscribe a la lista de propietarios no archivados.
 * Reactiva automáticamente cuando cambia la tabla owners.
 */
export function useOwners() {
  const data = useLiveQuery(() => db.owners.toArray());
  return {
    data: (data ?? []).filter((o) => !o.archivedAt),
    loading: data === undefined,
  };
}

/** Suscribe a la lista de propietarios incluyendo archivados (para administrador). */
export function useOwnersIncludingArchived() {
  const data = useLiveQuery(() => db.owners.toArray());
  return {
    data: data ?? [],
    loading: data === undefined,
  };
}
