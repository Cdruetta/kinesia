import { describe, expect, it } from 'vitest';
import {
  backupService,
  revalidateBackupLicense,
  type BackupData,
} from '@/services/backupService';
import type { Settings } from '@/models';

function createBackup(): BackupData {
  const result = backupService.validateBackup(
    JSON.stringify({
      schemaVersion: 2,
      exportedAt: '2026-11-20T12:00:00.000Z',
      data: {
        owners: [{ id: 'owner-1', name: 'Ana', phone: '11 5555 1234' }],
        patients: [
          {
            id: 'patient-1',
            ownerId: 'owner-1',
            name: 'Toto',
            species: 'Perro',
          },
        ],
        appointments: [],
        assessments: [],
        sessions: [],
        communications: [],
        messageTemplates: [],
        settings: [{ id: 'settings' }],
      },
    })
  );

  if (!result.valid || !result.data) {
    throw new Error(result.error ?? 'El respaldo de prueba no es válido.');
  }
  return result.data;
}

function addPatient(
  backup: BackupData,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const patient = {
    id: 'patient-2',
    ownerId: 'owner-1',
    name: 'Luna',
    species: 'Gato',
    ...overrides,
  };
  backup.data.patients.push(patient);
  return patient;
}

function addAppointment(
  backup: BackupData,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const appointment = {
    id: 'appointment-1',
    patientId: 'patient-1',
    ownerId: 'owner-1',
    startsAt: '2026-11-20T09:00:00',
    durationMinutes: 30,
    status: 'scheduled',
    rescheduledFrom: null,
    previousStartsAt: null,
    ...overrides,
  };
  backup.data.appointments.push(appointment);
  return appointment;
}

function addAssessment(
  backup: BackupData,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const assessment = {
    id: 'assessment-1',
    patientId: 'patient-1',
    title: 'Evaluación inicial',
    assessedAt: '2026-11-20',
    version: 1,
    previousVersionId: null,
    isLatest: true,
    ...overrides,
  };
  backup.data.assessments.push(assessment);
  return assessment;
}

function addSession(
  backup: BackupData,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const session = {
    id: 'session-1',
    patientId: 'patient-1',
    assessmentId: null,
    linkedAppointmentId: null,
    sessionAt: '2026-11-20T00:00:00',
    treatments: [],
    version: 1,
    previousVersionId: null,
    isLatest: true,
    ...overrides,
  };
  backup.data.sessions.push(session);
  return session;
}

describe('backupService.validateBackup', () => {
  it('acepta un respaldo coherente y devuelve su resumen', () => {
    const result = backupService.validateBackup(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '2026-11-20T12:00:00.000Z',
        data: {
          owners: [{ id: 'owner-1', name: 'Ana', phone: '11 5555 1234' }],
          patients: [],
          appointments: [],
          assessments: [],
          sessions: [],
          communications: [],
          messageTemplates: [],
          settings: [],
        },
      })
    );

    expect(result.valid).toBe(true);
    expect(result.summary).toMatchObject({ owners: 1, patients: 0, settings: 0 });
  });

  it('rechaza JSON inválido', () => {
    expect(backupService.validateBackup('{')).toMatchObject({ valid: false });
  });

  it('rechaza respaldos de una versión futura', () => {
    const backup = createBackup();
    backup.schemaVersion = 99;

    const result = backupService.validateBackup(JSON.stringify(backup));
    expect(result).toMatchObject({ valid: false });
    expect(result.error).toContain('versión más nueva');
  });

  it('rechaza registros que no son objetos de dominio válidos', () => {
    const backup = createBackup();
    backup.data.owners = ['registro inválido'];

    const result = backupService.validateBackup(JSON.stringify(backup));
    expect(result).toMatchObject({ valid: false });
    expect(result.error).toContain('tabla "owners"');
  });

  it('rechaza identificadores duplicados', () => {
    const backup = createBackup();
    backup.data.owners.push({
      ...(backup.data.owners[0] as Record<string, unknown>),
    });

    const result = backupService.validateBackup(JSON.stringify(backup));
    expect(result).toMatchObject({ valid: false });
    expect(result.error).toContain('duplicados');
  });

  it('rechaza propietarios duplicados que violan el índice único', () => {
    const backup = createBackup();
    backup.data.owners.push({
      ...(backup.data.owners[0] as Record<string, unknown>),
      id: 'owner-2',
    });

    const result = backupService.validateBackup(JSON.stringify(backup));
    expect(result).toMatchObject({ valid: false });
    expect(result.error).toContain('mismo nombre');
  });

  it('rechaza pacientes cuyo propietario no existe', () => {
    const backup = createBackup();
    const patient = backup.data.patients[0] as Record<string, unknown>;
    patient.ownerId = 'owner-inexistente';

    const result = backupService.validateBackup(JSON.stringify(backup));
    expect(result).toMatchObject({ valid: false });
    expect(result.error).toContain('sin su propietario');
  });

  it('rechaza un paciente activo cuyo propietario está archivado', () => {
    const backup = createBackup();
    const owner = backup.data.owners[0] as Record<string, unknown>;
    owner.archivedAt = '2026-11-20T12:00:00.000Z';

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result).toMatchObject({ valid: false });
    expect(result.error).toContain('propietario está archivado');
  });
});

