import type { Appointment, Owner, Patient, Settings } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';
import type { ownersService as OwnersServiceValue } from '@/services/ownersService';
import type { patientsService as PatientsServiceValue } from '@/services/patientsService';
import type { appointmentsService as AppointmentsServiceValue } from '@/services/appointmentsService';
import type { backupService as BackupServiceValue } from '@/services/backupService';
import type { assertCanCreateLimitedRecord as AssertCanCreateLimitedRecordFn } from '@/services/licenseLimitsService';
import type * as LicenseServiceModule from '@/services/licenseService';
import { KinesiaDB } from '@/db/instance';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

type OwnersService = typeof OwnersServiceValue;
type PatientsService = typeof PatientsServiceValue;
type AppointmentsService = typeof AppointmentsServiceValue;
type BackupService = typeof BackupServiceValue;
type AssertCanCreateLimitedRecord = typeof AssertCanCreateLimitedRecordFn;

const VALID_LICENSE_CODE = 'KIN-2099-X7QABC';
const NOW = '2026-11-20T12:00:00.000Z';

let harness: FakeDexieHarness;
let ownersService: OwnersService;
let patientsService: PatientsService;
let appointmentsService: AppointmentsService;
let backupService: BackupService;
let assertCanCreateLimitedRecord: AssertCanCreateLimitedRecord;

function makeOwner(id: string, name: string, archivedAt: string | null = null): Owner {
  return {
    id,
    name,
    phone: null,
    email: null,
    address: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt,
  };
}

function makePatient(id: string, ownerId: string): Patient {
  return {
    id,
    ownerId,
    name: `Paciente ${id}`,
    species: 'Perro',
    breed: null,
    sex: null,
    birthDate: null,
    birthDateApproximate: false,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
  };
}

function makeAppointment(
  id: string,
  patientId: string,
  startsAt: string,
  archivedAt: string | null = null
): Appointment {
  return {
    id,
    patientId,
    ownerId: 'owner-1',
    startsAt,
    durationMinutes: 30,
    status: 'scheduled',
    reason: null,
    notes: null,
    rescheduledFrom: null,
    previousStartsAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'settings',
    ...DEFAULT_SETTINGS,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  };
}

function makeBackup(
  owners: Array<Record<string, unknown>>,
  settings: Record<string, unknown> = {}
) {
  const result = backupService.validateBackup(
    JSON.stringify({
      schemaVersion: 2,
      exportedAt: NOW,
      data: {
        owners,
        patients: [],
        appointments: [],
        assessments: [],
        sessions: [],
        communications: [],
        messageTemplates: [],
        settings: [{ id: 'settings', ...settings }],
      },
    })
  );

  if (!result.valid || !result.data) {
    throw new Error(result.error ?? 'El respaldo de prueba no es válido.');
  }
  return result.data;
}

beforeAll(async () => {
  harness = createFakeDexieHarness('license-limits');
  await harness.db.open();

  vi.doMock('@/db/instance', () => ({ db: harness.db }));
  vi.doMock('@/services/licenseService', async () => {
    const actual = await vi.importActual<typeof LicenseServiceModule>(
      '@/services/licenseService'
    );
    const validHash = await actual.licenseService.hashLicense(VALID_LICENSE_CODE);
    return {
      ...actual,
      licenseService: actual.createLicenseService([validHash]),
    };
  });

  ({ ownersService } = await import('@/services/ownersService'));
  ({ patientsService } = await import('@/services/patientsService'));
  ({ appointmentsService } = await import('@/services/appointmentsService'));
  ({ backupService } = await import('@/services/backupService'));
  ({ assertCanCreateLimitedRecord } = await import(
    '@/services/licenseLimitsService'
  ));
});

beforeEach(async () => {
  await harness.db.transaction(
    'rw',
    [
      harness.db.owners,
      harness.db.patients,
      harness.db.appointments,
      harness.db.assessments,
      harness.db.sessions,
      harness.db.communications,
      harness.db.messageTemplates,
      harness.db.settings,
    ],
    async () => {
      await harness.db.owners.clear();
      await harness.db.patients.clear();
      await harness.db.appointments.clear();
      await harness.db.assessments.clear();
      await harness.db.sessions.clear();
      await harness.db.communications.clear();
      await harness.db.messageTemplates.clear();
      await harness.db.settings.clear();
    }
  );
});

