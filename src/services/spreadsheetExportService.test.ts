import { describe, expect, it } from 'vitest';
import { buildSpreadsheetTables } from '@/services/spreadsheetExportService';
import type { BackupData } from '@/services/backupService';
import { DEFAULT_SETTINGS } from '@/models';

function createBackup(): BackupData {
  return {
    schemaVersion: 2,
    exportedAt: '2026-01-02T10:00:00.000Z',
    data: {
      owners: [],
      patients: [],
      appointments: [],
      assessments: [],
      sessions: [],
      communications: [],
      messageTemplates: [],
      settings: [
        {
          ...DEFAULT_SETTINGS,
          id: 'settings',
          createdAt: '2026-01-01T10:00:00.000Z',
          updatedAt: null,
          archivedAt: null,
          licenseKey: 'LICENCIA-SECRETA',
          pinHash: 'PIN-SECRETO',
          pinSalt: 'SAL-SECRETA',
          logo: 'data:image/png;base64,LOGO',
        },
      ],
    },
  };
}

describe('buildSpreadsheetTables', () => {
  it('genera una hoja por tabla y una tabla detallada de tratamientos', () => {
    const tables = buildSpreadsheetTables(createBackup());

    expect(tables.map((table) => table.sheetName)).toEqual([
      'Propietarios',
      'Pacientes',
      'Turnos',
      'Evaluaciones',
      'Sesiones',
      'Tratamientos',
      'Comunicaciones',
      'Plantillas',
      'Configuración',
    ]);
  });

  it('incluye archivados, versiones clínicas y relaciones legibles', () => {
    const backup = createBackup();
    backup.data.owners.push({
      id: 'owner-1',
      name: 'Ana Pérez',
      phone: null,
      email: null,
      address: null,
      notes: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: null,
      archivedAt: '2026-01-03T10:00:00.000Z',
    });
    backup.data.patients.push({
      id: 'patient-1',
      ownerId: 'owner-1',
      name: 'Toto',
      species: 'Perro',
      breed: 'Mixed',
      sex: 'macho',
      birthDate: '2020-05-10',
      birthDateApproximate: false,
      notes: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: null,
      archivedAt: null,
    });
    backup.data.assessments.push(
      {
        id: 'assessment-1',
        patientId: 'patient-1',
        title: 'Evaluación inicial',
        assessedAt: '2026-01-02',
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
        isLatest: false,
        createdAt: '2026-01-02T10:00:00.000Z',
        updatedAt: null,
        archivedAt: null,
      },
      {
        id: 'assessment-2',
        patientId: 'patient-1',
        title: 'Evaluación inicial',
        assessedAt: '2026-01-02',
        ownerSnapshot: null,
        patientSnapshot: null,
        referredBy: null,
        reason: null,
        diagnosis: null,
        studies: null,
        complements: null,
        medicalTreatments: null,
        additionalObservations: null,
        version: 2,
        previousVersionId: 'assessment-1',
        isLatest: true,
        createdAt: '2026-01-04T10:00:00.000Z',
        updatedAt: null,
        archivedAt: null,
      }
    );

    const tables = buildSpreadsheetTables(backup);
    const owners = tables.find((table) => table.sheetName === 'Propietarios');
    const patients = tables.find((table) => table.sheetName === 'Pacientes');
    const assessments = tables.find((table) => table.sheetName === 'Evaluaciones');

    expect(owners?.rows).toHaveLength(1);
    expect(owners?.rows[0]).toMatchObject({ archived: true, name: 'Ana Pérez' });
    expect(patients?.rows[0]).toMatchObject({
      ownerName: 'Ana Pérez',
      name: 'Toto',
    });
    expect(assessments?.rows).toHaveLength(2);
    expect(assessments?.rows.map((row) => row.version)).toEqual([1, 2]);
    expect(assessments?.rows[1]).toMatchObject({
      previousVersionId: 'assessment-1',
      isLatest: true,
    });
  });

  it('no exporta claves de licencia, hashes de PIN ni logotipos incrustados', () => {
    const tables = buildSpreadsheetTables(createBackup());
    const settings = tables.find((table) => table.sheetName === 'Configuración');
    const serialized = JSON.stringify(settings?.rows ?? []);

    expect(serialized).not.toContain('LICENCIA-SECRETA');
    expect(serialized).not.toContain('PIN-SECRETO');
    expect(serialized).not.toContain('SAL-SECRETA');
    expect(serialized).not.toContain('data:image/png');
  });
});
