import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';
import type { Patient } from '@/models';

export function usePatient(id: string | undefined) {
  const data = useLiveQuery(() => (id ? db.patients.get(id) : undefined));
  return {
    data: data as Patient | undefined,
    loading: id !== undefined && data === undefined,
  };
}
