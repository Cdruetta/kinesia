import { describe, expect, it } from 'vitest';
import { migrateLegacyTable } from '@/db/migrations';
import { DEFAULT_SETTINGS } from '@/models';
import { toLocalDateInput } from '@/utils/dates';

describe('migrateLegacyTable', () => {
  it('completa campos antiguos de propietarios y pacientes', () => {
    const [owner] = migrateLegacyTable('owners', [{ id: 'owner-1', name: 'Ana' }]);
    const [patient] = migrateLegacyTable('patients', [{ id: 'patient-1', ownerId: 'owner-1', name: 'Toto', species: 'Perro' }]);

    expect(owner).toMatchObject({ email: null, address: null, notes: null });
    expect(patient).toMatchObject({ breed: null, sex: null, birthDate: null, birthDateApproximate: false, notes: null });
  });

  it('inicializa el versionado de assessments y sesiones', () => {
    const [assessment] = migrateLegacyTable('assessments', [{ id: 'assessment-1', patientId: 'patient-1' }]);
    const [session] = migrateLegacyTable('sessions', [{ id: 'session-1', patientId: 'patient-1' }]);

    expect(assessment).toMatchObject({ version: 1, previousVersionId: null, isLatest: true });
    expect(session).toMatchObject({ version: 1, previousVersionId: null, isLatest: true, treatments: [] });
  });

  it('convierte fechas clínicas legacy a la fecha local', () => {
    const createdAt = '2026-11-21T01:30:00.000Z';
    const expectedDate = toLocalDateInput(new Date(createdAt));
    const [assessment] = migrateLegacyTable('assessments', [
      { id: 'assessment-1', patientId: 'patient-1', createdAt },
    ]);
    const [session] = migrateLegacyTable('sessions', [
      { id: 'session-1', patientId: 'patient-1', createdAt },
    ]);

    expect(assessment).toMatchObject({ assessedAt: expectedDate });
    expect(session).toMatchObject({ sessionAt: `${expectedDate}T00:00:00` });
  });

  it('restaura la configuración predeterminada completa', () => {
    const [settings] = migrateLegacyTable('settings', [{ id: 'settings', clinicName: 'Clínica' }]);

    expect(settings).toMatchObject({
      id: 'settings',
      clinicName: 'Clínica',
      printLogo: DEFAULT_SETTINGS.printLogo,
      printFooter: DEFAULT_SETTINGS.printFooter,
      followUpDays: DEFAULT_SETTINGS.followUpDays,
      theme: DEFAULT_SETTINGS.theme,
      isLicensed: false,
      pinEnabled: false,
    });
    expect(settings).toHaveProperty('hours');
  });

  it('no reemplaza valores que ya existen', () => {
    const [owner] = migrateLegacyTable('owners', [{ id: 'owner-1', name: 'Ana', email: 'ana@example.com' }]);
    expect(owner).toMatchObject({ email: 'ana@example.com' });
  });
});
