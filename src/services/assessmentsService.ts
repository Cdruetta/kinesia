import { db } from '@/db/instance';
import type { Assessment } from '@/models';
import { fromLocalDateInput } from '@/utils/dates';
import { getVersionChain } from '@/utils/versioning';

/**
 * Servicio de fichas fisiátricas (evaluaciones).
 * CRUD con versionado: al editar se crea una versión nueva y la anterior queda consultable.
 */

export type AssessmentCreateData = Omit<
  Assessment,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'version' | 'previousVersionId' | 'isLatest'
>;

export type AssessmentUpdateData = Omit<AssessmentCreateData, 'patientId'>;

function validateAssessmentPayload(data: { assessedAt: string }): void {
  if (!fromLocalDateInput(data.assessedAt)) {
    throw new Error('La fecha de evaluación no es válida.');
  }
}

export const assessmentsService = {
  async getAll({
    patientId,
    includeArchived = false,
    latestOnly = true,
  }: { patientId?: string; includeArchived?: boolean; latestOnly?: boolean } = {}): Promise<Assessment[]> {
    try {
      let all: Assessment[];
      if (patientId) {
        all = await db.assessments.where('patientId').equals(patientId).toArray();
      } else {
        all = await db.assessments.toArray();
      }
      if (!includeArchived) all = all.filter((a) => !a.archivedAt);
      if (latestOnly) all = all.filter((a) => a.isLatest);
      return all.sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
    } catch (error) {
      throw new Error(`No se pudieron cargar las fichas: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getById(id: string): Promise<Assessment | undefined> {
    try {
      return db.assessments.get(id);
    } catch (error) {
      throw new Error(`No se pudo cargar la ficha: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async create(data: AssessmentCreateData): Promise<Assessment> {
    try {
      validateAssessmentPayload(data);

      return await db.transaction('rw', db.assessments, db.patients, async () => {
        const patient = await db.patients.get(data.patientId);
        if (!patient) throw new Error('El paciente ya no existe.');

        const now = new Date().toISOString();
        const record: Assessment = {
          ...data,
          id: crypto.randomUUID(),
          version: 1,
          previousVersionId: null,
          isLatest: true,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        };
        await db.assessments.add(record);
        return record;
      });
    } catch (error) {
      throw new Error(`No se pudo crear la ficha: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(
    id: string,
    patch: AssessmentUpdateData,
    expectedVersion: number
  ): Promise<Assessment> {
    try {
      validateAssessmentPayload(patch);

      return await db.transaction('rw', db.assessments, async () => {
        const current = await db.assessments.get(id);
        if (!current) throw new Error('La ficha ya no existe.');

        const allAssessments = await db.assessments.toArray();
        const chain = getVersionChain(allAssessments, id);
        const latest = chain[chain.length - 1];
        if (!current.isLatest || latest.id !== current.id) {
          throw new Error('Sólo se puede editar la versión actual de la ficha.');
        }
        if (current.version !== expectedVersion) {
          throw new Error(
            'La ficha cambió en otra pestaña. Recargá el formulario antes de guardar.'
          );
        }

        const now = new Date().toISOString();
        await db.assessments.update(id, { isLatest: false, updatedAt: now });

        const newRecord: Assessment = {
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
        await db.assessments.add(newRecord);
        return newRecord;
      });
    } catch (error) {
      throw new Error(`No se pudo actualizar la ficha: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async archive(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.assessments.update(id, { archivedAt: now, updatedAt: now });
    } catch (error) {
      throw new Error(`No se pudo archivar la ficha: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async restore(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.assessments.update(id, { archivedAt: null, updatedAt: now });
    } catch (error) {
      throw new Error(`No se pudo restaurar la ficha: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getVersions(id: string): Promise<Assessment[]> {
    try {
      const all = await db.assessments.toArray();
      return getVersionChain(all, id).sort((a, b) => b.version - a.version);
    } catch (error) {
      throw new Error(`No se pudieron cargar las versiones: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },
};
