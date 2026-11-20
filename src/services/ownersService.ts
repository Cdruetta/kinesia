import { db } from '@/db/instance';
import type { Owner } from '@/models';
import { normalizeArgentinePhone } from '@/utils/phones';

// TODO: mover la normalización de teléfono a un helper compartido
export const ownersService = {
  /** Todos los propietarios, opcionalmente incluyendo archivados. */
  async getAll({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<Owner[]> {
    const all = await db.owners.toArray();
    if (includeArchived) return all;
    return all.filter((o) => !o.archivedAt);
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
    const now = new Date().toISOString();
    const record: Owner = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, archivedAt: null };
    await db.owners.add(record);
    return record;
  },

  async update(id: string, patch: Partial<Omit<Owner, 'id' | 'createdAt' | 'archivedAt'>>): Promise<Owner> {
    const current = await db.owners.get(id);
    if (!current) throw new Error('El propietario ya no existe.');

    const now = new Date().toISOString();
    const updated: Owner = { ...current, ...patch, updatedAt: now };
    await db.owners.put(updated);
    return updated;
  },

  /** Archivado lógico. Falla si el propietario tiene pacientes activos. */
  async archive(id: string): Promise<void> {
    const patients = await db.patients.where('ownerId').equals(id).toArray();
    const active = patients.filter((p) => !p.archivedAt);
    if (active.length > 0) {
      const nombres = active.map((p) => p.name).join(', ');
      throw new Error(`No se puede archivar: tiene pacientes activos (${nombres}). Archivalos o transferilos primero.`);
    }
    const now = new Date().toISOString();
    await db.owners.update(id, { archivedAt: now, updatedAt: now });
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
    const all = await this.getAll();
    const normalized = normalizeText(query);
    if (!normalized) return all;

    return all.filter((o) => {
      const name = normalizeText(o.name);
      const phone = normalizeText(o.phone ?? '');
      return name.includes(normalized) || phone.includes(normalized);
    });
  },

  /** Busca un propietario existente por teléfono normalizado (para dup check). */
  async findByNormalizedPhone(normalized: string): Promise<Owner | undefined> {
    const all = await this.getAll();
    return all.find((o) => {
      if (!o.phone) return false;
      const result = normalizeArgentinePhone(o.phone);
      return result.ok && result.international === normalized;
    });
  },
};

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
