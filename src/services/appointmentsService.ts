import { db } from '@/db/instance';
import type { Appointment } from '@/models';
import {
  findOverlappingAppointment,
  startOfDay,
  endOfDay,
} from '@/utils/appointmentValidation';
import { settingsService } from '@/services/settingsService';

/**
 * Servicio de turnos.
 * CRUD, cambio de estado, cancelación, reprogramación, búsqueda y validación de horarios.
 */

export const appointmentsService = {
  async getAll({
    startDate,
    endDate,
    status,
    patientId,
    ownerId,
    includeArchived = false,
  }: {
    startDate?: Date;
    endDate?: Date;
    status?: AppointmentStatus;
    patientId?: string;
    ownerId?: string;
    includeArchived?: boolean;
  } = {}): Promise<Appointment[]> {
    try {
      let all = await db.appointments.toArray();

      if (!includeArchived) all = all.filter((a) => !a.archivedAt);
      if (status) all = all.filter((a) => a.status === status);
      if (patientId) all = all.filter((a) => a.patientId === patientId);
      if (ownerId) all = all.filter((a) => a.ownerId === ownerId);
      if (startDate) all = all.filter((a) => new Date(a.startsAt) >= startDate);
      if (endDate) all = all.filter((a) => new Date(a.startsAt) <= endDate);

      return all.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    } catch (error) {
      throw new Error(`No se pudieron cargar los turnos: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getById(id: string): Promise<Appointment | undefined> {
    try {
      return db.appointments.get(id);
    } catch (error) {
      throw new Error(`No se pudo cargar el turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async create(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<Appointment> {
    try {
      // Validar solapamiento
      const dayStart = startOfDay(new Date(data.startsAt));
      const dayEnd = endOfDay(new Date(data.startsAt));
      const existing = await this.getAll({ startDate: dayStart, endDate: dayEnd });
      const conflict = findOverlappingAppointment(existing, data);
      if (conflict) {
        throw new Error(
          `El turno se superpone con el de ${conflict.patientId} a las ${new Date(conflict.startsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.`
        );
      }

      const now = new Date().toISOString();
      const record: Appointment = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await db.appointments.add(record);
      return record;
    } catch (error) {
      if (error instanceof Error && error.message.includes('se superpone')) throw error;
      throw new Error(`No se pudo crear el turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(
    id: string,
    patch: Partial<Omit<Appointment, 'id' | 'createdAt' | 'archivedAt'>>
  ): Promise<Appointment> {
    try {
      const current = await db.appointments.get(id);
      if (!current) throw new Error('El turno ya no existe.');

      const updatedData = { ...current, ...patch };
      const dayStart = startOfDay(new Date(updatedData.startsAt));
      const dayEnd = endOfDay(new Date(updatedData.startsAt));
      const existing = await this.getAll({ startDate: dayStart, endDate: dayEnd, includeArchived: true });
      const conflict = findOverlappingAppointment(existing, { ...updatedData, id });
      if (conflict) {
        throw new Error(
          `El turno se superpone con el de ${conflict.patientId} a las ${new Date(conflict.startsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.`
        );
      }

      const now = new Date().toISOString();
      const updated: Appointment = { ...updatedData, updatedAt: now };
      await db.appointments.put(updated);
      return updated;
    } catch (error) {
      if (error instanceof Error && error.message.includes('se superpone')) throw error;
      throw new Error(`No se pudo actualizar el turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async changeStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    try {
      const current = await db.appointments.get(id);
      if (!current) throw new Error('El turno ya no existe.');

      const now = new Date().toISOString();
      const updated: Appointment = { ...current, status, updatedAt: now };
      await db.appointments.put(updated);
      return updated;
    } catch (error) {
      throw new Error(`No se pudo cambiar el estado del turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async cancel(id: string, reason?: string): Promise<Appointment> {
    try {
      const current = await db.appointments.get(id);
      if (!current) throw new Error('El turno ya no existe.');

      const now = new Date().toISOString();
      const updated: Appointment = {
        ...current,
        status: 'cancelled',
        notes: reason ? `${current.notes ? current.notes + ' ' : ''}Cancelado: ${reason}` : current.notes,
        updatedAt: now,
      };
      await db.appointments.put(updated);
      return updated;
    } catch (error) {
      throw new Error(`No se pudo cancelar el turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async reschedule(
    id: string,
    newStartsAt: string,
    newDurationMinutes?: number
  ): Promise<{ original: Appointment; newAppointment: Appointment }> {
    try {
      const original = await db.appointments.get(id);
      if (!original) throw new Error('El turno original ya no existe.');

      // Crear nuevo turno con vínculo al original
      const now = new Date().toISOString();
      const newAppointment: Appointment = {
        id: crypto.randomUUID(),
        patientId: original.patientId,
        ownerId: original.ownerId,
        startsAt: newStartsAt,
        durationMinutes: newDurationMinutes ?? original.durationMinutes,
        status: 'scheduled',
        reason: original.reason,
        notes: original.notes,
        rescheduledFrom: original.id,
        previousStartsAt: original.startsAt,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };

      // Validar solapamiento del nuevo turno
      const dayStart = startOfDay(new Date(newStartsAt));
      const dayEnd = endOfDay(new Date(newStartsAt));
      const existing = await this.getAll({ startDate: dayStart, endDate: dayEnd });
      const conflict = findOverlappingAppointment(existing, newAppointment);
      if (conflict) {
        throw new Error(
          `El nuevo turno se superpone con otro a las ${new Date(conflict.startsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.`
        );
      }

      // Marcar original como cancelado
      const updatedOriginal: Appointment = {
        ...original,
        status: 'cancelled',
        notes: `${original.notes ? original.notes + ' ' : ''}Reprogramado a ${newStartsAt}.`,
        updatedAt: now,
      };

      await db.appointments.put(updatedOriginal);
      await db.appointments.add(newAppointment);

      return { original: updatedOriginal, newAppointment };
    } catch (error) {
      if (error instanceof Error && error.message.includes('se superpone')) throw error;
      throw new Error(`No se pudo reprogramar el turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async search(query: string): Promise<Appointment[]> {
    try {
      const all = await this.getAll();
      const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (!normalized) return all;

      // Join con patients y owners para buscar por nombre
      const patients = await db.patients.toArray();
      const owners = await db.owners.toArray();
      const patientById = new Map(patients.map((p) => [p.id, p]));
      const ownerById = new Map(owners.map((o) => [o.id, o]));

      return all.filter((a) => {
        const patient = patientById.get(a.patientId);
        const owner = a.ownerId ? ownerById.get(a.ownerId) : undefined;
        const reason = a.reason ?? '';
        const haystack = [
          patient?.name ?? '',
          owner?.name ?? '',
          reason,
        ].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return haystack.includes(normalized);
      });
    } catch (error) {
      throw new Error(`No se pudo buscar turnos: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getClinicHours() {
    const settings = await settingsService.get();
    if (!settings.hours) return null;
    try {
      return JSON.parse(settings.hours);
    } catch {
      return null;
    }
  },
};

// Re-exportar AppointmentStatus para que el resto de la app lo importe de aquí si quiere
import type { AppointmentStatus } from '@/models';
export type { AppointmentStatus };
