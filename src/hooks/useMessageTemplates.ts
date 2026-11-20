import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';

export function useMessageTemplates() {
  const data = useLiveQuery(() => db.messageTemplates.toArray());
  return {
    data: (data ?? []).filter((t) => !t.archivedAt).sort((a, b) => a.name.localeCompare(b.name)),
    loading: data === undefined,
  };
}
