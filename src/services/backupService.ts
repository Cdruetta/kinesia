import { db } from '@/db/instance';
import { migrateLegacyTable } from '@/db/migrations';
import { z } from 'zod';
import { fromLocalDateInput, toLocalDateInput } from '@/utils/dates';
import { licenseService } from '@/services/licenseService';
import {
  assertBackupWithinDemoLimits,
  validateLicenseInTransaction,
  type LicenseValidator,
  type ValidatedLicense,
} from '@/services/licenseLimitsService';
import { DEFAULT_SETTINGS } from '@/models';
import type {
  Appointment,
  Assessment,
  Communication,
  MessageTemplate,
  Owner,
  Patient,
  Session,
  Settings,
} from '@/models';

/**
 * Servicio de respaldos (exportar/importar todos los registros en JSON).
 * Incluye schemaVersion, fecha de exportación y todas las tablas (incluyendo archivados y versiones anteriores).
 */

const TABLES = [
  'owners',
  'patients',
  'appointments',
  'assessments',
  'sessions',
  'communications',
  'messageTemplates',
  'settings',
] as const;

export type BackupTable = (typeof TABLES)[number];

export const SCHEMA_VERSION_EXPORT = 2;

const MAX_APPOINTMENT_DURATION_MINUTES = 480;

const nullableStringSchema = z.string().nullable();
const flexibleObjectSchema = z.custom<object>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  { message: 'Se esperaba un objeto.' }
);

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

function isValidClockTime(hours: number, minutes: number, seconds: number): boolean {
  return hours <= 23 && minutes <= 59 && seconds <= 59;
}

/** Valida una fecha local YYYY-MM-DD usando el mismo criterio que la agenda. */
function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  return fromLocalDateInput(value) !== null;
}

/**
 * Valida una fecha/hora local sin zona horaria. El formato coincide con
 * `toLocalISO`: YYYY-MM-DDTHH:mm:ss.
 */
function isValidLocalDateTime(value: string): boolean {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return false;
  if (!isValidLocalDate(`${match[1]}-${match[2]}-${match[3]}`)) return false;
  return isValidClockTime(Number(match[4]), Number(match[5]), Number(match[6]));
}

/** Valida un timestamp ISO con zona horaria y una fecha calendario real. */
function isValidIsoTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  if (!isValidLocalDate(`${match[1]}-${match[2]}-${match[3]}`)) return false;
  if (!isValidClockTime(Number(match[4]), Number(match[5]), Number(match[6]))) return false;

  if (match[7] !== 'Z') {
    const offsetHours = Number(match[8]);
    const offsetMinutes = Number(match[9]);
    if (offsetHours > 23 || offsetMinutes > 59) return false;
  }

  return true;
}

const timestampSchema = z.string().refine(isValidIsoTimestamp, {
  error:
    'Debe ser un timestamp ISO válido con zona horaria (por ejemplo, 2026-11-20T12:00:00.000Z).',
});
const nullableTimestampSchema = timestampSchema.nullable();
const localDateSchema = z.string().refine(isValidLocalDate, {
  error: 'Debe ser una fecha local válida en formato YYYY-MM-DD.',
});
const nullableLocalDateSchema = localDateSchema.nullable();
const localDateTimeSchema = z.string().refine(isValidLocalDateTime, {
  error:
    'Debe ser una fecha y hora local válida en formato YYYY-MM-DDTHH:mm:ss, sin zona horaria.',
});
const nullableLocalDateTimeSchema = localDateTimeSchema.nullable();

const treatmentSchema = z.object({
  treatmentType: z.enum([
    'magnetoterapia',
    'laser',
    'fotobiomodulacion',
    'tens',
    'electroestimulacion',
    'ultrasonido',
    'ozonoterapia',
  ]),
  applied: z.boolean(),
  zone: nullableStringSchema,
  intensity: nullableStringSchema,
  intensityUnit: nullableStringSchema,
  timeMinutes: z.number().nullable(),
  dose: nullableStringSchema,
  frequency: nullableStringSchema,
  additionalParams: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ),
  observations: nullableStringSchema,
});

const ownerRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: nullableStringSchema,
  email: nullableStringSchema,
  address: nullableStringSchema,
  notes: nullableStringSchema,
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const patientRecordSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  species: z.string().min(1),
  breed: nullableStringSchema,
  sex: z.enum(['macho', 'hembra', 'otro']).nullable(),
  birthDate: nullableLocalDateSchema,
  birthDateApproximate: z.boolean(),
  notes: nullableStringSchema,
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const appointmentRecordSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  ownerId: nullableStringSchema,
  startsAt: localDateTimeSchema,
  durationMinutes: z
    .number({ error: 'Debe ser un número de minutos.' })
    .int('Debe ser un número entero de minutos.')
    .positive('La duración del turno debe ser positiva.')
    .max(
      MAX_APPOINTMENT_DURATION_MINUTES,
      `La duración del turno no puede superar ${MAX_APPOINTMENT_DURATION_MINUTES} minutos.`
    ),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show']),
  reason: nullableStringSchema,
  notes: nullableStringSchema,
  rescheduledFrom: nullableStringSchema,
  previousStartsAt: nullableLocalDateTimeSchema,
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const assessmentRecordSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  title: z.string().min(1),
  assessedAt: localDateSchema,
  ownerSnapshot: flexibleObjectSchema.nullable(),
  patientSnapshot: flexibleObjectSchema.nullable(),
  referredBy: nullableStringSchema,
  reason: nullableStringSchema,
  diagnosis: nullableStringSchema,
  studies: nullableStringSchema,
  complements: nullableStringSchema,
  medicalTreatments: nullableStringSchema,
  additionalObservations: nullableStringSchema,
  version: z.number().int().positive(),
  previousVersionId: nullableStringSchema,
  isLatest: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const sessionRecordSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  assessmentId: nullableStringSchema,
  linkedAppointmentId: nullableStringSchema,
  sessionAt: localDateTimeSchema,
  generalObservations: nullableStringSchema,
  evolution: nullableStringSchema,
  treatments: z.array(treatmentSchema),
  version: z.number().int().positive(),
  previousVersionId: nullableStringSchema,
  isLatest: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const communicationRecordSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['whatsapp', 'call', 'email']),
  direction: z.enum(['inbound', 'outbound']),
  contact: z.string(),
  message: nullableStringSchema,
  status: z.enum(['prepared', 'opened', 'sent']),
  patientId: nullableStringSchema,
  ownerId: nullableStringSchema,
  templateId: nullableStringSchema,
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const messageTemplateRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    'confirmacion_turno',
    'recordatorio_turno',
    'reprogramacion',
    'cancelacion',
    'recordatorio_sesion',
    'seguimiento_paciente',
    'consulta_evolucion',
    'personalizado',
  ]),
  content: z.string(),
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const settingsRecordSchema = z.object({
  id: z.literal('settings'),
  clinicName: z.string(),
  logo: nullableStringSchema,
  address: nullableStringSchema,
  phone: nullableStringSchema,
  whatsapp: nullableStringSchema,
  email: nullableStringSchema,
  hours: nullableStringSchema,
  defaultAppointmentDuration: z.number().int().positive(),
  printLogo: z.boolean(),
  printFooter: z.boolean(),
  followUpDays: z.number().int().nonnegative(),
  theme: z.enum(['light', 'dark', 'system']),
  isLicensed: z.boolean(),
  licenseKey: nullableStringSchema,
  pinEnabled: z.boolean(),
  pinHash: nullableStringSchema,
  pinSalt: nullableStringSchema,
  pinAttempts: z.number().int().nonnegative(),
  pinLockedUntil: nullableTimestampSchema,
  autoLockMinutes: z.number().int().nonnegative(),
  lastBackupDate: nullableTimestampSchema,
  backupReminderDays: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
});

const TABLE_SCHEMAS: Record<BackupTable, z.ZodType> = {
  owners: z.array(ownerRecordSchema),
  patients: z.array(patientRecordSchema),
  appointments: z.array(appointmentRecordSchema),
  assessments: z.array(assessmentRecordSchema),
  sessions: z.array(sessionRecordSchema),
  communications: z.array(communicationRecordSchema),
  messageTemplates: z.array(messageTemplateRecordSchema),
  settings: z.array(settingsRecordSchema),
};

const backupSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: timestampSchema,
  data: z.object({
    owners: z.array(z.unknown()),
    patients: z.array(z.unknown()),
    appointments: z.array(z.unknown()),
    assessments: z.array(z.unknown()),
    sessions: z.array(z.unknown()),
    communications: z.array(z.unknown()),
    messageTemplates: z.array(z.unknown()),
    settings: z.array(z.unknown()),
  }),
});

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  data: { [T in BackupTable]: unknown[] };
}

export interface BackupValidation {
  valid: boolean;
  error?: string;
  data?: BackupData;
  summary?: Record<string, number>;
}

type LegacyRecord = Record<string, unknown>;

interface LegacyVersionDefaults {
  missingVersion: Set<number>;
  missingLatest: Set<number>;
}

function asLegacyRecord(value: unknown): LegacyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as LegacyRecord)
    : {};
}

function captureMissingField(records: unknown[], field: string): Set<number> {
  const missing = new Set<number>();
  records.forEach((value, index) => {
    if (asLegacyRecord(value)[field] === undefined) missing.add(index);
  });
  return missing;
}

function captureVersionDefaults(records: unknown[]): LegacyVersionDefaults {
  return {
    missingVersion: captureMissingField(records, 'version'),
    missingLatest: captureMissingField(records, 'isLatest'),
  };
}

function applyVersionDefaults(records: unknown[], defaults: LegacyVersionDefaults): void {
  const indexById = new Map<string, number>();
  records.forEach((value, index) => {
    const id = asLegacyRecord(value).id;
    if (typeof id === 'string' && !indexById.has(id)) indexById.set(id, index);
  });

  const resolving = new Set<number>();
  const resolveVersion = (index: number): number | null => {
    const record = asLegacyRecord(records[index]);
    if (!defaults.missingVersion.has(index)) {
      return typeof record.version === 'number' ? record.version : null;
    }

    if (resolving.has(index)) return null;
    resolving.add(index);

    let version = 1;
    if (typeof record.previousVersionId === 'string') {
      const previousIndex = indexById.get(record.previousVersionId);
      if (previousIndex !== undefined) {
        const previousVersion = resolveVersion(previousIndex);
        if (previousVersion !== null) version = previousVersion + 1;
      }
    }

    resolving.delete(index);
    record.version = version;
    return version;
  };

  for (const index of defaults.missingVersion) resolveVersion(index);

  const referencedIds = new Set<string>();
  for (const value of records) {
    const previousVersionId = asLegacyRecord(value).previousVersionId;
    if (typeof previousVersionId === 'string') referencedIds.add(previousVersionId);
  }

  for (const index of defaults.missingLatest) {
    const record = asLegacyRecord(records[index]);
    const id = typeof record.id === 'string' ? record.id : '';
    record.isLatest = !referencedIds.has(id);
  }
}

function localDatePart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.slice(0, 10);
  return isValidLocalDate(candidate) ? candidate : null;
}

function applyClinicalDateDefaults(
  backup: BackupData,
  missingAssessmentDates: Set<number>,
  missingSessionDates: Set<number>
): void {
  const assessments = backup.data.assessments;
  for (const index of missingAssessmentDates) {
    const record = asLegacyRecord(assessments[index]);
    const date = localDatePart(record.assessedAt);
    if (date) record.assessedAt = date;
  }

  const sessions = backup.data.sessions;
  for (const index of missingSessionDates) {
    const record = asLegacyRecord(sessions[index]);
    const date = localDatePart(record.sessionAt);
    if (date) record.sessionAt = `${date}T00:00:00`;
  }
}

function applyRescheduleDefaults(
  backup: BackupData,
  missingPreviousStartsAt: Set<number>
): void {
  const appointments = backup.data.appointments;
  const appointmentsById = new Map<string, LegacyRecord>();
  for (const value of appointments) {
    const record = asLegacyRecord(value);
    if (typeof record.id === 'string') appointmentsById.set(record.id, record);
  }

  for (const index of missingPreviousStartsAt) {
    const record = asLegacyRecord(appointments[index]);
    if (typeof record.rescheduledFrom !== 'string') continue;
    const original = appointmentsById.get(record.rescheduledFrom);
    if (original && typeof original.startsAt === 'string') {
      record.previousStartsAt = original.startsAt;
    }
  }
}