describe('validación de fechas y turnos', () => {
  it('rechaza un timestamp que no representa una fecha ISO real', () => {
    const backup = createBackup();
    const owner = backup.data.owners[0] as Record<string, unknown>;
    owner.createdAt = '2026-02-30T12:00:00.000Z';

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('createdAt');
    expect(result.error).toContain('timestamp ISO válido');
  });

  it('rechaza fechas clínicas ISO explícitamente inválidas sin normalizarlas', () => {
    const assessmentBackup = createBackup();
    addAssessment(assessmentBackup, { assessedAt: '2026-02-30T12:00:00.000Z' });
    const assessmentResult = backupService.validateBackup(JSON.stringify(assessmentBackup));

    expect(assessmentResult.valid).toBe(false);
    expect(assessmentResult.error).toContain('assessedAt');
    expect(assessmentResult.error).toContain('fecha local válida');

    const sessionBackup = createBackup();
    addSession(sessionBackup, { sessionAt: '2026-02-30T10:00:00.000Z' });
    const sessionResult = backupService.validateBackup(JSON.stringify(sessionBackup));

    expect(sessionResult.valid).toBe(false);
    expect(sessionResult.error).toContain('sessionAt');
    expect(sessionResult.error).toContain('fecha y hora local válida');
  });

  it('rechaza una fecha clínica local inexistente', () => {
    const backup = createBackup();
    addAssessment(backup, { assessedAt: '2026-02-30' });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('assessedAt');
    expect(result.error).toContain('fecha local válida');
  });

  it('rechaza una fecha y hora clínica local con formato o fecha inválidos', () => {
    const backup = createBackup();
    addSession(backup, { sessionAt: '2026-02-30T10:00:00' });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('sessionAt');
    expect(result.error).toContain('fecha y hora local válida');
  });

  it('rechaza startsAt con fecha inválida o zona horaria ambigua', () => {
    const invalidDateBackup = createBackup();
    addAppointment(invalidDateBackup, { startsAt: '2026-02-30T10:00:00' });
    const invalidDateResult = backupService.validateBackup(JSON.stringify(invalidDateBackup));

    expect(invalidDateResult.valid).toBe(false);
    expect(invalidDateResult.error).toContain('startsAt');
    expect(invalidDateResult.error).toContain('sin zona horaria');

    const zonedBackup = createBackup();
    addAppointment(zonedBackup, { startsAt: '2026-11-20T10:00:00Z' });
    const zonedResult = backupService.validateBackup(JSON.stringify(zonedBackup));

    expect(zonedResult.valid).toBe(false);
    expect(zonedResult.error).toContain('startsAt');
  });

  it('rechaza una duración de turno mayor a 480 minutos', () => {
    const backup = createBackup();
    addAppointment(backup, { durationMinutes: 481 });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('durationMinutes');
    expect(result.error).toContain('480');
  });
});

