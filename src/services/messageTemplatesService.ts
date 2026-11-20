import { db } from '@/db/instance';
import type { MessageTemplate, MessageTemplateCategory } from '@/models';

/**
 * Servicio de plantillas de mensajes de WhatsApp.
 * Incluye seed de plantillas por defecto en español rioplatense en la primera ejecución.
 */

const DEFAULT_TEMPLATES: { name: string; category: MessageTemplateCategory; content: string }[] = [
  {
    name: 'Confirmación de turno',
    category: 'confirmacion_turno',
    content: 'Hola {nombre_propietario}, te confirmamos el turno de {nombre_paciente} para el día {fecha_turno} a las {hora_turno}. ¡Te esperamos en {nombre_clinica}!',
  },
  {
    name: 'Recordatorio de turno',
    category: 'recordatorio_turno',
    content: 'Hola {nombre_propietario}, te recordamos que {nombre_paciente} tiene su sesión de fisioterapia veterinaria el día {fecha_turno} a las {hora_turno}. ¡Te esperamos!',
  },
  {
    name: 'Reprogramación',
    category: 'reprogramacion',
    content: 'Hola {nombre_propietario}, te informamos que el turno de {nombre_paciente} del {fecha_turno} a las {hora_turno} fue reprogramado. Te avisaremos la nueva fecha. Disculpá las molestias.',
  },
  {
    name: 'Cancelación',
    category: 'cancelacion',
    content: 'Hola {nombre_propietario}, te informamos que el turno de {nombre_paciente} del {fecha_turno} a las {hora_turno} fue cancelado. Podés reprogramarlo cuando quieras.',
  },
  {
    name: 'Recordatorio de sesión',
    category: 'recordatorio_sesion',
    content: 'Hola {nombre_propietario}, te recordamos la sesión de fisioterapia de {nombre_paciente}. ¡Nos vemos!',
  },
  {
    name: 'Seguimiento del paciente',
    category: 'seguimiento_paciente',
    content: 'Hola {nombre_propietario}, ¿cómo sigue {nombre_paciente}? Esperamos que la evolución sea positiva. Cualquier consulta, estamos a disposición.',
  },
  {
    name: 'Consulta sobre evolución',
    category: 'consulta_evolucion',
    content: 'Hola {nombre_propietario}, ¿podrías contarnos cómo evoluciona {nombre_paciente} después de la última sesión?',
  },
  {
    name: 'Mensaje personalizado',
    category: 'personalizado',
    content: 'Hola {nombre_propietario}, ',
  },
];

const ORIGINAL_CONTENT: Record<string, string> = Object.fromEntries(
  DEFAULT_TEMPLATES.map((t) => [t.name, t.content])
);

export const messageTemplatesService = {
  async getAll({ category }: { category?: MessageTemplateCategory } = {}): Promise<MessageTemplate[]> {
    try {
      let all = await db.messageTemplates.toArray();
      if (category) all = all.filter((t) => t.category === category);
      return all.filter((t) => !t.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(`No se pudieron cargar las plantillas: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async getById(id: string): Promise<MessageTemplate | undefined> {
    try {
      return db.messageTemplates.get(id);
    } catch (error) {
      throw new Error(`No se pudo cargar la plantilla: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async create(data: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<MessageTemplate> {
    try {
      const now = new Date().toISOString();
      const record: MessageTemplate = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await db.messageTemplates.add(record);
      return record;
    } catch (error) {
      throw new Error(`No se pudo crear la plantilla: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async update(id: string, patch: Partial<Omit<MessageTemplate, 'id' | 'createdAt' | 'archivedAt'>>): Promise<MessageTemplate> {
    try {
      const current = await db.messageTemplates.get(id);
      if (!current) throw new Error('La plantilla ya no existe.');

      const now = new Date().toISOString();
      const updated: MessageTemplate = { ...current, ...patch, updatedAt: now };
      await db.messageTemplates.put(updated);
      return updated;
    } catch (error) {
      throw new Error(`No se pudo actualizar la plantilla: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  async archive(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.messageTemplates.update(id, { archivedAt: now, updatedAt: now });
    } catch (error) {
      throw new Error(`No se pudo archivar la plantilla: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  /** Crea las plantillas por defecto si la tabla está vacía. */
  async seedDefaults(): Promise<void> {
    try {
      const count = await db.messageTemplates.count();
      if (count > 0) return;

      const now = new Date().toISOString();
      const records: MessageTemplate[] = DEFAULT_TEMPLATES.map((t) => ({
        id: crypto.randomUUID(),
        name: t.name,
        category: t.category,
        content: t.content,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }));
      await db.messageTemplates.bulkAdd(records);
    } catch (error) {
      throw new Error(`No se pudieron crear las plantillas por defecto: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  /** Restablece una plantilla a su texto original. */
  async resetToDefault(id: string): Promise<MessageTemplate> {
    try {
      const current = await db.messageTemplates.get(id);
      if (!current) throw new Error('La plantilla ya no existe.');

      const original = ORIGINAL_CONTENT[current.name];
      if (!original) throw new Error('No hay texto original para esta plantilla.');

      const now = new Date().toISOString();
      const updated: MessageTemplate = { ...current, content: original, updatedAt: now };
      await db.messageTemplates.put(updated);
      return updated;
    } catch (error) {
      throw new Error(`No se pudo restablecer la plantilla: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  },

  /** Devuelve el texto original de una plantilla por nombre. */
  getOriginalContent(name: string): string | undefined {
    return ORIGINAL_CONTENT[name];
  },
};
