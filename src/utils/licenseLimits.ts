/**
 * Límites del modo demo (sin licencia).
 * Al activar una licencia válida, estos límites se eliminan.
 *
 * Los límites cuentan únicamente registros no archivados
 * (`archivedAt === null`). Los archivados se conservan como historial y no
 * vuelven a consumir cupo. Cancelar o completar un registro no lo archiva:
 * por lo tanto, sigue consumiendo cupo hasta que sea archivado lógicamente.
 *
 * Durante una reprogramación, el original se excluye explícitamente del
 * conteo para evaluar el alta neta del reemplazo (por ejemplo, 3→3).
 */

export const DEMO_LIMITS = {
  maxPatients: 5,
  maxOwners: 3,
  maxAppointments: 3,
} as const;

export type DemoLimitedResource = 'owners' | 'patients' | 'appointments';

export const DEMO_LIMIT_BY_RESOURCE: Record<DemoLimitedResource, number> = {
  owners: DEMO_LIMITS.maxOwners,
  patients: DEMO_LIMITS.maxPatients,
  appointments: DEMO_LIMITS.maxAppointments,
};

export const DEMO_LIMIT_LABELS: Record<DemoLimitedResource, string> = {
  patients: 'pacientes',
  owners: 'propietarios',
  appointments: 'turnos',
};

export const PREMIUM_FEATURES = {
  exportPdf: 'Exportar PDF',
  sendWhatsApp: 'Enviar WhatsApp',
  unlimitedRecords: 'Registros ilimitados',
} as const;
