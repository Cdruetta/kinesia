import type { Appointment } from '@/models';
import type { appointmentsService as AppointmentsServiceValue } from '@/services/appointmentsService';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

type AppointmentCreateData = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>;
type AppointmentsService = typeof AppointmentsServiceValue;

const ORIGINAL_ID = '11111111-1111-4111-8111-111111111111';
const BLOCKER_ID = '22222222-2222-4222-8222-222222222222';

let harness: FakeDexieHarness;
let appointmentsService: AppointmentsService;

function makeAppointmentData(
  overrides: Partial<AppointmentCreateData> = {}
): AppointmentCreateData {
  return {
    patientId: 'patient-1',
    ownerId: 'owner-1',
    startsAt: '2026-03-10T10:00:00',
    durationMinutes: 30,
    status: 'scheduled',
    reason: null,
    notes: null,
    rescheduledFrom: null,
    previousStartsAt: null,
    ...overrides,
  };
}

function makeStoredAppointment(
  id: string,
  overrides: Partial<Appointment> = {}
): Appointment {
  return {
    ...makeAppointmentData(overrides),
    id,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    archivedAt: null,
  };
}

beforeAll(async () => {
  harness = createFakeDexieHarness('appointments-transactions');
  await harness.db.open();
  vi.doMock('@/db/instance', () => ({ db: harness.db }));
  ({ appointmentsService } = await import('@/services/appointmentsService'));
});

beforeEach(async () => {
  await harness.db.appointments.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  vi.doUnmock('@/db/instance');
  vi.resetModules();
  await harness.cleanup();
});

describe('appointmentsService con transacciones reales de IndexedDB', () => {
  it('serializa dos altas simultáneas y rechaza el solapamiento', async () => {
    const results = await Promise.allSettled([
      appointmentsService.create(
        makeAppointmentData({
          patientId: 'patient-a',
          startsAt: '2026-03-10T10:00:00',
        })
      ),
      appointmentsService.create(
        makeAppointmentData({
          patientId: 'patient-b',
          startsAt: '2026-03-10T10:15:00',
        })
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      name: 'AppointmentValidationError',
      message: expect.stringMatching(/se superpone/),
    });
    expect(await harness.db.appointments.count()).toBe(1);
  });

  it('conserva dos escrituras simultáneas que no se solapan', async () => {
    const results = await Promise.allSettled([
      appointmentsService.create(
        makeAppointmentData({
          patientId: 'patient-a',
          startsAt: '2026-03-10T10:00:00',
        })
      ),
      appointmentsService.create(
        makeAppointmentData({
          patientId: 'patient-b',
          startsAt: '2026-03-10T11:00:00',
        })
      ),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    expect(await harness.db.appointments.count()).toBe(2);
  });

  it('deshace la reprogramación completa si falla la escritura del reemplazo', async () => {
    await harness.db.appointments.bulkAdd([
      makeStoredAppointment(ORIGINAL_ID, {
        startsAt: '2026-03-10T10:00:00',
      }),
      makeStoredAppointment(BLOCKER_ID, {
        patientId: 'patient-2',
        startsAt: '2026-03-10T14:00:00',
      }),
    ]);

    vi.spyOn(crypto, 'randomUUID').mockReturnValue(BLOCKER_ID);

    await expect(
      appointmentsService.reschedule(ORIGINAL_ID, '2026-03-10T12:00:00')
    ).rejects.toThrow(/No se pudo reprogramar el turno/);

    expect(await harness.db.appointments.get(ORIGINAL_ID)).toMatchObject({
      status: 'scheduled',
      notes: null,
    });
    expect(await harness.db.appointments.get(BLOCKER_ID)).toMatchObject({
      status: 'scheduled',
      startsAt: '2026-03-10T14:00:00',
    });
    expect(await harness.db.appointments.count()).toBe(2);
  });
});
