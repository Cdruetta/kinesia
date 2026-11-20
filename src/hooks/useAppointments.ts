import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/instance';
import type { Appointment } from '@/models';

export function useAppointments({
  startDate,
  endDate,
  status,
  patientId,
  ownerId,
}: {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  patientId?: string;
  ownerId?: string;
} = {}) {
  const data = useLiveQuery(() => {
    let query = db.appointments.toCollection();
    return query.toArray();
  });

  const filtered = (data ?? []).filter((a) => {
    if (a.archivedAt) return false;
    if (status && a.status !== status) return false;
    if (patientId && a.patientId !== patientId) return false;
    if (ownerId && a.ownerId !== ownerId) return false;
    if (startDate && new Date(a.startsAt) < startDate) return false;
    if (endDate && new Date(a.startsAt) > endDate) return false;
    return true;
  });

  return {
    data: filtered.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    loading: data === undefined,
  };
}

export function useAppointment(id: string | undefined) {
  const data = useLiveQuery(() => (id ? db.appointments.get(id) : undefined));
  return {
    data: data as Appointment | undefined,
    loading: id !== undefined && data === undefined,
  };
}
