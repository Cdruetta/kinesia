import { db } from '@/db/instance';
import type { Owner } from '@/models';
import { normalizeArgentinePhone } from '@/utils/phones';

/**
 * Servicio de propietarios.
 * CRUD, archivado lógico, búsqueda y detección de teléfonos duplicados.
 * Los componentes no acceden a Dexie directamente.
 */

export const ownersService = {
  /** Todos los propietarios, opcionalmente incluyendo archivados. */
  async getAll({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<Owner[]> {
    try {
      const all = await db.owners.toArray();
      return includeArchived
        ? all
        : all.filter((o) => !o.archivedAt);
    } catch (error) {
      throw new Error(
        `No se pudieron cargar los propietarios: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async getById(id: string): Promise<Owner | undefined> {
    try {
      return db.owners.get(id);
    } catch (error) {
      throw new Error(
        `No se pudo cargar el propietario: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async create(data: Omit<Owner, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<Owner> {
    try {
      const now = new Date().toISOString();
      const record: Owner = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await db.owners.add(record);
      return record;
    } catch (error) {
      throw new Error(
        `No se pudo crear el propietario: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async update(
    id: string,
    patch: Partial<Omit<Owner, 'id' | 'createdAt' | 'archivedAt'>>
  ): Promise<Owner> {
    try {
      const current = await db.owners.get(id);
      if (!current) throw new Error('El propietario ya no existe.');

      const now = new Date().toISOString();
      const updated: Owner = { ...current, ...patch, updatedAt: now };
      await db.owners.put(updated);
      return updated;
    } catch (error) {
      throw new Error(
        `No se pudo actualizar el propietario: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  /** Archivado lógico. Falla si el propietario tiene pacientes activos. */
  async archive(id: string): Promise<void> {
    try {
      const patients = await db.patients.where('ownerId').equals(id).toArray();
      const active = patients.filter((p) => !p.archivedAt);
      if (active.length > 0) {
        const nombres = active.map((p) => p.name).join(', ');
        throw new Error(
          `No se puede archivar: tiene pacientes activos (${nombres}). Archivá o trasferí esos pacientes primero.`
        );
      }
      const now = new Date().toISOString();
      await db.owners.update(id, { archivedAt: now, updatedAt: now });
    } catch (error) {
      if (error instanceof Error && error.message.includes('No se puede archivar')) {
        throw error;
      }
      throw new Error(
        `No se pudo archivar el propietario: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  async restore(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.owners.update(id, { archivedAt: null, updatedAt: now });
    } catch (error) {
      throw new Error(
        `No se pudo restaurar el propietario: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  /** Busca por nombre o teléfono, ignorando acentos y mayúsculas. */
  async search(query: string): Promise<Owner[]> {
    try {
      const all = await this.getAll();
      const normalized = normalizeText(query);
      if (!normalized) return all;

      return all.filter((o) => {
        const name = normalizeText(o.name);
        const phone = normalizeText(o.phone ?? '');
        return name.includes(normalized) || phone.includes(normalized);
      });
    } catch (error) {
      throw new Error(
        `No se pudo buscar propietarios: ${error instanceof Error ? error.message : String(error)}`
      , { cause: error } );
    }
  },

  /** Busca un propietario existente por teléfono normalizado (para dup check). */
  async findByNormalizedPhone(normalized: string): Promise<Owner | undefined> {
    try {
      const all = await this.getAll();
      return all.find((o) => {
        if (!o.phone) return false;
        const result = normalizeArgentinePhone(o.phone);
        return result.ok && result.international === normalized;
      });
    } catch {
      return undefined;
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