describe('validación del versionado clínico', () => {
  it('rechaza una versión anterior inexistente', () => {
    const backup = createBackup();
    addAssessment(backup, { previousVersionId: 'assessment-missing', version: 2 });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('versión anterior que no existe');
  });

  it('rechaza una versión anterior perteneciente a otro paciente', () => {
    const backup = createBackup();
    addPatient(backup);
    addAssessment(backup, { id: 'assessment-2', patientId: 'patient-2' });
    addAssessment(backup, {
      id: 'assessment-3',
      previousVersionId: 'assessment-2',
      version: 2,
      isLatest: true,
    });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('otro paciente');
  });

  it('rechaza una versión que no incrementa exactamente una', () => {
    const backup = createBackup();
    addAssessment(backup, { isLatest: false });
    addAssessment(backup, {
      id: 'assessment-2',
      previousVersionId: 'assessment-1',
      version: 3,
      isLatest: true,
    });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('incrementar exactamente una versión');
  });

  it('rechaza ciclos de versiones', () => {
    const backup = createBackup();
    addAssessment(backup, {
      id: 'assessment-1',
      previousVersionId: 'assessment-2',
      version: 2,
    });
    addAssessment(backup, {
      id: 'assessment-2',
      previousVersionId: 'assessment-1',
      version: 2,
      isLatest: false,
    });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('ciclo de versiones');
  });

  it('rechaza una cadena lógica con más de una versión latest', () => {
    const backup = createBackup();
    addAssessment(backup);
    addAssessment(backup, {
      id: 'assessment-2',
      previousVersionId: 'assessment-1',
      version: 2,
      isLatest: true,
    });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exactamente una versión latest');
  });
});

describe('validación de relaciones clínicas', () => {
  it('rechaza una sesión vinculada a una ficha de otro paciente', () => {
    const backup = createBackup();
    addPatient(backup);
    addAssessment(backup, { id: 'assessment-2', patientId: 'patient-2' });
    addSession(backup, { assessmentId: 'assessment-2' });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('ficha de otro paciente');
  });

  it('rechaza una sesión vinculada a un turno de otro paciente', () => {
    const backup = createBackup();
    addPatient(backup);
    addAppointment(backup, { id: 'appointment-2', patientId: 'patient-2' });
    addSession(backup, { linkedAppointmentId: 'appointment-2' });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('turno de otro paciente');
  });

  it('rechaza dos sesiones lógicas distintas vinculadas al mismo turno', () => {
    const backup = createBackup();
    addAppointment(backup);
    addSession(backup, { linkedAppointmentId: 'appointment-1' });
    addSession(backup, { id: 'session-2', linkedAppointmentId: 'appointment-1' });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('más de una sesión lógica');
  });

  it('permite que dos versiones de una misma sesión lógica compartan el turno', () => {
    const backup = createBackup();
    addAppointment(backup);
    addSession(backup, {
      linkedAppointmentId: 'appointment-1',
      isLatest: false,
    });
    addSession(backup, {
      id: 'session-2',
      linkedAppointmentId: 'appointment-1',
      previousVersionId: 'session-1',
      version: 2,
      isLatest: true,
    });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(true);
  });

  it('permite un reemplazo reprogramado para otro paciente', () => {
    const backup = createBackup();
    addPatient(backup);
    addAppointment(backup, { id: 'appointment-original' });
    addAppointment(backup, {
      id: 'appointment-replacement',
      patientId: 'patient-2',
      startsAt: '2026-11-20T10:00:00',
      rescheduledFrom: 'appointment-original',
      previousStartsAt: '2026-11-20T09:00:00',
    });

    const result = backupService.validateBackup(JSON.stringify(backup));

    expect(result.valid).toBe(true);
  });

  it('rechaza una referencia de reprogramación inexistente o inconsistente', () => {
    const missingReferenceBackup = createBackup();
    addAppointment(missingReferenceBackup, {
      id: 'appointment-2',
      rescheduledFrom: 'appointment-missing',
      previousStartsAt: '2026-11-20T09:00:00',
    });
    const missingReferenceResult = backupService.validateBackup(
      JSON.stringify(missingReferenceBackup)
    );

    expect(missingReferenceResult.valid).toBe(false);
    expect(missingReferenceResult.error).toContain('turno anterior que no existe');

    const inconsistentBackup = createBackup();
    addAppointment(inconsistentBackup, { id: 'appointment-original' });
    addAppointment(inconsistentBackup, {
      id: 'appointment-replacement',
      startsAt: '2026-11-20T10:00:00',
      rescheduledFrom: 'appointment-original',
      previousStartsAt: '2026-11-20T08:00:00',
    });
    const inconsistentResult = backupService.validateBackup(JSON.stringify(inconsistentBackup));

    expect(inconsistentResult.valid).toBe(false);
    expect(inconsistentResult.error).toContain('no coincide con el turno de origen');
  });
});

