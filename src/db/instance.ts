import Dexie, { type Table } from 'dexie';
import {
  SCHEMA_VERSION,
  type Owner,
  type Patient,
  type Appointment,
  type Assessment,
  type Session,
  type Communication,
  type MessageTemplate,
  type Settings,
} from './schema';

/**
 * Instancia de Dexie. Es la única puerta de entrada a IndexedDB.
 * Los componentes NO acceden a Dexie directamente: lo hacen a través de
 * los servicios de src/services.
 */
export class KinesiaDB extends Dexie {
  owners!: Table<Owner, string>;
  patients!: Table<Patient, string>;
  appointments!: Table<Appointment, string>;
  assessments!: Table<Assessment, string>;
  sessions!: Table<Session, string>;
  communications!: Table<Communication, string>;
  messageTemplates!: Table<MessageTemplate, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('kinesia');

    this.version(SCHEMA_VERSION).stores({
      owners: 'id, &name, phone, createdAt, updatedAt, archivedAt',
      patients: 'id, ownerId, name, species, birthDate, createdAt, updatedAt, archivedAt',
      appointments:
        'id, patientId, ownerId, startsAt, status, durationMinutes, createdAt, updatedAt, archivedAt',
      assessments: 'id, patientId, title, assessedAt, createdAt, updatedAt, archivedAt',
      sessions: 'id, patientId, assessmentId, sessionAt, createdAt, updatedAt, archivedAt',
      communications: 'id, type, direction, contact, status, createdAt, updatedAt, archivedAt',
      messageTemplates: 'id, name, createdAt, updatedAt, archivedAt',
      settings: 'id, createdAt, updatedAt, archivedAt',
    });
  }
}

export const db = new KinesiaDB();

/** Nombre de la base de datos, útil para mensajes de error y depuración. */
export const DB_NAME = 'kinesia';

/**
 * Errores de almacenamiento con mensajes comprensibles para el usuario.
 */
export class StorageError extends Error {
  readonly code: 'quota' | 'blocked' | 'unsupported' | 'unknown';
  constructor(code: 'quota' | 'blocked' | 'unsupported' | 'unknown', message: string) {
    super(message);
    this.code = code;
    this.name = 'StorageError';
  }
}

/**
 * Detecta si el navegador soporta IndexedDB (falló en modo privado de
 * algunos navegadores) y solicita almacenamiento persistente.
 * Devuelve true si la persistencia fue concedida (o ya lo estaba).
 */
export async function ensureStorage(): Promise<{ supported: boolean; persistent: boolean }> {
  const supported = typeof indexedDB !== 'undefined';

  if (!supported) {
    return { supported: false, persistent: false };
  }

  let persistent: boolean;
  try {
    const persisted = await navigator.storage.persist();
    persistent = typeof persisted === 'boolean' ? persisted : false;
  } catch {
    persistent = false;
  }

  return { supported: true, persistent };
}

export type StorageState = Awaited<ReturnType<typeof ensureStorage>>;
