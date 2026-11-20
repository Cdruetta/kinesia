import { db } from '@/db/instance';
import type { Patient } from '@/models';

/**
 * Servicio de pacientes.
 * CRUD, archivado lógico y búsqueda.
 */

export const patientsService = {
  async getAll({
    includeArchived = false,
    ownerId,
  }: { includeArchived?: boolean; ownerId?: string } = {}): Promise<Patient[]> {
    try {
      let all: Patient[];
      if (ownerId) {
        all = await db.patients.where('ownerId').equals(ownerId).toArray();
      } else {
        all = await db.patients.toArray();
      }
      return includeArchived ? all : all.filter((p) => !p.archivedAt);
    } catch (error) {
      throw new Error(
        `No se pudieron cargar los pacientes: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async getById(id: string): Promise<Patient | undefined> {
    try {
      return db.patients.get(id);
    } catch (error) {
      throw new Error(
        `No se pudo cargar el paciente: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async create(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<Patient> {
    try {
      const now = new Date().toISOString();
      const record: Patient = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await db.patients.add(record);
      return record;
    } catch (error) {
      throw new Error(
        `No se pudo crear el paciente: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async update(
    id: string,
    patch: Partial<Omit<Patient, 'id' | 'createdAt' | 'archivedAt'>>
  ): Promise<Patient> {
    try {
      const current = await db.patients.get(id);
      if (!current) throw new Error('El paciente ya no existe.');

      const now = new Date().toISOString();
      const updated: Patient = { ...current, ...patch, updatedAt: now };
      await db.patients.put(updated);
      return updated;
    } catch (error) {
      throw new Error(
        `No se pudo actualizar el paciente: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async archive(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.patients.update(id, { archivedAt: now, updatedAt: now });
    } catch (error) {
      throw new Error(
        `No se pudo archivar el paciente: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async restore(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.patients.update(id, { archivedAt: null, updatedAt: now });
    } catch (error) {
      throw new Error(
        `No se pudo restaurar el paciente: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async search(query: string): Promise<Patient[]> {
    try {
      const all = await this.getAll();
      const normalized = normalizeText(query);
      if (!normalized) return all;

      return all.filter((p) => {
        const name = normalizeText(p.name);
        const species = normalizeText(p.species);
        const breed = normalizeText(p.breed ?? '');
        return name.includes(normalized) || species.includes(normalized) || breed.includes(normalized);
      });
    } catch (error) {
      throw new Error(
        `No se pudo buscar pacientes: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },
};

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
