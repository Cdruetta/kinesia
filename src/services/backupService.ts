import { db } from '@/db/instance';
import { z } from 'zod';

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

export const SCHEMA_VERSION_EXPORT = 1;

const backupSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  data: z.object({
    owners: z.array(z.any()),
    patients: z.array(z.any()),
    appointments: z.array(z.any()),
    assessments: z.array(z.any()),
    sessions: z.array(z.any()),
    communications: z.array(z.any()),
    messageTemplates: z.array(z.any()),
    settings: z.array(z.any()),
  }),
});

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export const backupService = {
  async exportAll(): Promise<BackupData> {
    const data: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      data[table] = await (db as any)[table].toArray();
    }
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
    a.download = `kinesia-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Actualizar lastBackupDate en settings
    const settings = await db.settings.get('settings');
    if (settings) {
      await db.settings.update('settings', { lastBackupDate: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  },

  validateBackup(json: string): { valid: boolean; error?: string; data?: BackupData; summary?: Record<string, number> } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { valid: false, error: 'El archivo no es un JSON válido.' };
    }

    const result = backupSchema.safeParse(parsed);
    if (!result.success) {
      return { valid: false, error: 'La estructura del archivo no es válida.' };
    }

    const backup = result.data as BackupData;

    // Verificar versión
    if (backup.schemaVersion > SCHEMA_VERSION_EXPORT) {
      return { valid: false, error: `El archivo viene de una versión más nueva de la app (v${backup.schemaVersion}). Actualizá la aplicación para importarlo.` };
    }

    if (backup.schemaVersion < SCHEMA_VERSION_EXPORT) {
      // Migrar: agregar campos faltantes con valores por defecto
      this.migrateBackup(backup);
    }

    const summary: Record<string, number> = {};
    for (const table of TABLES) {
      summary[table] = (backup.data[table] as unknown[]).length;
    }

    return { valid: true, data: backup, summary };
  },

  migrateBackup(backup: BackupData): void {
    // Migración de versión anterior a la actual
    // Agregar campos faltantes con valores por defecto
    const owners = backup.data.owners as any[];
    owners.forEach((o) => {
      if (o.notes === undefined) o.notes = null;
      if (o.email === undefined) o.email = null;
      if (o.address === undefined) o.address = null;
    });

    const patients = backup.data.patients as any[];
    patients.forEach((p) => {
      if (p.sex === undefined) p.sex = null;
      if (p.birthDateApproximate === undefined) p.birthDateApproximate = false;
      if (p.notes === undefined) p.notes = null;
      if (p.breed === undefined) p.breed = null;
    });

    const appointments = backup.data.appointments as any[];
    appointments.forEach((a) => {
      if (a.reason === undefined) a.reason = null;
      if (a.rescheduledFrom === undefined) a.rescheduledFrom = null;
      if (a.previousStartsAt === undefined) a.previousStartsAt = null;
    });

    const assessments = backup.data.assessments as any[];
    assessments.forEach((a) => {
      if (a.ownerSnapshot === undefined) a.ownerSnapshot = null;
      if (a.patientSnapshot === undefined) a.patientSnapshot = null;
      if (a.referredBy === undefined) a.referredBy = null;
      if (a.reason === undefined) a.reason = null;
      if (a.diagnosis === undefined) a.diagnosis = null;
      if (a.studies === undefined) a.studies = null;
      if (a.complements === undefined) a.complements = null;
      if (a.medicalTreatments === undefined) a.medicalTreatments = null;
      if (a.additionalObservations === undefined) a.additionalObservations = null;
      if (a.version === undefined) a.version = 1;
      if (a.previousVersionId === undefined) a.previousVersionId = null;
      if (a.isLatest === undefined) a.isLatest = true;
    });

    const sessions = backup.data.sessions as any[];
    sessions.forEach((s) => {
      if (s.linkedAppointmentId === undefined) s.linkedAppointmentId = null;
      if (s.generalObservations === undefined) s.generalObservations = null;
      if (s.evolution === undefined) s.evolution = null;
      if (s.treatments === undefined) s.treatments = [];
      if (s.version === undefined) s.version = 1;
      if (s.previousVersionId === undefined) s.previousVersionId = null;
      if (s.isLatest === undefined) s.isLatest = true;
    });

    const communications = backup.data.communications as any[];
    communications.forEach((c) => {
      if (c.patientId === undefined) c.patientId = null;
      if (c.ownerId === undefined) c.ownerId = null;
      if (c.templateId === undefined) c.templateId = null;
    });

    const messageTemplates = backup.data.messageTemplates as any[];
    messageTemplates.forEach((t) => {
      if (t.category === undefined) t.category = 'personalizado';
    });

    const settings = backup.data.settings as any[];
    settings.forEach((s) => {
      if (s.printLogo === undefined) s.printLogo = true;
      if (s.printFooter === undefined) s.printFooter = true;
      if (s.followUpDays === undefined) s.followUpDays = 30;
      if (s.pinEnabled === undefined) s.pinEnabled = false;
      if (s.pinHash === undefined) s.pinHash = null;
      if (s.pinSalt === undefined) s.pinSalt = null;
      if (s.pinAttempts === undefined) s.pinAttempts = 0;
      if (s.pinLockedUntil === undefined) s.pinLockedUntil = null;
      if (s.autoLockMinutes === undefined) s.autoLockMinutes = 5;
      if (s.lastBackupDate === undefined) s.lastBackupDate = null;
      if (s.backupReminderDays === undefined) s.backupReminderDays = 7;
    });
  },

  async restoreAll(backup: BackupData): Promise<void> {
    // Restauración atómica: todo o nada dentro de una transacción
    await db.transaction('rw', [db.owners, db.patients, db.appointments, db.assessments, db.sessions, db.communications, db.messageTemplates, db.settings], async () => {
      // Limpiar todas las tablas
      await db.owners.clear();
      await db.patients.clear();
      await db.appointments.clear();
      await db.assessments.clear();
      await db.sessions.clear();
      await db.communications.clear();
      await db.messageTemplates.clear();
      await db.settings.clear();

      // Insertar datos del backup
      if (backup.data.owners.length > 0) await db.owners.bulkAdd(backup.data.owners as any);
      if (backup.data.patients.length > 0) await db.patients.bulkAdd(backup.data.patients as any);
      if (backup.data.appointments.length > 0) await db.appointments.bulkAdd(backup.data.appointments as any);
      if (backup.data.assessments.length > 0) await db.assessments.bulkAdd(backup.data.assessments as any);
      if (backup.data.sessions.length > 0) await db.sessions.bulkAdd(backup.data.sessions as any);
      if (backup.data.communications.length > 0) await db.communications.bulkAdd(backup.data.communications as any);
      if (backup.data.messageTemplates.length > 0) await db.messageTemplates.bulkAdd(backup.data.messageTemplates as any);
      if (backup.data.settings.length > 0) await db.settings.bulkAdd(backup.data.settings as any);
    });
  },
};
