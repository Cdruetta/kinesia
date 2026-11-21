import type { Appointment } from '@/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const records = new Map<string, Appointment>();
  const clone = (record: Appointment): Appointment => ({ ...record });

  const appointments = {
    toArray: vi.fn(async () => Array.from(records.values(), clone)),
    get: vi.fn(async (id: string) => {
      const record = records.get(id);
      return record ? clone(record) : undefined;
    }),
    add: vi.fn(async (record: Appointment) => {
      if (records.has(record.id)) throw new Error('El turno ya existe.');
      records.set(record.id, clone(record));
      return record.id;
    }),
    put: vi.fn(async (record: Appointment) => {
      records.set(record.id, clone(record));
      return record.id;
    }),
  };

  const settings = {};

  const db = {
    appointments,
    settings,
    transaction: vi.fn(
      async (_mode: string, ...args: unknown[]) => {
        const work = args.at(-1) as (tx: unknown) => Promise<unknown>;
        const tx = {
          table: (name: string) => (name === 'appointments' ? appointments : settings),
        };
        const snapshot = new Map(Array.from(records.entries(), ([id, record]) => [id, clone(record)]));
        try {
          return await work(tx);
        } catch (error) {
          records.clear();
          snapshot.forEach((record, id) => records.set(id, clone(record)));
          throw error;
        }
      }
    ),
  };

  return { records, db };
});

vi.mock('@/db/instance', () => ({ db: mocks.db }));
vi.mock('@/services/licenseLimitsService', () => ({
  assertCanCreateLimitedRecord: vi.fn(async () => undefined),
  DemoLimitExceededError: class DemoLimitExceededError extends Error {},
}));

import { appointmentsService } from '@/services/appointmentsService';

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    patientId: 'patient-1',
    ownerId: 'owner-1',
    startsAt: '2026-03-10T10:00:00',
    durationMinutes: 30,
    status: 'scheduled',
    reason: null,
    notes: null,
    rescheduledFrom: null,
    previousStartsAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    archivedAt: null,
    ...overrides,
  };
}

function createData(overrides: Partial<Appointment> = {}) {
  const appointment = makeAppointment(overrides);
  return {
    patientId: appointment.patientId,
    ownerId: appointment.ownerId,
    startsAt: appointment.startsAt,
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
    rescheduledFrom: appointment.rescheduledFrom,
    previousStartsAt: appointment.previousStartsAt,
  };
}

beforeEach(() => {
  mocks.records.clear();
  mocks.db.transaction.mockClear();
  mocks.db.appointments.toArray.mockClear();
  mocks.db.appointments.get.mockClear();
  mocks.db.appointments.add.mockClear();
  mocks.db.appointments.put.mockClear();
});

