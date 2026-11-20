import { db } from '@/db/instance';
import type { Assessment } from '@/models';

/**
 * Servicio de fichas fisiátricas (evaluaciones).
 * CRUD con versionado: al editar se crea una versión nueva y la anterior queda consultable.
 */

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

  async create(data: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'version' | 'previousVersionId' | 'isLatest'>): Promise<Assessment> {
    try {
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
    } catch (error) {
      throw new Error(`No se pudo crear la ficha: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(id: string, patch: Partial<Omit<Assessment, 'id' | 'createdAt' | 'archivedAt' | 'version' | 'previousVersionId' | 'isLatest'>>): Promise<Assessment> {
    try {
      const current = await db.assessments.get(id);
      if (!current) throw new Error('La ficha ya no existe.');

      // Marcar la versión anterior como no-latest
      await db.assessments.update(id, { isLatest: false });

      const now = new Date().toISOString();
      const newRecord: Assessment = {
        ...current,
        ...patch,
        id: crypto.randomUUID(),
        version: current.version + 1,
        previousVersionId: current.id,
        isLatest: true,
        updatedAt: now,
        createdAt: current.createdAt,
        archivedAt: null,
      };
      await db.assessments.add(newRecord);
      return newRecord;
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
      const current = await db.assessments.get(id);
      if (!current) return [];

      // Encontrar el root de la cadena
      let rootId = id;
      let cur = current;
      while (cur.previousVersionId) {
        const prev = await db.assessments.get(cur.previousVersionId);
        if (!prev) break;
        cur = prev;
        rootId = prev.id;
      }

      // Buscar todos los que pertenecen a la misma cadena
      const all = await db.assessments.where('patientId').equals(current.patientId).toArray();
      return all
        .filter((a) => {
          let r = a;
          while (r.previousVersionId) {
            const prev = all.find((x) => x.id === r.previousVersionId);
            if (!prev) break;
            r = prev;
          }
          return r.id === rootId;
        })
        .sort((a, b) => b.version - a.version);
    } catch (error) {
      throw new Error(`No se pudieron cargar las versiones: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },
};

// (tipos importados desde @/models)