function migrateBackupData(backup: BackupData): void {
  const assessmentVersionDefaults = captureVersionDefaults(backup.data.assessments);
  const sessionVersionDefaults = captureVersionDefaults(backup.data.sessions);
  const missingAssessmentDates = captureMissingField(backup.data.assessments, 'assessedAt');
  const missingSessionDates = captureMissingField(backup.data.sessions, 'sessionAt');
  const missingPreviousStartsAt = captureMissingField(
    backup.data.appointments,
    'previousStartsAt'
  );

  for (const table of TABLES) {
    backup.data[table] = migrateLegacyTable(table, backup.data[table]);
  }

  applyVersionDefaults(backup.data.assessments, assessmentVersionDefaults);
  applyVersionDefaults(backup.data.sessions, sessionVersionDefaults);
  applyClinicalDateDefaults(backup, missingAssessmentDates, missingSessionDates);
  applyRescheduleDefaults(backup, missingPreviousStartsAt);
}

function recordsById(table: BackupTable, backup: BackupData): Map<string, Record<string, unknown>> {
  const records = backup.data[table] as Array<Record<string, unknown>>;
  return new Map(records.map((record) => [String(record.id), record]));
}

interface ClinicalVersionRecord {
  id: string;
  patientId: string;
  version: number;
  previousVersionId: string | null;
  isLatest: boolean;
}

interface ClinicalVersionValidation {
  error: string | null;
  rootById: Map<string, string>;
}

function validateClinicalVersioning(
  table: 'assessments' | 'sessions',
  backup: BackupData
): ClinicalVersionValidation {
  const entity = table === 'assessments' ? 'ficha' : 'sesión';
  const entities = table === 'assessments' ? 'fichas' : 'sesiones';
  const records = backup.data[table] as unknown as ClinicalVersionRecord[];
  const byId = new Map(records.map((record) => [record.id, record]));
  const rootById = new Map<string, string>();

  for (const record of records) {
    if (record.previousVersionId === null) continue;
    const previous = byId.get(record.previousVersionId);
    if (!previous) {
      return {
        error: `La ${entity} "${record.id}" referencia una versión anterior que no existe.`,
        rootById,
      };
    }
    if (previous.patientId !== record.patientId) {
      return {
        error: `La ${entity} "${record.id}" referencia una versión anterior de otro paciente.`,
        rootById,
      };
    }
  }

  for (const record of records) {
    const visited = new Set<string>();
    let current = record;
    while (current.previousVersionId !== null) {
      if (visited.has(current.id)) {
        return {
          error: `El versionado de ${entities} contiene un ciclo de versiones.`,
          rootById,
        };
      }
      visited.add(current.id);
      const previous = byId.get(current.previousVersionId);
      if (!previous) break;
      current = previous;
    }
  }

  for (const record of records) {
    if (record.previousVersionId === null) {
      if (record.version !== 1) {
        return {
          error: `La ${entity} "${record.id}" inicia una cadena lógica con la versión 1.`,
          rootById,
        };
      }
      continue;
    }

    const previous = byId.get(record.previousVersionId);
    if (previous && record.version !== previous.version + 1) {
      return {
        error: `La ${entity} "${record.id}" debe incrementar exactamente una versión respecto de su versión anterior.`,
        rootById,
      };
    }
  }

  for (const record of records) {
    let root = record;
    while (root.previousVersionId !== null) {
      const previous = byId.get(root.previousVersionId);
      if (!previous) break;
      root = previous;
    }
    rootById.set(record.id, root.id);
  }

  const chains = new Map<string, ClinicalVersionRecord[]>();
  for (const record of records) {
    const rootId = rootById.get(record.id) ?? record.id;
    const chain = chains.get(rootId) ?? [];
    chain.push(record);
    chains.set(rootId, chain);
  }

  for (const [rootId, chain] of chains) {
    const latestRecords = chain.filter((record) => record.isLatest);
    if (latestRecords.length !== 1) {
      return {
        error: `La cadena lógica de ${entities} "${rootId}" debe tener exactamente una versión latest (la última); encontró ${latestRecords.length}.`,
        rootById,
      };
    }

    const referencedIds = new Set(
      chain
        .map((record) => record.previousVersionId)
        .filter((id): id is string => id !== null)
    );
    const terminalRecords = chain.filter((record) => !referencedIds.has(record.id));
    if (terminalRecords.length !== 1) {
      return {
        error: `La cadena lógica de ${entities} "${rootId}" debe ser lineal y tener una sola versión final.`,
        rootById,
      };
    }
    if (latestRecords[0].id !== terminalRecords[0].id) {
      return {
        error: `La versión latest de la cadena lógica de ${entities} "${rootId}" debe ser su versión final.`,
        rootById,
      };
    }
  }

  return { error: null, rootById };
}