describe('migración de respaldos legacy', () => {
  it('completa defaults y deja invariantes válidas en una cadena clínica', () => {
    const result = backupService.validateBackup(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: '2026-11-20T12:00:00.000Z',
        data: {
          owners: [{ id: 'owner-1', name: 'Ana', phone: '11 5555 1234' }],
          patients: [
            {
              id: 'patient-1',
              ownerId: 'owner-1',
              name: 'Toto',
              species: 'Perro',
            },
          ],
          appointments: [
            {
              id: 'appointment-1',
              patientId: 'patient-1',
              ownerId: 'owner-1',
              startsAt: '2026-11-20T09:00:00',
              durationMinutes: 30,
              status: 'scheduled',
            },
          ],
          assessments: [
            {
              id: 'assessment-1',
              patientId: 'patient-1',
              title: 'Evaluación inicial',
              createdAt: '2026-11-20T12:00:00.000Z',
            },
          ],
          sessions: [
            {
              id: 'session-1',
              patientId: 'patient-1',
              linkedAppointmentId: 'appointment-1',
              createdAt: '2026-11-20T12:00:00.000Z',
            },
          ],
          communications: [],
          messageTemplates: [],
          settings: [],
        },
      })
    );

    expect(result.valid).toBe(true);
    expect(result.data?.data.assessments[0]).toMatchObject({
      assessedAt: '2026-11-20',
      version: 1,
      previousVersionId: null,
      isLatest: true,
    });
    expect(result.data?.data.sessions[0]).toMatchObject({
      sessionAt: '2026-11-20T00:00:00',
      version: 1,
      previousVersionId: null,
      isLatest: true,
    });
  });
});

describe('revalidateBackupLicense', () => {
  it('revoca una licencia manipulada que no se puede validar', async () => {
    const backup = createBackup();
    const settings = backup.data.settings[0] as Settings;
    settings.isLicensed = true;
    settings.licenseKey = 'KIN-2026-ZZZ42M';

    const revoked = await revalidateBackupLicense(backup, async () => false);

    expect(revoked).toBe(true);
    expect(settings.isLicensed).toBe(false);
    expect(settings.licenseKey).toBeNull();
  });

  it('conserva una licencia válida y normaliza su código', async () => {
    const backup = createBackup();
    const settings = backup.data.settings[0] as Settings;
    settings.isLicensed = true;
    settings.licenseKey = '  kin-2026-pro42m  ';

    const revoked = await revalidateBackupLicense(backup, async () => true);

    expect(revoked).toBe(false);
    expect(settings.isLicensed).toBe(true);
    expect(settings.licenseKey).toBe('KIN-2026-PRO42M');
  });

  it('rehabilita un código válido aunque el JSON haya manipulado el booleano', async () => {
    const backup = createBackup();
    const settings = backup.data.settings[0] as Settings;
    settings.isLicensed = false;
    settings.licenseKey = '  kin-2026-pro42m  ';

    const revoked = await revalidateBackupLicense(backup, async () => true);

    expect(revoked).toBe(false);
    expect(settings.isLicensed).toBe(true);
    expect(settings.licenseKey).toBe('KIN-2026-PRO42M');
  });

  it('revoca un código que no está habilitado en la versión instalada', async () => {
    const backup = createBackup();
    const settings = backup.data.settings[0] as Settings;
    settings.isLicensed = true;
    settings.licenseKey = 'KIN-2026-PRO42M';

    await revalidateBackupLicense(backup);

    expect(settings.isLicensed).toBe(false);
    expect(settings.licenseKey).toBeNull();
  });
});