afterAll(async () => {
  vi.doUnmock('@/db/instance');
  vi.doUnmock('@/services/licenseService');
  vi.resetModules();
  await harness.cleanup();
});

describe('límites demo en servicios transaccionales', () => {
  it('rechaza crear un propietario cuando ya hay tres no archivados', async () => {
    await harness.db.owners.bulkAdd([
      makeOwner('owner-1', 'Ana'),
      makeOwner('owner-2', 'Beto'),
      makeOwner('owner-3', 'Caro'),
    ]);

    await expect(
      ownersService.create({
        name: 'Diego',
        phone: null,
        email: null,
        address: null,
        notes: null,
      })
    ).rejects.toMatchObject({
      name: 'DemoLimitExceededError',
      resource: 'owners',
      limit: 3,
    });

    expect(await harness.db.owners.count()).toBe(3);
  });

  it('no cuenta propietarios archivados y permite completar el cupo activo', async () => {
    await harness.db.owners.bulkAdd([
      makeOwner('owner-1', 'Ana'),
      makeOwner('owner-2', 'Beto'),
      makeOwner('archived-1', 'Caro archivado', NOW),
      makeOwner('archived-2', 'Dora archivada', NOW),
    ]);

    await expect(
      ownersService.create({
        name: 'Caro',
        phone: null,
        email: null,
        address: null,
        notes: null,
      })
    ).resolves.toMatchObject({ name: 'Caro', archivedAt: null });

    const activeOwners = await harness.db.owners.toArray();
    expect(activeOwners.filter((owner) => !owner.archivedAt)).toHaveLength(3);
  });

  it('aplica el mismo límite transaccional a pacientes y turnos', async () => {
    await harness.db.owners.add(makeOwner('owner-1', 'Ana'));
    await harness.db.patients.bulkAdd([
      makePatient('patient-1', 'owner-1'),
      makePatient('patient-2', 'owner-1'),
      makePatient('patient-3', 'owner-1'),
      makePatient('patient-4', 'owner-1'),
      makePatient('patient-5', 'owner-1'),
    ]);
    await harness.db.appointments.bulkAdd([
      makeAppointment('appointment-1', 'patient-1', '2026-03-10T09:00:00'),
      makeAppointment('appointment-2', 'patient-1', '2026-03-10T10:00:00'),
      makeAppointment('appointment-3', 'patient-1', '2026-03-10T11:00:00'),
    ]);

    await expect(
      patientsService.create({
        ownerId: 'owner-1',
        name: 'Paciente 6',
        species: 'Perro',
        breed: null,
        sex: null,
        birthDate: null,
        birthDateApproximate: false,
        notes: null,
      })
    ).rejects.toMatchObject({ resource: 'patients', limit: 5 });

    await expect(
      appointmentsService.create({
        patientId: 'patient-1',
        ownerId: 'owner-1',
        startsAt: '2026-03-10T12:00:00',
        durationMinutes: 30,
        status: 'scheduled',
        reason: null,
        notes: null,
        rescheduledFrom: null,
        previousStartsAt: null,
      })
    ).rejects.toMatchObject({ resource: 'appointments', limit: 3 });

    expect(await harness.db.patients.count()).toBe(5);
    expect(await harness.db.appointments.count()).toBe(3);
  });

  it('rechaza desarchivar un propietario cuando el cupo activo ya está completo', async () => {
    await harness.db.owners.bulkAdd([
      makeOwner('owner-1', 'Ana'),
      makeOwner('owner-2', 'Beto'),
      makeOwner('owner-3', 'Caro'),
      makeOwner('owner-archived', 'Dora archivada', NOW),
    ]);

    await expect(ownersService.restore('owner-archived')).rejects.toMatchObject({
      name: 'DemoLimitExceededError',
      resource: 'owners',
      limit: 3,
    });

    expect(await harness.db.owners.get('owner-archived')).toMatchObject({
      archivedAt: NOW,
    });
  });

  it('revoca el estado premium manipulado si no existe un código de licencia', async () => {
    await harness.db.settings.add(
      makeSettings({
        isLicensed: true,
        licenseKey: null,
      })
    );

    await expect(
      ownersService.create({
        name: 'Ana',
        phone: null,
        email: null,
        address: null,
        notes: null,
      })
    ).resolves.toMatchObject({ name: 'Ana' });

    expect(await harness.db.settings.get('settings')).toMatchObject({
      isLicensed: false,
      licenseKey: null,
    });
  });

  it('permite superar el límite cuando la licencia se valida dentro de la transacción', async () => {
    await harness.db.owners.bulkAdd([
      makeOwner('owner-1', 'Ana'),
      makeOwner('owner-2', 'Beto'),
      makeOwner('owner-3', 'Caro'),
    ]);
    await harness.db.settings.add(
      makeSettings({
        isLicensed: true,
        licenseKey: VALID_LICENSE_CODE,
      })
    );

    await expect(
      ownersService.create({
        name: 'Diego',
        phone: null,
        email: null,
        address: null,
        notes: null,
      })
    ).resolves.toMatchObject({ name: 'Diego' });

    expect(await harness.db.owners.count()).toBe(4);
    expect(await harness.db.settings.get('settings')).toMatchObject({
      isLicensed: true,
      licenseKey: VALID_LICENSE_CODE,
    });
  });

  it('serializa altas desde dos conexiones y sólo permite una hasta el límite', async () => {
    await harness.db.owners.bulkAdd([
      makeOwner('owner-1', 'Ana'),
      makeOwner('owner-2', 'Beto'),
    ]);

    const secondDb = new KinesiaDB(harness.name, harness.options);
    await secondDb.open();

    const createOwner = (db: KinesiaDB, id: string, name: string) =>
      db.transaction('rw', db.owners, db.settings, async (tx) => {
        await assertCanCreateLimitedRecord(tx, 'owners');
        await db.owners.add(makeOwner(id, name));
      });

    const results = await Promise.allSettled([
      createOwner(harness.db, 'owner-3', 'Caro'),
      createOwner(secondDb, 'owner-4', 'Diego'),
    ]);
    secondDb.close();

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (results.find((result) => result.status === 'rejected') as PromiseRejectedResult)
        .reason
    ).toMatchObject({ name: 'DemoLimitExceededError' });
    expect(await harness.db.owners.count()).toBe(3);
  });
});

