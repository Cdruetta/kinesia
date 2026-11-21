import { DEFAULT_SETTINGS } from '@/models';
import { fromLocalDateInput, toLocalDateInput } from '@/utils/dates';

export type LegacyTable =
  | 'owners'
  | 'patients'
  | 'appointments'
  | 'assessments'
  | 'sessions'
  | 'communications'
  | 'messageTemplates'
  | 'settings';

type LegacyRecord = Record<string, unknown>;
type ClinicalDateTable = 'assessments' | 'sessions';

const LEGACY_ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

function asRecord(value: unknown): LegacyRecord {
  return value && typeof value === 'object' ? (value as LegacyRecord) : {};
}

function parseLegacyIsoTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = LEGACY_ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  if (!fromLocalDateInput(datePart)) return null;

  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = Number(match[6]);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  if (match[7] !== 'Z') {
    const offsetHours = Number(match[8]);
    const offsetMinutes = Number(match[9]);
    if (offsetHours > 23 || offsetMinutes > 59) return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${toLocalDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Normaliza timestamps ISO de fechas clínicas al formato local usado por la
 * aplicación. Es específico de la migración Dexie v4: no debe aplicarse al
 * importar respaldos, cuya validación estricta debe conservar los valores
 * explícitos para poder rechazarlos.
 */
export function migrateClinicalDatesToLocal(
  table: ClinicalDateTable,
  records: unknown[]
): unknown[] {
  const field = table === 'assessments' ? 'assessedAt' : 'sessionAt';

  return records.map((value) => {
    const record = { ...asRecord(value) };
    const timestamp = parseLegacyIsoTimestamp(record[field]);
    if (!timestamp) return record;

    record[field] =
      table === 'assessments'
        ? toLocalDateInput(timestamp)
        : toLocalDateTimeInput(timestamp);
    return record;
  });
}

function withDefaults(record: LegacyRecord, defaults: Record<string, unknown>): LegacyRecord {
  const normalized = { ...record };
  for (const [key, value] of Object.entries(defaults)) {
    if (normalized[key] === undefined) normalized[key] = value;
  }
  return normalized;
}

function legacyTimestampToLocalDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toLocalDateInput(date);
}

function legacyTimestampToLocalDateTime(value: unknown): string | null {
  const localDate = legacyTimestampToLocalDate(value);
  return localDate ? `${localDate}T00:00:00` : null;
}

/**
 * Completa campos que no existían en versiones antiguas de la base.
 * Se usa tanto para migraciones de Dexie como para respaldos importados.
 */
export function migrateLegacyTable(table: LegacyTable, records: unknown[]): unknown[] {
  const now = new Date().toISOString();

  return records.map((value) => {
    const record = asRecord(value);

    switch (table) {
      case 'owners':
        return withDefaults(record, {
          email: null,
          address: null,
          notes: null,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'patients':
        return withDefaults(record, {
          breed: null,
          sex: null,
          birthDate: null,
          birthDateApproximate: false,
          notes: null,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'appointments':
        return withDefaults(record, {
          reason: null,
          notes: null,
          rescheduledFrom: null,
          previousStartsAt: null,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'assessments':
        return withDefaults(record, {
          title: 'Evaluación',
          assessedAt:
            legacyTimestampToLocalDate(record.assessedAt ?? record.createdAt) ??
            legacyTimestampToLocalDate(now)!,
          ownerSnapshot: null,
          patientSnapshot: null,
          referredBy: null,
          reason: null,
          diagnosis: null,
          studies: null,
          complements: null,
          medicalTreatments: null,
          additionalObservations: null,
          version: 1,
          previousVersionId: null,
          isLatest: true,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'sessions':
        return withDefaults(record, {
          assessmentId: null,
          linkedAppointmentId: null,
          sessionAt:
            legacyTimestampToLocalDateTime(record.sessionAt ?? record.createdAt) ??
            legacyTimestampToLocalDateTime(now)!,
          generalObservations: null,
          evolution: null,
          treatments: [],
          version: 1,
          previousVersionId: null,
          isLatest: true,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'communications':
        return withDefaults(record, {
          message: null,
          patientId: null,
          ownerId: null,
          templateId: null,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'messageTemplates':
        return withDefaults(record, {
          category: 'personalizado',
          content: '',
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      case 'settings':
        return withDefaults(record, {
          ...DEFAULT_SETTINGS,
          id: 'settings',
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

      default:
        return record;
    }
  });
}
