import { db } from '@/db/instance';
import type { Communication } from '@/models';

/**
 * Servicio de comunicaciones (historial de WhatsApp).
 * Registra fecha, hora, propietario, paciente, teléfono, tipo, contenido y estado.
 * Estados: prepared (Preparado), opened (WhatsApp abierto), sent (Marcado como enviado manualmente).
 */

export const communicationsService = {
  async getAll({
    ownerId,
    patientId,
    type,
    status,
    startDate,
    endDate,
  }: {
    ownerId?: string;
    patientId?: string;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<Communication[]> {
    try {
      let all = await db.communications.toArray();
      if (ownerId) all = all.filter((c) => c.ownerId === ownerId);
      if (patientId) all = all.filter((c) => c.patientId === patientId);
      if (type) all = all.filter((c) => c.type === type);
      if (status) all = all.filter((c) => c.status === status);
      if (startDate) all = all.filter((c) => new Date(c.createdAt) >= startDate);
      if (endDate) all = all.filter((c) => new Date(c.createdAt) <= endDate);
      return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      throw new Error(`No se pudieron cargar las comunicaciones: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getById(id: string): Promise<Communication | undefined> {
    try {
      return db.communications.get(id);
    } catch (error) {
      throw new Error(`No se pudo cargar la comunicación: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async create(data: Omit<Communication, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<Communication> {
    try {
      const now = new Date().toISOString();
      const record: Communication = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await db.communications.add(record);
      return record;
    } catch (error) {
      throw new Error(`No se pudo registrar la comunicación: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(id: string, patch: Partial<Omit<Communication, 'id' | 'createdAt' | 'archivedAt'>>): Promise<Communication> {
    try {
      const current = await db.communications.get(id);
      if (!current) throw new Error('La comunicación ya no existe.');

      const now = new Date().toISOString();
      const updated: Communication = { ...current, ...patch, updatedAt: now };
      await db.communications.put(updated);
      return updated;
    } catch (error) {
      throw new Error(`No se pudo actualizar la comunicación: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async markAsSent(id: string): Promise<Communication> {
    return this.update(id, { status: 'sent' });
  },

  async archive(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.communications.update(id, { archivedAt: now, updatedAt: now });
    } catch (error) {
      throw new Error(`No se pudo archivar la comunicación: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },
};
