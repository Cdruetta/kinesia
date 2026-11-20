import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';

export function useCommunications({ ownerId, patientId }: { ownerId?: string; patientId?: string } = {}) {
  const data = useLiveQuery(() => {
    if (patientId) return db.communications.where('patientId').equals(patientId).toArray();
    if (ownerId) return db.communications.where('ownerId').equals(ownerId).toArray();
    return db.communications.toArray();
  });
  return {
    data: (data ?? []).filter((c) => !c.archivedAt).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    loading: data === undefined,
  };
}
