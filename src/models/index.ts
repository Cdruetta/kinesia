/**
 * Modelos de dominio del dominio de la clínica.
 * Re-exportan los tipos de la capa de datos para que el resto de la app
 * importe desde @/models en lugar de @/db/schema.
 */

export type {
  Owner,
  Patient,
  Appointment,
  AppointmentStatus,
  Assessment,
  Session,
  OwnerSnapshot,
  PatientSnapshot,
  TreatmentType,
  TreatmentApplication,
  ParamPair,
  Communication,
  CommunicationType,
  CommunicationDirection,
  MessageTemplate,
  MessageTemplateCategory,
  Settings,
  DbEntity,
} from '@/db/schema';
import type { Settings } from '@/db/schema';
export { SCHEMA_VERSION } from '@/db/schema';

/** Valor por defecto de la configuración de la clínica. */
export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'> = {
  clinicName: 'Clínica Kinesia',
  logo: null,
  address: null,
  phone: null,
  whatsapp: null,
  email: null,
  hours: JSON.stringify({
    0: { open: '09:00', close: '14:00', closed: false },
    1: { open: '09:00', close: '18:00', closed: false },
    2: { open: '09:00', close: '18:00', closed: false },
    3: { open: '09:00', close: '18:00', closed: false },
    4: { open: '09:00', close: '18:00', closed: false },
    5: { open: '09:00', close: '13:00', closed: false },
    6: { open: null, close: null, closed: true },
  }),
  defaultAppointmentDuration: 30,
  printLogo: true,
  printFooter: true,
  followUpDays: 30,
  pinEnabled: false,
  pinHash: null,
  pinSalt: null,
  pinAttempts: 0,
  pinLockedUntil: null,
  autoLockMinutes: 5,
  lastBackupDate: null,
  backupReminderDays: 7,
  theme: 'system',
  // Licencia (freemium)
  isLicensed: false,
  licenseKey: null,
};
