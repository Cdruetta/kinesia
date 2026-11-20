import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';
import type { Owner } from '@/models';

export function useOwner(id: string | undefined) {
  const data = useLiveQuery(() => (id ? db.owners.get(id) : undefined));
  return {
    data: data as Owner | undefined,
    loading: id !== undefined && data === undefined,
  };
}
