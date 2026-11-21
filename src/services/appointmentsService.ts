import { db } from '@/db/instance';
import type { Appointment } from '@/models';
import {
  MAX_APPOINTMENT_DURATION_MINUTES,
  findOverlappingAppointment,
  isValidAppointmentDuration,
} from '@/utils/appointmentValidation';
import { settingsService } from '@/services/settingsService';
import {
  assertCanCreateLimitedRecord,
  DemoLimitExceededError,
} from '@/services/licenseLimitsService';

type AppointmentUpdate = Partial<
  Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>
>;

/**
 * Datos del turno reemplazo que pueden cambiar durante una reprogramación.
 * El estado del reemplazo siempre es `scheduled` para que deba volver a
 * confirmarse, y los vínculos de historial los controla el servicio.
 */
export type AppointmentRescheduleDetails = Partial<
  Pick<Appointment, 'patientId' | 'ownerId' | 'reason' | 'notes'>
>;

class AppointmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentValidationError';
  }
}

function assertValidDuration(durationMinutes: number): void {
  if (!isValidAppointmentDuration(durationMinutes)) {
    throw new AppointmentValidationError(
      `La duración del turno debe ser mayor que 0 y no puede superar ${MAX_APPOINTMENT_DURATION_MINUTES} minutos.`
    );
  }
}

/** Turnos activos que pueden bloquear un nuevo horario. */
async function getActiveAppointments(): Promise<Appointment[]> {
  const appointments = await db.appointments.toArray();
  return appointments.filter((appointment) => !appointment.archivedAt);
}

function formatConflictTime(appointment: Appointment): string {
  return new Date(appointment.startsAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
      // La lectura de conflictos y la escritura deben formar una única
      // operación: otro turno no puede pasar entre ambas operaciones.
      return await db.transaction('rw', db.appointments, db.settings, async (tx) => {
        assertValidDuration(data.durationMinutes);

        const existing = await getActiveAppointments();
        const conflict = findOverlappingAppointment(existing, data);
        if (conflict) {
          throw new AppointmentValidationError(
            `El turno se superpone con el de ${conflict.patientId} a las ${formatConflictTime(conflict)}.`
          );
        }

        // La licencia y el cupo se evaluan en la misma transacción que crea
        // el turno, junto con la validación de solapamiento.
        await assertCanCreateLimitedRecord(tx, 'appointments');

        const now = new Date().toISOString();
        const record: Appointment = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };
        await tx.table<Appointment>('appointments').add(record);
        return record;
      });
    } catch (error) {
      if (error instanceof AppointmentValidationError) throw error;
      if (error instanceof DemoLimitExceededError) throw error;
      throw new Error(`No se pudo crear el turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(id: string, patch: AppointmentUpdate): Promise<Appointment> {
    try {
      return await db.transaction('rw', db.appointments, async () => {
        const current = await db.appointments.get(id);
        if (!current) throw new Error('El turno ya no existe.');

        const now = new Date().toISOString();
        // Se construye un registro nuevo. `current` y `patch` nunca se
        // mutan, y los metadatos de identidad/archivado no se pueden
        // sobrescribir accidentalmente mediante el patch.
        const updatedData: Appointment = {
          ...current,
          ...patch,
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: now,
          archivedAt: current.archivedAt,
        };

        assertValidDuration(updatedData.durationMinutes);

        const existing = await getActiveAppointments();
        const conflict = findOverlappingAppointment(existing, updatedData);
        if (conflict) {
          throw new AppointmentValidationError(
            `El turno se superpone con el de ${conflict.patientId} a las ${formatConflictTime(conflict)}.`
          );
        }

        await db.appointments.put(updatedData);
        return updatedData;
      });
    } catch (error) {
      if (error instanceof AppointmentValidationError) throw error;
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
    newDurationMinutes?: number,
    replacementDetails?: AppointmentRescheduleDetails
  ): Promise<{ original: Appointment; newAppointment: Appointment }> {
    try {
      // Marcar el original y crear su reemplazo deben ser una sola operación:
      // si el alta fallara, el turno original no puede quedar cancelado solo.
      return await db.transaction('rw', db.appointments, db.settings, async (tx) => {
        const original = await tx.table<Appointment>('appointments').get(id);
        if (!original) throw new Error('El turno original ya no existe.');

        const durationMinutes = newDurationMinutes ?? original.durationMinutes;
        assertValidDuration(durationMinutes);

        // Crear nuevo turno con vínculo al original
        const now = new Date().toISOString();
        const newAppointment: Appointment = {
          id: crypto.randomUUID(),
          patientId: replacementDetails?.patientId ?? original.patientId,
          ownerId:
            replacementDetails?.ownerId !== undefined
              ? replacementDetails.ownerId
              : original.ownerId,
          startsAt: newStartsAt,
          durationMinutes,
          status: 'scheduled',
          reason:
            replacementDetails?.reason !== undefined
              ? replacementDetails.reason
              : original.reason,
          notes:
            replacementDetails?.notes !== undefined
              ? replacementDetails.notes
              : original.notes,
          rescheduledFrom: original.id,
          previousStartsAt: original.startsAt,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };

        // El original se cancelará como parte de esta misma operación, por
        // lo que no debe bloquear el reemplazo (incluso si se reprograma al
        // mismo horario). Los demás turnos activos sí se validan.
        const existing = await getActiveAppointments();
        const conflict = findOverlappingAppointment(
          existing.filter((appointment) => appointment.id !== original.id),
          newAppointment
        );
        if (conflict) {
          throw new AppointmentValidationError(
            `El nuevo turno se superpone con otro a las ${formatConflictTime(conflict)}.`
          );
        }

        // El original se cancela y se archiva dentro de la misma transacción
        // que crea el reemplazo. Así el cupo demo sigue contando todos los
        // registros no archivados y una reprogramación es neutra (3→3).
        const updatedOriginal: Appointment = {
          ...original,
          status: 'cancelled',
          notes: `${original.notes ? original.notes + ' ' : ''}Reprogramado a ${newStartsAt}.`,
          updatedAt: now,
          archivedAt: original.archivedAt ?? now,
        };

        await tx.table<Appointment>('appointments').put(updatedOriginal);
        await assertCanCreateLimitedRecord(tx, 'appointments');
        await tx.table<Appointment>('appointments').add(newAppointment);

        return { original: updatedOriginal, newAppointment };
      });
    } catch (error) {
      if (error instanceof AppointmentValidationError) throw error;
      if (error instanceof DemoLimitExceededError) throw error;
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