function validateRelationships(backup: BackupData): string | null {
  const ownersById = recordsById('owners', backup);
  const patientsById = recordsById('patients', backup);
  const appointmentsById = recordsById('appointments', backup);
  const assessmentsById = recordsById('assessments', backup);
  const templatesById = recordsById('messageTemplates', backup);

  for (const patient of backup.data.patients as Array<Record<string, unknown>>) {
    if (!ownersById.has(String(patient.ownerId))) {
      return 'El respaldo contiene un paciente sin su propietario.';
    }
  }

  for (const appointment of backup.data.appointments as Array<Record<string, unknown>>) {
    if (!patientsById.has(String(appointment.patientId))) {
      return 'El respaldo contiene un turno sin su paciente.';
    }
    if (appointment.ownerId !== null && !ownersById.has(String(appointment.ownerId))) {
      return 'El respaldo contiene un turno cuyo propietario no existe.';
    }

    if (appointment.rescheduledFrom !== null) {
      const original = appointmentsById.get(String(appointment.rescheduledFrom));
      if (!original) {
        return `El turno "${appointment.id}" referencia un turno anterior que no existe.`;
      }
      // La interfaz permite corregir el paciente al reprogramar. El vínculo
      // válido es al turno original y a su horario anterior; el paciente del
      // reemplazo puede cambiar legítimamente.
      if (appointment.previousStartsAt === null) {
        return `El turno "${appointment.id}" no conserva la fecha anterior de reprogramación.`;
      }
      if (appointment.previousStartsAt !== original.startsAt) {
        return `La fecha anterior del turno "${appointment.id}" no coincide con el turno de origen.`;
      }
    } else if (appointment.previousStartsAt !== null) {
      return `El turno "${appointment.id}" tiene una fecha anterior de reprogramación sin un turno de origen.`;
    }
  }

  for (const appointment of backup.data.appointments as Array<Record<string, unknown>>) {
    const visited = new Set<string>();
    let current = appointment;
    while (current.rescheduledFrom !== null) {
      if (visited.has(String(current.id))) {
        return 'El respaldo contiene un ciclo de reprogramación de turnos.';
      }
      visited.add(String(current.id));
      const original = appointmentsById.get(String(current.rescheduledFrom));
      if (!original) break;
      current = original;
    }
  }

  for (const assessment of backup.data.assessments as Array<Record<string, unknown>>) {
    if (!patientsById.has(String(assessment.patientId))) {
      return 'El respaldo contiene una ficha sin su paciente.';
    }
  }

  const assessmentVersions = validateClinicalVersioning('assessments', backup);
  if (assessmentVersions.error) return assessmentVersions.error;

  const sessionVersions = validateClinicalVersioning('sessions', backup);
  if (sessionVersions.error) return sessionVersions.error;

  const logicalSessionByAppointment = new Map<string, string>();
  for (const session of backup.data.sessions as Array<Record<string, unknown>>) {
    if (!patientsById.has(String(session.patientId))) {
      return 'El respaldo contiene una sesión sin su paciente.';
    }

    if (session.assessmentId !== null) {
      const assessment = assessmentsById.get(String(session.assessmentId));
      if (!assessment) {
        return 'El respaldo contiene una sesión cuya ficha no existe.';
      }
      if (assessment.patientId !== session.patientId) {
        return `La sesión "${session.id}" está vinculada a una ficha de otro paciente.`;
      }
    }

    if (session.linkedAppointmentId !== null) {
      const appointment = appointmentsById.get(String(session.linkedAppointmentId));
      if (!appointment) {
        return 'El respaldo contiene una sesión cuyo turno no existe.';
      }
      if (appointment.patientId !== session.patientId) {
        return `La sesión "${session.id}" está vinculada a un turno de otro paciente.`;
      }

      const rootId = sessionVersions.rootById.get(String(session.id));
      if (!rootId) {
        return `No se pudo determinar la cadena lógica de la sesión "${session.id}".`;
      }
      const existingRootId = logicalSessionByAppointment.get(String(session.linkedAppointmentId));
      if (existingRootId && existingRootId !== rootId) {
        return `El turno "${session.linkedAppointmentId}" está vinculado a más de una sesión lógica.`;
      }
      logicalSessionByAppointment.set(String(session.linkedAppointmentId), rootId);
    }
  }

  for (const communication of backup.data.communications as Array<Record<string, unknown>>) {
    if (communication.patientId !== null && !patientsById.has(String(communication.patientId))) {
      return 'El respaldo contiene una comunicación sin su paciente.';
    }
    if (communication.ownerId !== null && !ownersById.has(String(communication.ownerId))) {
      return 'El respaldo contiene una comunicación cuyo propietario no existe.';
    }
    if (
      communication.templateId !== null &&
      !templatesById.has(String(communication.templateId))
    ) {
      return 'El respaldo contiene una comunicación cuya plantilla no existe.';
    }
  }

  return null;
}

