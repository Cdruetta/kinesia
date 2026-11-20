import { db } from '@/db/instance';
import type { Session } from '@/models';

/**
 * Servicio de sesiones y tratamientos.
 * CRUD con versionado: al editar se crea una versión nueva y la anterior queda consultable.
 */

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

  async create(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'version' | 'previousVersionId' | 'isLatest'>): Promise<Session> {
    try {
      const now = new Date().toISOString();
      const record: Session = {
        ...data,
        id: crypto.randomUUID(),
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
      throw new Error(`No se pudo crear la sesión: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(id: string, patch: Partial<Omit<Session, 'id' | 'createdAt' | 'archivedAt' | 'version' | 'previousVersionId' | 'isLatest'>>): Promise<Session> {
    try {
      const current = await db.sessions.get(id);
      if (!current) throw new Error('La sesión ya no existe.');

      await db.sessions.update(id, { isLatest: false });

      const now = new Date().toISOString();
      const newRecord: Session = {
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
      await db.sessions.add(newRecord);
      return newRecord;
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
      const current = await db.sessions.get(id);
      if (!current) return [];

      let rootId = id;
      let cur = current;
      while (cur.previousVersionId) {
        const prev = await db.sessions.get(cur.previousVersionId);
        if (!prev) break;
        cur = prev;
        rootId = prev.id;
      }

      const all = await db.sessions.where('patientId').equals(current.patientId).toArray();
      return all
        .filter((s) => {
          let r = s;
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

  async duplicate(id: string): Promise<Session> {
    try {
      const current = await db.sessions.get(id);
      if (!current) throw new Error('La sesión ya no existe.');

      const now = new Date().toISOString();
      const record: Session = {
        ...current,
        id: crypto.randomUUID(),
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
