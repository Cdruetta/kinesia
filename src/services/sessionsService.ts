import { db } from '@/db/instance';
import type { Session } from '@/models';
import { getVersionChain } from '@/utils/versioning';

/**
 * Servicio de sesiones y tratamientos.
 * CRUD con versionado: al editar se crea una versión nueva y la anterior queda consultable.
 */

export type SessionCreateData = Omit<
  Session,
  | 'id'
  | 'linkedAppointmentId'
  | 'createdAt'
  | 'updatedAt'
  | 'archivedAt'
  | 'version'
  | 'previousVersionId'
  | 'isLatest'
>;

export type SessionUpdateData = Pick<
  Session,
  'sessionAt' | 'generalObservations' | 'evolution' | 'treatments'
>;

function isValidLocalDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?$/.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
  );
}

function validateSessionPayload(data: {
  sessionAt: string;
  treatments: Session['treatments'];
}): void {
  if (!isValidLocalDateTime(data.sessionAt)) {
    throw new Error('La fecha de sesión no es válida.');
  }

  for (const treatment of data.treatments) {
    if (
      treatment.timeMinutes !== null &&
      (!Number.isFinite(treatment.timeMinutes) || treatment.timeMinutes < 0)
    ) {
      throw new Error('El tiempo de un tratamiento no es válido.');
    }
  }
}

async function assertAssessmentBelongsToPatient(
  assessmentId: string | null,
  patientId: string
): Promise<void> {
  if (!assessmentId) return;
  const assessment = await db.assessments.get(assessmentId);
  if (!assessment) throw new Error('La ficha vinculada ya no existe.');
  if (assessment.patientId !== patientId) {
    throw new Error('La ficha vinculada pertenece a otro paciente.');
  }
}

export const sessionsService = {
  async getAll({
    patientId,
    includeArchived = false,
    latestOnly = true,
  }: { patientId?: string; includeArchived?: boolean; latestOnly?: boolean } = {}): Promise<Session[]> {
    try {
      let all: Session[];
      if (patientId) {
        all = await db.sessions.where('patientId').equals(patientId).toArray();
      } else {
        all = await db.sessions.toArray();
      }
      if (!includeArchived) all = all.filter((s) => !s.archivedAt);
      if (latestOnly) all = all.filter((s) => s.isLatest);
      return all.sort((a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime());
    } catch (error) {
      throw new Error(`No se pudieron cargar las sesiones: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getById(id: string): Promise<Session | undefined> {
    try {
      return db.sessions.get(id);
    } catch (error) {
      throw new Error(`No se pudo cargar la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async create(data: SessionCreateData): Promise<Session> {
    try {
      validateSessionPayload(data);

      return await db.transaction('rw', db.sessions, db.assessments, async () => {
        await assertAssessmentBelongsToPatient(data.assessmentId, data.patientId);

        const now = new Date().toISOString();
        const record: Session = {
          ...data,
          id: crypto.randomUUID(),
          linkedAppointmentId: null,
          version: 1,
          previousVersionId: null,
          isLatest: true,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };
        await db.sessions.add(record);
        return record;
      });
    } catch (error) {
      throw new Error(`No se pudo crear la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  /**
   * Crea la sesión y completa el turno dentro de una única transacción.
   * Un turno admite una sola sesión lógica: todas las versiones de esa
   * sesión conservan el vínculo, por lo que se comprueba el turno completo.
   */
  async createFromAppointment(
    appointmentId: string,
    data: SessionCreateData
  ): Promise<Session> {
    try {
      validateSessionPayload(data);

      return await db.transaction(
        'rw',
        db.appointments,
        db.sessions,
        db.assessments,
        async () => {
          const appointment = await db.appointments.get(appointmentId);
          if (!appointment) throw new Error('El turno ya no existe.');
          if (appointment.archivedAt) throw new Error('El turno está archivado.');
          if (appointment.patientId !== data.patientId) {
            throw new Error('El turno pertenece a otro paciente.');
          }
          if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed') {
            throw new Error('Este turno ya no está pendiente de registro.');
          }

          const existingSessions = await db.sessions.toArray();
          if (existingSessions.some((session) => session.linkedAppointmentId === appointmentId)) {
            throw new Error('Este turno ya tiene una sesión registrada.');
          }

          await assertAssessmentBelongsToPatient(data.assessmentId, data.patientId);

          const now = new Date().toISOString();
          const record: Session = {
            ...data,
            id: crypto.randomUUID(),
            linkedAppointmentId: appointmentId,
            version: 1,
            previousVersionId: null,
            isLatest: true,
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          };

          await db.sessions.add(record);
          await db.appointments.update(appointmentId, {
            status: 'completed',
            updatedAt: now,
          });

          return record;
        }
      );
    } catch (error) {
      throw new Error(`No se pudo registrar la sesión del turno: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(
    id: string,
    patch: SessionUpdateData,
    expectedVersion: number
  ): Promise<Session> {
    try {
      validateSessionPayload(patch);

      return await db.transaction('rw', db.sessions, async () => {
        const current = await db.sessions.get(id);
        if (!current) throw new Error('La sesión ya no existe.');

        const allSessions = await db.sessions.toArray();
        const chain = getVersionChain(allSessions, id);
        const latest = chain[chain.length - 1];
        if (!current.isLatest || latest.id !== current.id) {
          throw new Error('Sólo se puede editar la versión actual de la sesión.');
        }
        if (current.version !== expectedVersion) {
          throw new Error(
            'La sesión cambió en otra pestaña. Recargá el formulario antes de guardar.'
          );
        }

        const now = new Date().toISOString();
        await db.sessions.update(id, { isLatest: false, updatedAt: now });

        const newRecord: Session = {
          ...current,
          ...patch,
          id: crypto.randomUUID(),
          version: current.version + 1,
          previousVersionId: current.id,
          isLatest: true,
          updatedAt: now,
          createdAt: current.createdAt,
          archivedAt: current.archivedAt,
        };
        await db.sessions.add(newRecord);
        return newRecord;
      });
    } catch (error) {
      throw new Error(`No se pudo actualizar la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async archive(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.sessions.update(id, { archivedAt: now, updatedAt: now });
    } catch (error) {
      throw new Error(`No se pudo archivar la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async restore(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.sessions.update(id, { archivedAt: null, updatedAt: now });
    } catch (error) {
      throw new Error(`No se pudo restaurar la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getVersions(id: string): Promise<Session[]> {
    try {
      const all = await db.sessions.toArray();
      return getVersionChain(all, id).sort((a, b) => b.version - a.version);
    } catch (error) {
      throw new Error(`No se pudieron cargar las versiones: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async duplicate(id: string): Promise<Session> {
    try {
      const current = await db.sessions.get(id);
      if (!current) throw new Error('La sesión ya no existe.');

      const now = new Date().toISOString();
      const record: Session = {
        ...current,
        id: crypto.randomUUID(),
        linkedAppointmentId: null,
        sessionAt: now,
        version: 1,
        previousVersionId: null,
        isLatest: true,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await db.sessions.add(record);
      return record;
    } catch (error) {
      throw new Error(`No se pudo duplicar la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },
};
