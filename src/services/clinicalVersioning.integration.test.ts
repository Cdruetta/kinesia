import type { Patient } from '@/models';
import type {
  AssessmentCreateData,
  AssessmentUpdateData,
} from '@/services/assessmentsService';
import type { SessionCreateData, SessionUpdateData } from '@/services/sessionsService';
import type { assessmentsService as AssessmentsServiceValue } from '@/services/assessmentsService';
import type { sessionsService as SessionsServiceValue } from '@/services/sessionsService';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

type AssessmentsService = typeof AssessmentsServiceValue;
type SessionsService = typeof SessionsServiceValue;

let harness: FakeDexieHarness;
let assessmentsService: AssessmentsService;
let sessionsService: SessionsService;

const patient: Patient = {
  id: 'patient-1',
  ownerId: 'owner-1',
  name: 'Paciente de prueba',
  species: 'Perro',
  breed: null,
  sex: null,
  birthDate: null,
  birthDateApproximate: false,
  notes: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: null,
  archivedAt: null,
};

function makeAssessmentData(
  overrides: Partial<AssessmentCreateData> = {}
): AssessmentCreateData {
  return {
    patientId: patient.id,
    title: 'Evaluación inicial',
    assessedAt: '2026-11-20',
    ownerSnapshot: null,
    patientSnapshot: null,
    referredBy: null,
    reason: null,
    diagnosis: null,
    studies: null,
    complements: null,
    medicalTreatments: null,
    additionalObservations: null,
    ...overrides,
  };
}

function makeAssessmentUpdate(
  overrides: Partial<AssessmentUpdateData> = {}
): AssessmentUpdateData {
  return {
    title: 'Evaluación inicial',
    assessedAt: '2026-11-20',
    ownerSnapshot: null,
    patientSnapshot: null,
    referredBy: null,
    reason: null,
    diagnosis: null,
    studies: null,
    complements: null,
    medicalTreatments: null,
    additionalObservations: null,
    ...overrides,
  };
}

function makeSessionData(overrides: Partial<SessionCreateData> = {}): SessionCreateData {
  return {
    patientId: patient.id,
    assessmentId: null,
    sessionAt: '2026-11-20T09:00:00',
    generalObservations: null,
    evolution: null,
    treatments: [],
    ...overrides,
  };
}

function makeSessionUpdate(overrides: Partial<SessionUpdateData> = {}): SessionUpdateData {
  return {
    sessionAt: '2026-11-20T09:30:00',
    generalObservations: 'Observación inicial',
    evolution: null,
    treatments: [],
    ...overrides,
  };
}

beforeAll(async () => {
  harness = createFakeDexieHarness('clinical-versioning');
  await harness.db.open();
  vi.doMock('@/db/instance', () => ({ db: harness.db }));
  ({ assessmentsService } = await import('@/services/assessmentsService'));
  ({ sessionsService } = await import('@/services/sessionsService'));
});

beforeEach(async () => {
  await harness.db.transaction(
    'rw',
    harness.db.patients,
    harness.db.assessments,
    harness.db.sessions,
    async () => {
      await harness.db.assessments.clear();
      await harness.db.sessions.clear();
      await harness.db.patients.clear();
      await harness.db.patients.add(patient);
    }
  );
});

afterAll(async () => {
  vi.doUnmock('@/db/instance');
  vi.resetModules();
  await harness.cleanup();
});

describe('versionado clínico persistido en Dexie', () => {
  it('mantiene una cadena lineal de assessments y rechaza una versión obsoleta', async () => {
    const version1 = await assessmentsService.create(makeAssessmentData());
    const version2 = await assessmentsService.update(
      version1.id,
      makeAssessmentUpdate({ diagnosis: 'Diagnóstico v2' }),
      1
    );
    const version3 = await assessmentsService.update(
      version2.id,
      makeAssessmentUpdate({ diagnosis: 'Diagnóstico v3' }),
      2
    );

    expect(version2).toMatchObject({
      version: 2,
      previousVersionId: version1.id,
      isLatest: true,
    });
    expect(version3).toMatchObject({
      version: 3,
      previousVersionId: version2.id,
      isLatest: true,
    });

    const versions = await assessmentsService.getVersions(version3.id);
    expect(versions.map((assessment) => assessment.version)).toEqual([3, 2, 1]);
    expect(versions.map((assessment) => assessment.id)).toEqual([
      version3.id,
      version2.id,
      version1.id,
    ]);
    expect(versions.map((assessment) => assessment.previousVersionId)).toEqual([
      version2.id,
      version1.id,
      null,
    ]);
    expect(versions.filter((assessment) => assessment.isLatest)).toHaveLength(1);

    await expect(
      assessmentsService.update(version3.id, makeAssessmentUpdate(), 2)
    ).rejects.toThrow(/cambió en otra pestaña/);

    expect(await harness.db.assessments.count()).toBe(3);
    expect(await harness.db.assessments.get(version1.id)).toMatchObject({ isLatest: false });
    expect(await harness.db.assessments.get(version2.id)).toMatchObject({ isLatest: false });
    expect(await harness.db.assessments.get(version3.id)).toMatchObject({ isLatest: true });
  });

  it('aplica control optimista y conserva la cadena lineal de sesiones', async () => {
    const version1 = await sessionsService.create(makeSessionData());
    const version2 = await sessionsService.update(
      version1.id,
      makeSessionUpdate({ evolution: 'Evolución v2' }),
      1
    );

    expect(version2).toMatchObject({
      version: 2,
      previousVersionId: version1.id,
      isLatest: true,
    });

    const versions = await sessionsService.getVersions(version2.id);
    expect(versions.map((session) => session.version)).toEqual([2, 1]);
    expect(versions.map((session) => session.previousVersionId)).toEqual([version1.id, null]);
    expect(versions.filter((session) => session.isLatest)).toHaveLength(1);

    await expect(
      sessionsService.update(version2.id, makeSessionUpdate(), 1)
    ).rejects.toThrow(/cambió en otra pestaña/);

    expect(await harness.db.sessions.count()).toBe(2);
    expect(await harness.db.sessions.get(version1.id)).toMatchObject({ isLatest: false });
    expect(await harness.db.sessions.get(version2.id)).toMatchObject({ isLatest: true });
  });
});