function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  let formatted = '';
  for (const part of path) {
    if (typeof part === 'number') {
      formatted += `[${part}]`;
    } else if (typeof part === 'string') {
      formatted += formatted ? `.${part}` : part;
    } else {
      formatted += `[${String(part)}]`;
    }
  }
  return formatted;
}

function validateBackupData(backup: BackupData): BackupValidation {
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion <= 0) {
    return {
      valid: false,
      error: 'El respaldo contiene un número de versión de esquema inválido.',
    };
  }
  if (backup.schemaVersion > SCHEMA_VERSION_EXPORT) {
    return {
      valid: false,
      error: `El archivo viene de una versión más nueva de la app (v${backup.schemaVersion}). Actualizá la aplicación para importarlo.`,
    };
  }
  if (!isValidIsoTimestamp(backup.exportedAt)) {
    return {
      valid: false,
      error: 'La fecha de exportación del respaldo no es válida.',
    };
  }

  // La normalización es idempotente y también cubre respaldos exportados
  // por versiones anteriores que no incluían algunos campos opcionales.
  migrateBackupData(backup);

  for (const table of TABLES) {
    const result = TABLE_SCHEMAS[table].safeParse(backup.data[table]);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = formatIssuePath(issue.path);
      const field = path ? ` (campo "${path}")` : '';
      const message = issue.message.replace(/\.$/, '');
      return {
        valid: false,
        error: `El respaldo contiene datos inválidos en la tabla "${table}"${field}: ${message}.`,
      };
    }
  }

  for (const table of TABLES) {
    const ids = (backup.data[table] as Array<Record<string, unknown>>).map((record) =>
      String(record.id)
    );
    if (new Set(ids).size !== ids.length) {
      return {
        valid: false,
        error: `El respaldo contiene identificadores duplicados en la tabla "${table}".`,
      };
    }
  }

  const ownerNames = (backup.data.owners as Array<Record<string, unknown>>).map((owner) =>
    String(owner.name)
  );
  if (new Set(ownerNames).size !== ownerNames.length) {
    return {
      valid: false,
      error: 'El respaldo contiene propietarios con el mismo nombre.',
    };
  }

  if (backup.data.settings.length > 1) {
    return {
      valid: false,
      error: 'El respaldo contiene más de una configuración de la clínica.',
    };
  }

  const relationshipError = validateRelationships(backup);
  if (relationshipError) return { valid: false, error: relationshipError };

  const summary: Record<string, number> = {};
  for (const table of TABLES) {
    summary[table] = backup.data[table].length;
  }

  return { valid: true, data: backup, summary };
}

