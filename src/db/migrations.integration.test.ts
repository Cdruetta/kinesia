import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@/db/schema';
import { toLocalDateInput } from '@/utils/dates';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

const harnesses: FakeDexieHarness[] = [];

function createHarness(label: string): FakeDexieHarness {
  const harness = createFakeDexieHarness(label);
  harnesses.push(harness);
  return harness;
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.cleanup()));
});

function currentStores() {
  return {
    owners: 'id, &name, phone, createdAt, updatedAt, archivedAt',
    patients: 'id, ownerId, name, species, birthDate, createdAt, updatedAt, archivedAt',
    appointments:
      'id, patientId, ownerId, startsAt, status, durationMinutes, createdAt, updatedAt, archivedAt',
    assessments: 'id, patientId, title, assessedAt, createdAt, updatedAt, archivedAt',
    sessions: 'id, patientId, assessmentId, sessionAt, createdAt, updatedAt, archivedAt',
    communications: 'id, type, direction, contact, status, createdAt, updatedAt, archivedAt',
    messageTemplates: 'id, name, createdAt, updatedAt, archivedAt',
    settings: 'id, createdAt, updatedAt, archivedAt',
  };
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${toLocalDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

describe('migraciones reales de Dexie sobre fake-indexeddb', () => {
  it('abre una base legacy y migra sus registros hasta el esquema actual', async () => {
    const harness = createHarness('migrations');
    const legacy = new Dexie(harness.name, harness.options);
    const createdAt = '2026-11-21T01:30:00.000Z';

    legacy.version(1).stores(currentStores());

    await legacy.open();
    await legacy.table('owners').add({ id: 'owner-legacy', name: 'Dueña legacy' });
    await legacy.table('patients').add({
      id: 'patient-legacy',
      ownerId: 'owner-legacy',
      name: 'Paciente legacy',
      species: 'Perro',
    });
    await legacy.table('assessments').add({
      id: 'assessment-legacy',
      patientId: 'patient-legacy',
      createdAt,
    });
    await legacy.table('sessions').add({
      id: 'session-legacy',
      patientId: 'patient-legacy',
      createdAt,
    });
    legacy.close();

    await harness.db.open();

    expect(harness.db.verno).toBe(SCHEMA_VERSION);
    expect(await harness.db.owners.get('owner-legacy')).toMatchObject({
      id: 'owner-legacy',
      email: null,
      address: null,
      notes: null,
      archivedAt: null,
    });
    expect(await harness.db.patients.get('patient-legacy')).toMatchObject({
      breed: null,
      sex: null,
      birthDate: null,
      birthDateApproximate: false,
    });

    const expectedDate = toLocalDateInput(new Date(createdAt));
    expect(await harness.db.assessments.get('assessment-legacy')).toMatchObject({
      assessedAt: expectedDate,
      version: 1,
      previousVersionId: null,
      isLatest: true,
    });
    expect(await harness.db.sessions.get('session-legacy')).toMatchObject({
      sessionAt: `${expectedDate}T00:00:00`,
      version: 1,
      previousVersionId: null,
      isLatest: true,
      treatments: [],
    });
  });

  it('normaliza en v4 fechas clínicas ISO que ya estaban presentes', async () => {
    const harness = createHarness('migration-v4-dates');
    const legacy = new Dexie(harness.name, harness.options);
    const assessedAt = '2026-11-21T01:30:00.000Z';
    const sessionAt = '2026-11-21T01:30:45.000Z';

    legacy.version(3).stores(currentStores());

    await legacy.open();
    await legacy.table('assessments').add({
      id: 'assessment-v3',
      patientId: 'patient-v3',
      title: 'Evaluación v3',
      assessedAt,
      createdAt: assessedAt,
    });
    await legacy.table('sessions').add({
      id: 'session-v3',
      patientId: 'patient-v3',
      sessionAt,
      createdAt: sessionAt,
    });
    legacy.close();

    await harness.db.open();

    expect(harness.db.verno).toBe(4);
    expect(await harness.db.assessments.get('assessment-v3')).toMatchObject({
      assessedAt: toLocalDateInput(new Date(assessedAt)),
    });
    expect(await harness.db.sessions.get('session-v3')).toMatchObject({
      sessionAt: toLocalDateTimeInput(new Date(sessionAt)),
    });
  });

  it('revierte una migración fallida y conserva la base legacy sin cambios', async () => {
    const harness = createHarness('migration-rollback');
    const legacy = new Dexie(harness.name, harness.options);

    // Esta base muy anterior no tenía el índice único de owners.name.
    legacy.version(1).stores({ owners: 'id, name, phone' });

    await legacy.open();
    await legacy.table('owners').add({ id: 'owner-1', name: 'Nombre duplicado' });
    await legacy.table('owners').add({ id: 'owner-2', name: 'Nombre duplicado' });
    legacy.close();

    await expect(harness.db.open()).rejects.toThrow();

    const legacyAfterFailure = new Dexie(harness.name, harness.options);
    legacyAfterFailure.version(1).stores({ owners: 'id, name, phone' });
    await legacyAfterFailure.open();

    expect(legacyAfterFailure.verno).toBe(1);
    const owners = await legacyAfterFailure.table('owners').toArray();
    expect(owners).toHaveLength(2);
    expect(owners.map((owner) => owner.id)).toEqual(['owner-1', 'owner-2']);
    expect(owners[0]).not.toHaveProperty('email');
    expect(owners[0]).not.toHaveProperty('createdAt');

    legacyAfterFailure.close();
  });
});
