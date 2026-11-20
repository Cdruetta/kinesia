import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';
import type { Assessment } from '@/models';

export function useAssessments(patientId: string | undefined) {
  const data = useLiveQuery(() =>
    patientId ? db.assessments.where('patientId').equals(patientId).toArray() : db.assessments.toArray()
  );
  return {
    data: (data ?? []).filter((a) => !a.archivedAt && a.isLatest).sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime()),
    loading: data === undefined,
  };
}

export function useAssessment(id: string | undefined) {
  const data = useLiveQuery(() => (id ? db.assessments.get(id) : undefined));
  return {
    data: data as Assessment | undefined,
    loading: id !== undefined && data === undefined,
  };
}