describe('límites demo al reprogramar', () => {
  it('permite una reprogramación neutra 3→3', async () => {
    await harness.db.appointments.bulkAdd([
      makeAppointment('appointment-1', 'patient-1', '2026-03-10T09:00:00'),
      makeAppointment('appointment-2', 'patient-1', '2026-03-10T10:00:00'),
      makeAppointment('appointment-3', 'patient-1', '2026-03-10T11:00:00'),
    ]);

    const result = await appointmentsService.reschedule(
      'appointment-1',
      '2026-03-10T12:00:00'
    );

    expect(result.original.status).toBe('cancelled');
    expect(result.newAppointment.status).toBe('scheduled');
    expect(await harness.db.appointments.count()).toBe(4);
    // La cancelación no archiva el original: ambos registros siguen contando
    // como no archivados. La operación es neutra para la aserción porque el
    // ID reemplazado se excluye explícitamente del delta.
    expect(
      (await harness.db.appointments.toArray()).filter(
        (appointment) => !appointment.archivedAt
      )
    ).toHaveLength(4);
  });

  it('rechaza un reemplazo que agrega un turno y revierte la cancelación', async () => {
    const original = makeAppointment(
      'appointment-original',
      'patient-1',
      '2026-03-10T09:00:00'
    );
    await harness.db.appointments.bulkAdd([
      original,
      makeAppointment('appointment-2', 'patient-1', '2026-03-10T10:00:00'),
      makeAppointment('appointment-3', 'patient-1', '2026-03-10T11:00:00'),
      makeAppointment('appointment-4', 'patient-1', '2026-03-10T12:00:00'),
    ]);

    await expect(
      appointmentsService.reschedule(
        'appointment-original',
        '2026-03-10T13:00:00'
      )
    ).rejects.toMatchObject({ name: 'DemoLimitExceededError' });

    expect(await harness.db.appointments.get('appointment-original')).toMatchObject({
      status: 'scheduled',
      notes: null,
    });
    expect(await harness.db.appointments.count()).toBe(4);
  });

  it('rechaza reprogramar un original archivado porque el reemplazo sí agrega un registro', async () => {
    await harness.db.appointments.bulkAdd([
      makeAppointment('appointment-1', 'patient-1', '2026-03-10T09:00:00'),
      makeAppointment('appointment-2', 'patient-1', '2026-03-10T10:00:00'),
      makeAppointment('appointment-3', 'patient-1', '2026-03-10T11:00:00'),
      makeAppointment(
        'appointment-archived',
        'patient-1',
        '2026-03-10T12:00:00',
        NOW
      ),
    ]);

    await expect(
      appointmentsService.reschedule(
        'appointment-archived',
        '2026-03-10T13:00:00'
      )
    ).rejects.toMatchObject({ name: 'DemoLimitExceededError' });

    expect(await harness.db.appointments.get('appointment-archived')).toMatchObject({
      status: 'scheduled',
      archivedAt: NOW,
      notes: null,
    });
    expect(await harness.db.appointments.count()).toBe(4);
  });
});