/**
 * Revalida localmente la licencia antes de restaurar un respaldo.
 * Un JSON manipulado no puede habilitar funciones premium por sí solo:
 * el código almacenado debe seguir siendo válido para la versión instalada.
 */
export async function revalidateBackupLicense(
  backup: BackupData,
  validateCode: (_code: string) => Promise<boolean> = (code) =>
    licenseService.validateLicense(code)
): Promise<boolean> {
  const settingsRecords = backup.data.settings as Settings[];
  let licenseRevoked = false;

  for (const settings of settingsRecords) {
    const normalizedKey = settings.licenseKey?.trim().toUpperCase() ?? '';
    const claimedLicense = settings.isLicensed || normalizedKey.length > 0;

    let isValid = false;
    if (normalizedKey) {
      try {
        isValid = await validateCode(normalizedKey);
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      if (claimedLicense) licenseRevoked = true;
      settings.isLicensed = false;
      settings.licenseKey = null;
    } else {
      // El código validado es la fuente de verdad. Un JSON puede alterar el
      // booleano, pero no concede premium ni evita la revalidación.
      settings.isLicensed = true;
      settings.licenseKey = normalizedKey;
    }
  }

  return licenseRevoked;
}

function createSettingsWithLicense(license: ValidatedLicense): Settings {
  const now = new Date().toISOString();
  return {
    id: 'settings',
    ...DEFAULT_SETTINGS,
    isLicensed: true,
    licenseKey: license.code,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}

export const backupService = {
  async exportAll(): Promise<BackupData> {
    // Una lectura de las ocho tablas dentro de la misma transacción evita
    // combinar registros de distintos estados si otra pestaña está escribiendo.
    const data = await db.transaction(
      'r',
      [
        db.owners,
        db.patients,
        db.appointments,
        db.assessments,
        db.sessions,
        db.communications,
        db.messageTemplates,
        db.settings,
      ],
      async () => ({
        owners: await db.owners.toArray(),
        patients: await db.patients.toArray(),
        appointments: await db.appointments.toArray(),
        assessments: await db.assessments.toArray(),
        sessions: await db.sessions.toArray(),
        communications: await db.communications.toArray(),
        messageTemplates: await db.messageTemplates.toArray(),
        settings: await db.settings.toArray(),
      })
    );

    return {
      schemaVersion: SCHEMA_VERSION_EXPORT,
      exportedAt: new Date().toISOString(),
      data,
    };
  },

  async downloadBackup(): Promise<void> {
    const backup = await this.exportAll();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinesia-backup-${toLocalDateInput()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await this.markBackupExported();
  },

  async markBackupExported(): Promise<void> {
    const settings = await db.settings.get('settings');
    if (settings) {
      const now = new Date().toISOString();
      await db.settings.update('settings', {
        lastBackupDate: now,
        updatedAt: now,
      });
    }
  },

  validateBackup(json: string): BackupValidation {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { valid: false, error: 'El archivo no es un JSON válido.' };
    }

    const result = backupSchema.safeParse(parsed);
    if (!result.success) {
      const exportedAtIssue = result.error.issues.find(
        (issue) => issue.path[0] === 'exportedAt'
      );
      if (exportedAtIssue) {
        return {
          valid: false,
          error: `La fecha de exportación del respaldo no es válida: ${exportedAtIssue.message}`,
        };
      }
      return { valid: false, error: 'La estructura del archivo no es válida.' };
    }

    return validateBackupData(result.data as BackupData);
  },

  migrateBackup(backup: BackupData): void {
    migrateBackupData(backup);
  },

  async restoreAll(
    backup: BackupData,
    validator: LicenseValidator = licenseService
  ): Promise<boolean> {
    // Validar nuevamente antes de tocar la base actual: una llamada directa
    // al servicio no debe poder omitir las comprobaciones de la interfaz.
    const validation = validateBackupData(backup);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'El respaldo no es válido.');
    }

    let licenseRevoked = false;

    // Restauración atómica: todo o nada dentro de una transacción. La licencia
    // efectiva y los límites se resuelven dentro de esta misma transacción,
    // antes de borrar o insertar registros.
    await db.transaction(
      'rw',
      [
        db.owners,
        db.patients,
        db.appointments,
        db.assessments,
        db.sessions,
        db.communications,
        db.messageTemplates,
        db.settings,
      ],
      async (tx) => {
        const currentSettings = await tx
          .table<Settings>('settings')
          .get('settings');
        const backupSettings = (backup.data.settings as Settings[]).map(
          (settings) => ({ ...settings })
        );
        const backupSetting = backupSettings[0];
        const currentCode = currentSettings?.licenseKey?.trim().toUpperCase() ?? '';
        const backupCode = backupSetting?.licenseKey?.trim().toUpperCase() ?? '';

        const currentLicense = await validateLicenseInTransaction(
          tx,
          currentCode || null,
          validator
        );
        const backupLicense =
          currentCode && currentCode === backupCode
            ? currentLicense
            : await validateLicenseInTransaction(tx, backupCode || null, validator);

        // La licencia vigente de la instalación tiene prioridad. Si no hay
        // ninguna, se admite la licencia válida incluida en el respaldo.
        const effectiveLicense = currentLicense ?? backupLicense;
        const backupClaimedLicense = Boolean(
          backupSetting?.isLicensed || backupSetting?.licenseKey
        );
        const invalidBackupLicense = backupClaimedLicense && !backupLicense;

        // El aviso de "restaurado en modo demo" corresponde únicamente al
        // caso en que no queda ninguna licencia efectiva después de validar.
        licenseRevoked = invalidBackupLicense && !effectiveLicense;

        if (backupSettings.length > 0) {
          backupSettings[0] = {
            ...backupSettings[0],
            isLicensed: Boolean(effectiveLicense),
            licenseKey: effectiveLicense?.code ?? null,
          };
        } else if (effectiveLicense) {
          backupSettings.push(createSettingsWithLicense(effectiveLicense));
        }

        const dataToRestore = {
          owners: [...(backup.data.owners as Owner[])],
          patients: [...(backup.data.patients as Patient[])],
          appointments: [...(backup.data.appointments as Appointment[])],
        };

        // En modo demo el respaldo debe ser restaurable sin modificaciones
        // ocultas. Si excede un límite, la transacción aborta antes de tocar
        // la base actual y se informa cómo habilitar el modo premium.
        if (!effectiveLicense) {
          assertBackupWithinDemoLimits(dataToRestore);
        }

        // Limpiar todas las tablas
        await tx.table('owners').clear();
        await tx.table('patients').clear();
        await tx.table('appointments').clear();
        await tx.table('assessments').clear();
        await tx.table('sessions').clear();
        await tx.table('communications').clear();
        await tx.table('messageTemplates').clear();
        await tx.table('settings').clear();

        // Insertar datos del backup
        if (dataToRestore.owners.length > 0) {
          await tx.table<Owner>('owners').bulkAdd(dataToRestore.owners);
        }
        if (dataToRestore.patients.length > 0) {
          await tx.table<Patient>('patients').bulkAdd(dataToRestore.patients);
        }
        if (dataToRestore.appointments.length > 0) {
          await tx.table<Appointment>('appointments').bulkAdd(
            dataToRestore.appointments
          );
        }
        if (backup.data.assessments.length > 0) {
          await tx.table<Assessment>('assessments').bulkAdd(
            backup.data.assessments as Assessment[]
          );
        }
        if (backup.data.sessions.length > 0) {
          await tx.table<Session>('sessions').bulkAdd(backup.data.sessions as Session[]);
        }
        if (backup.data.communications.length > 0) {
          await tx.table<Communication>('communications').bulkAdd(
            backup.data.communications as Communication[]
          );
        }
        if (backup.data.messageTemplates.length > 0) {
          await tx.table<MessageTemplate>('messageTemplates').bulkAdd(
            backup.data.messageTemplates as MessageTemplate[]
          );
        }
        if (backupSettings.length > 0) {
          await tx.table<Settings>('settings').bulkAdd(backupSettings);
        }
      }
    );

    return licenseRevoked;
  },
};
