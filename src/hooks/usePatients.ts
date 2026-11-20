import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';

export function usePatients({ ownerId }: { ownerId?: string } = {}) {
  const data = useLiveQuery(() =>
    ownerId ? db.patients.where('ownerId').equals(ownerId).toArray() : db.patients.toArray()
  );
  return {
    data: (data ?? []).filter((p) => !p.archivedAt),
    loading: data === undefined,
  };
}

export function usePatientsIncludingArchived({ ownerId }: { ownerId?: string } = {}) {
  const data = useLiveQuery(() =>
    ownerId ? db.patients.where('ownerId').equals(ownerId).toArray() : db.patients.toArray()
  );
  return {
    data: data ?? [],
    loading: data === undefined,
  };
}
