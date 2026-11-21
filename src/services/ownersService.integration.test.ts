import type { Owner, Patient, Settings } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';
import type { ownersService as OwnersServiceValue } from '@/services/ownersService';
import type { patientsService as PatientsServiceValue } from '@/services/patientsService';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

type OwnersService = typeof OwnersServiceValue;
type PatientsService = typeof PatientsServiceValue;

const NOW = '2026-11-20T12:00:00.000Z';

let harness: FakeDexieHarness;
let ownersService: OwnersService;
let patientsService: PatientsService;

function makeOwner(): Owner {
  return {
    id: 'owner-1',
    name: 'Ana',
    phone: null,
    email: null,
    address: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
  };
}

function makePatient(): Patient {
  return {
    id: 'patient-1',
    ownerId: 'owner-1',
    name: 'Toto',
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

function makeSettings(): Settings {
  return {
    id: 'settings',
    ...DEFAULT_SETTINGS,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
  };
}

beforeAll(async () => {
  harness = createFakeDexieHarness('owner-patient-consistency');
  await harness.db.open();
  vi.doMock('@/db/instance', () => ({ db: harness.db }));
  ({ ownersService } = await import('@/services/ownersService'));
  ({ patientsService } = await import('@/services/patientsService'));
});

beforeEach(async () => {
  await harness.db.owners.clear();
  await harness.db.patients.clear();
  await harness.db.settings.clear();
  await harness.db.owners.add(makeOwner());
  await harness.db.settings.add(makeSettings());
});

afterAll(async () => {
  vi.doUnmock('@/db/instance');
  vi.resetModules();
  await harness.cleanup();
});

describe('relación propietario-paciente', () => {
  it('no archiva un propietario con pacientes activos', async () => {
    await harness.db.patients.add(makePatient());

    await expect(ownersService.archive('owner-1')).rejects.toThrow(
      /tiene pacientes activos/
    );
    expect(await harness.db.owners.get('owner-1')).toMatchObject({
      archivedAt: null,
    });
  });

  it('serializa el archivado del propietario con el alta de un paciente', async () => {
    const results = await Promise.allSettled([
      ownersService.archive('owner-1'),
      patientsService.create({
        ownerId: 'owner-1',
        name: 'Luna',
        species: 'Gato',
        breed: null,
        sex: null,
        birthDate: null,
        birthDateApproximate: false,
        notes: null,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const owner = await harness.db.owners.get('owner-1');
    const patients = await harness.db.patients.toArray();
    if (owner?.archivedAt) {
      expect(patients).toHaveLength(0);
    } else {
      expect(patients).toHaveLength(1);
      expect(patients[0]?.archivedAt).toBeNull();
    }
  });
});