describe('appointmentsService', () => {
  it('crea dentro de una transacción rw y rechaza un solapamiento', async () => {
    mocks.records.set('existing', makeAppointment());

    await expect(
      appointmentsService.create(
        createData({
          id: 'candidate',
          startsAt: '2026-03-10T10:15:00',
        })
      )
    ).rejects.toThrow(/se superpone/);

    expect(mocks.db.transaction).toHaveBeenCalledWith(
      'rw',
      mocks.db.appointments,
      mocks.db.settings,
      expect.any(Function)
    );
    expect(mocks.records.size).toBe(1);
  });

  it('no bloquea por un turno archivado ni por un turno completado', async () => {
    mocks.records.set(
      'archived',
      makeAppointment({
        archivedAt: '2026-03-02T10:00:00.000Z',
      })
    );
    mocks.records.set(
      'completed',
      makeAppointment({
        id: 'completed',
        status: 'completed',
      })
    );

    await expect(
      appointmentsService.create(
        createData({
          id: 'candidate',
          startsAt: '2026-03-10T10:15:00',
        })
      )
    ).resolves.toMatchObject({ startsAt: '2026-03-10T10:15:00' });
  });

  it('detecta conflictos al cruzar medianoche en create', async () => {
    mocks.records.set(
      'previous-day',
      makeAppointment({
        startsAt: '2026-03-09T23:30:00',
        durationMinutes: 60,
      })
    );

    await expect(
      appointmentsService.create(
        createData({
          id: 'candidate',
          startsAt: '2026-03-10T00:15:00',
        })
      )
    ).rejects.toThrow(/se superpone/);
  });

  it('detecta un turno del día siguiente cuando el candidato invade medianoche', async () => {
    mocks.records.set(
      'next-day',
      makeAppointment({
        startsAt: '2026-03-11T00:15:00',
        durationMinutes: 30,
      })
    );

    await expect(
      appointmentsService.create(
        createData({
          id: 'candidate',
          startsAt: '2026-03-10T23:45:00',
          durationMinutes: 60,
        })
      )
    ).rejects.toThrow(/se superpone/);
  });

  it('rechaza una duración mayor a 480 minutos', async () => {
    await expect(
      appointmentsService.create(
        createData({
          durationMinutes: 481,
        })
      )
    ).rejects.toThrow(/480/);

    expect(mocks.records.size).toBe(0);
  });

  it('actualiza dentro de una transacción rw y no muta el turno ante un conflicto', async () => {
    const original = makeAppointment({ id: 'target', startsAt: '2026-03-10T12:00:00' });
    mocks.records.set('target', original);
    mocks.records.set('existing', makeAppointment());

    await expect(
      appointmentsService.update('target', { startsAt: '2026-03-10T10:15:00' })
    ).rejects.toThrow(/se superpone/);

    expect(mocks.records.get('target')).toEqual(original);
    expect(mocks.db.transaction).toHaveBeenCalledWith(
      'rw',
      mocks.db.appointments,
      expect.any(Function)
    );
  });

  it('permite actualizar a un horario contiguo', async () => {
    mocks.records.set('existing', makeAppointment());
    mocks.records.set(
      'target',
      makeAppointment({ id: 'target', startsAt: '2026-03-10T12:00:00' })
    );

    await expect(
      appointmentsService.update('target', { startsAt: '2026-03-10T10:30:00' })
    ).resolves.toMatchObject({ startsAt: '2026-03-10T10:30:00' });
  });

  it('rechaza en update una duración mayor a 480 minutos sin modificar el turno', async () => {
    const original = makeAppointment({ id: 'target' });
    mocks.records.set('target', original);

    await expect(
      appointmentsService.update('target', { durationMinutes: 481 })
    ).rejects.toThrow(/480/);

    expect(mocks.records.get('target')).toEqual(original);
  });

  it('reprograma de forma atómica y no cancela el original si hay conflicto', async () => {
    const original = makeAppointment({ id: 'original', startsAt: '2026-03-10T10:00:00' });
    mocks.records.set('original', original);
    mocks.records.set(
      'existing',
      makeAppointment({ id: 'existing', startsAt: '2026-03-10T12:00:00' })
    );

    await expect(
      appointmentsService.reschedule('original', '2026-03-10T12:15:00')
    ).rejects.toThrow(/se superpone/);

    expect(mocks.records.get('original')).toEqual(original);
    expect(mocks.records.size).toBe(2);
    expect(mocks.db.transaction).toHaveBeenCalledWith(
      'rw',
      mocks.db.appointments,
      mocks.db.settings,
      expect.any(Function)
    );
  });

  it('reprograma sin bloquear por el turno original y conserva ambos registros', async () => {
    mocks.records.set(
      'original',
      makeAppointment({
        id: 'original',
        startsAt: '2026-03-10T10:00:00',
        reason: 'Control semanal',
        notes: 'Traer radiografía',
      })
    );

    const result = await appointmentsService.reschedule('original', '2026-03-10T10:00:00');

    expect(result.original).toMatchObject({
      id: 'original',
      status: 'cancelled',
      startsAt: '2026-03-10T10:00:00',
    });
    expect(result.newAppointment).toMatchObject({
      patientId: 'patient-1',
      ownerId: 'owner-1',
      startsAt: '2026-03-10T10:00:00',
      durationMinutes: 30,
      status: 'scheduled',
      reason: 'Control semanal',
      notes: 'Traer radiografía',
      rescheduledFrom: 'original',
      previousStartsAt: '2026-03-10T10:00:00',
    });
    expect(mocks.records.size).toBe(2);
  });

  it('crea un reemplazo completo con los datos actualizados de la interfaz', async () => {
    mocks.records.set(
      'original',
      makeAppointment({ id: 'original', startsAt: '2026-03-10T10:00:00' })
    );

    const result = await appointmentsService.reschedule(
      'original',
      '2026-03-12T14:30:00',
      45,
      {
        patientId: 'patient-2',
        ownerId: 'owner-2',
        reason: 'Evaluación',
        notes: 'Indicado por el propietario',
      }
    );

    expect(result.newAppointment).toMatchObject({
      patientId: 'patient-2',
      ownerId: 'owner-2',
      startsAt: '2026-03-12T14:30:00',
      durationMinutes: 45,
      status: 'scheduled',
      reason: 'Evaluación',
      notes: 'Indicado por el propietario',
      rescheduledFrom: 'original',
      previousStartsAt: '2026-03-10T10:00:00',
    });
  });

  it('revierte la cancelación del original si falla la creación del reemplazo', async () => {
    const original = makeAppointment({ id: 'original', startsAt: '2026-03-10T10:00:00' });
    mocks.records.set('original', original);
    mocks.db.appointments.add.mockRejectedValueOnce(new Error('No se pudo guardar.'));

    await expect(
      appointmentsService.reschedule('original', '2026-03-12T14:30:00')
    ).rejects.toThrow(/No se pudo reprogramar el turno/);

    expect(mocks.records.get('original')).toEqual(original);
    expect(mocks.records.size).toBe(1);
  });

  it('rechaza en reprogramación una duración mayor a 480 minutos', async () => {
    const original = makeAppointment({ id: 'original' });
    mocks.records.set('original', original);

    await expect(
      appointmentsService.reschedule('original', '2026-03-10T11:00:00', 481)
    ).rejects.toThrow(/480/);

    expect(mocks.records.get('original')).toEqual(original);
  });
});