describe('restauración JSON y límites demo', () => {
  it('rechaza atómicamente un respaldo que excede el límite y conserva la base actual', async () => {
    await harness.db.owners.add(makeOwner('owner-current', 'Dueño actual'));
    const backup = makeBackup([
      { id: 'owner-1', name: 'Ana', phone: null },
      { id: 'owner-2', name: 'Beto', phone: null },
      { id: 'owner-3', name: 'Caro', phone: null },
      { id: 'owner-4', name: 'Diego', phone: null },
    ]);

    await expect(backupService.restoreAll(backup)).rejects.toMatchObject({
      name: 'DemoLimitExceededError',
      resource: 'owners',
      limit: 3,
      currentCount: 4,
    });

    expect(await harness.db.owners.toArray()).toEqual([
      makeOwner('owner-current', 'Dueño actual'),
    ]);
  });

  it('permite restaurar un respaldo demo dentro del límite y conserva los archivados', async () => {
    const backup = makeBackup([
      { id: 'owner-1', name: 'Ana', phone: null },
      { id: 'owner-2', name: 'Beto', phone: null },
      { id: 'owner-3', name: 'Caro', phone: null },
      {
        id: 'archived-1',
        name: 'Dora archivada',
        phone: null,
        archivedAt: NOW,
      },
      {
        id: 'archived-2',
        name: 'Elena archivada',
        phone: null,
        archivedAt: NOW,
      },
    ]);

    await expect(backupService.restoreAll(backup)).resolves.toBe(false);

    const owners = await harness.db.owners.toArray();
    expect(owners).toHaveLength(5);
    expect(owners.filter((owner) => !owner.archivedAt)).toHaveLength(3);
    expect(owners.filter((owner) => owner.archivedAt)).toHaveLength(2);
  });

  it('restaura sin límites un respaldo con licencia válida', async () => {
    const backup = makeBackup(
      [
        { id: 'owner-1', name: 'Ana', phone: null },
        { id: 'owner-2', name: 'Beto', phone: null },
        { id: 'owner-3', name: 'Caro', phone: null },
        { id: 'owner-4', name: 'Diego', phone: null },
      ],
      {
        isLicensed: true,
        licenseKey: VALID_LICENSE_CODE,
      }
    );

    await expect(backupService.restoreAll(backup)).resolves.toBe(false);

    expect(await harness.db.owners.count()).toBe(4);
    expect(await harness.db.settings.get('settings')).toMatchObject({
      isLicensed: true,
      licenseKey: VALID_LICENSE_CODE,
    });
  });
});
