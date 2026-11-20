import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';
import type { Session } from '@/models';

export function useSessions(patientId?: string) {
  const data = useLiveQuery(() =>
    patientId ? db.sessions.where('patientId').equals(patientId).toArray() : db.sessions.toArray()
  );
  return {
    data: (data ?? []).filter((s) => !s.archivedAt && s.isLatest).sort((a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime()),
    loading: data === undefined,
  };
}

export function useSession(id: string | undefined) {
  const data = useLiveQuery(() => (id ? db.sessions.get(id) : undefined));
  return {
    data: data as Session | undefined,
    loading: id !== undefined && data === undefined,
  };
}
