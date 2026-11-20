/**
 * Esquema de base de datos (Dexie.js sobre IndexedDB).
 *
 * Convenciones de datos (bloque común del proyecto):
 * - Identificadores UUID en todos los registros (crypto.randomUUID()).
 * - Timestamps ISO 8601: createdAt, updatedAt, archivedAt (null si activo).
 * - Archivado lógico: ningún borrado físico por defecto.
 * - Las tablas se declaran aquí; la instancia y migraciones en instance.ts.
 */

export const SCHEMA_VERSION = 1;

type ISODate = string; // timestamp ISO 8601

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
export type CommunicationType = 'whatsapp' | 'call' | 'email';
export type CommunicationDirection = 'inbound' | 'outbound';

export interface Owner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export interface Patient {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: 'macho' | 'hembra' | 'otro' | null;
  birthDate: ISODate | null; // fecha de nacimiento aproximada
  birthDateApproximate: boolean;
  notes: string | null;
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  ownerId: string | null;
  startsAt: ISODate; // ISO local del inicio del turno
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string | null; // motivo de la consulta
  notes: string | null; // observaciones
  rescheduledFrom: string | null; // id del turno original si fue reprogramado
  previousStartsAt: string | null; // fecha anterior si fue reprogramado
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export interface Assessment {
  id: string;
  patientId: string;
  title: string;
  assessedAt: ISODate;
  // Bloque A: datos del propietario (snapshot)
  ownerSnapshot: OwnerSnapshot | null;
  // Bloque B: datos del paciente (snapshot)
  patientSnapshot: PatientSnapshot | null;
  // Campo propio de la ficha
  referredBy: string | null;
  // Bloque C: evaluación clínica
  reason: string | null; // motivo de la consulta
  diagnosis: string | null;
  studies: string | null;
  complements: string | null;
  medicalTreatments: string | null; // tratamientos médicos
  additionalObservations: string | null;
  // Versionado
  version: number;
  previousVersionId: string | null;
  isLatest: boolean;
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export interface OwnerSnapshot {
  name: string;
  address: string | null;
  phone: string | null;
}

export interface PatientSnapshot {
  name: string;
  species: string;
  breed: string | null;
  sex: 'macho' | 'hembra' | 'otro' | null;
  ageYears: number | null;
  ageMonths: number | null;
  oncological: boolean | null;
  orthoNeuro: 'ortopedico' | 'neurologico' | 'ambos' | 'ninguno' | null;
  orthoNeuroDetails: string | null;
  ambulatory: boolean | null;
  nodules: string | null;
  mentalState: 'normal' | 'deprimido' | 'estupor' | 'coma' | null;
  preexistingDiseases: string | null;
}

export interface Session {
  id: string;
  patientId: string;
  assessmentId: string | null;
  linkedAppointmentId: string | null; // turno del que proviene
  sessionAt: ISODate;
  generalObservations: string | null;
  evolution: string | null;
  treatments: TreatmentApplication[];
  // Versionado
  version: number;
  previousVersionId: string | null;
  isLatest: boolean;
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export interface TreatmentApplication {
  treatmentType: TreatmentType;
  applied: boolean;
  zone: string | null;
  intensity: string | null;
  intensityUnit: string | null;
  timeMinutes: number | null;
  dose: string | null;
  frequency: string | null;
  additionalParams: ParamPair[];
  observations: string | null;
}

export type TreatmentType =
  | 'magnetoterapia'
  | 'laser'
  | 'fotobiomodulacion'
  | 'tens'
  | 'electroestimulacion'
  | 'ultrasonido'
  | 'ozonoterapia';

export interface ParamPair {
  name: string;
  value: string;
}

export interface Communication {
  id: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  contact: string; // teléfono / email
  message: string | null;
  status: 'prepared' | 'opened' | 'sent'; // preparado, WhatsApp abierto, marcado como enviado (manual)
  patientId: string | null;
  ownerId: string | null;
  templateId: string | null;
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: MessageTemplateCategory;
  content: string;
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

export type MessageTemplateCategory =
  | 'confirmacion_turno'
  | 'recordatorio_turno'
  | 'reprogramacion'
  | 'cancelacion'
  | 'recordatorio_sesion'
  | 'seguimiento_paciente'
  | 'consulta_evolucion'
  | 'personalizado';

export interface Settings {
  id: string; // siempre "settings"
  clinicName: string;
  logo: string | null; // data URL guardada en IndexedDB
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  // horarios de atención por día de la semana (0 = domingo ... 6 = sábado)
  hours: string | null; // JSON: { 0: { open: "09:00", close: "18:00", closed: false }, ... }
  defaultAppointmentDuration: number; // minutos
  // Preferencias de impresión
  printLogo: boolean;
  printFooter: boolean;
  // Criterio de seguimiento (días sin sesión para considerar paciente que requiere seguimiento)
  followUpDays: number;
  // Tema de la interfaz: light, dark, system
  theme: 'light' | 'dark' | 'system';
  // Bloqueo local con PIN
  pinEnabled: boolean;
  pinHash: string | null; // hash PBKDF2
  pinSalt: string | null; // sal en base64
  pinAttempts: number; // intentos fallidos
  pinLockedUntil: ISODate | null; // bloqueo temporal
  autoLockMinutes: number; // minutos de inactividad para bloqueo automático (0 = desactivado)
  // Respaldos
  lastBackupDate: ISODate | null;
  backupReminderDays: number; // días para recordar respaldo
  createdAt: ISODate;
  updatedAt: ISODate | null;
  archivedAt: ISODate | null;
}

/** Entidades con CRUD genérico por servicio. */
export type DbEntity = Owner | Patient | Appointment | Assessment | Session | Communication | MessageTemplate | Settings;
