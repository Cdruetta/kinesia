import { describe, expect, it } from 'vitest';
import {
  MAX_APPOINTMENT_DURATION_MINUTES,
  appointmentSlot,
  findNextFreeSlot,
  findOverlappingAppointment,
  isBlockingAppointmentStatus,
  isValidAppointmentDuration,
  isWithinClinicHours,
  slotsOverlap,
  toLocalISO,
  startOfDay,
  endOfDay,
} from '@/utils/appointmentValidation';

describe('appointmentValidation', () => {
  describe('slotsOverlap', () => {
    it('detecta solapamiento completo', () => {
      const a = appointmentSlot('2026-03-10T10:00:00', 30);
      const b = appointmentSlot('2026-03-10T10:15:00', 30);
      expect(slotsOverlap(a, b)).toBe(true);
    });

    it('no solapa cuando uno termina cuando otro empieza', () => {
      const a = appointmentSlot('2026-03-10T10:00:00', 30);
      const b = appointmentSlot('2026-03-10T10:30:00', 30);
      expect(slotsOverlap(a, b)).toBe(false);
    });

    it('no solapa cuando uno empieza después de que el otro termina', () => {
      const a = appointmentSlot('2026-03-10T10:00:00', 30);
      const b = appointmentSlot('2026-03-10T11:00:00', 30);
      expect(slotsOverlap(a, b)).toBe(false);
    });

    it('detecta solapamiento con duración larga', () => {
      const a = appointmentSlot('2026-03-10T09:00:00', 120);
      const b = appointmentSlot('2026-03-10T10:00:00', 30);
      expect(slotsOverlap(a, b)).toBe(true);
    });
  });

  describe('findOverlappingAppointment', () => {
    const turns = [
      { id: '1', startsAt: '2026-03-10T10:00:00', durationMinutes: 30, status: 'confirmed' },
      { id: '2', startsAt: '2026-03-10T11:00:00', durationMinutes: 45, status: 'scheduled' },
    ];

    it('encuentra conflicto con turno existente', () => {
      const candidate = { startsAt: '2026-03-10T10:15:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(turns, candidate);
      expect(conflict?.id).toBe('1');
    });

    it('no encuentra conflicto si no hay solapamiento', () => {
      const candidate = { startsAt: '2026-03-10T10:30:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(turns, candidate);
      expect(conflict).toBeNull();
    });

    it('permite turno que empieza cuando otro termina', () => {
      const candidate = { startsAt: '2026-03-10T10:30:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(turns, candidate);
      expect(conflict).toBeNull();
    });

    it('ignora turnos cancelados', () => {
      const turnsWithCancelled = [
        { id: '3', startsAt: '2026-03-10T10:00:00', durationMinutes: 60, status: 'cancelled' },
      ];
      const candidate = { startsAt: '2026-03-10T10:15:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(turnsWithCancelled, candidate);
      expect(conflict).toBeNull();
    });

    it('ignora turnos ausentes', () => {
      const turnsWithNoShow = [
        { id: '4', startsAt: '2026-03-10T10:00:00', durationMinutes: 60, status: 'no-show' },
      ];
      const candidate = { startsAt: '2026-03-10T10:15:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(turnsWithNoShow, candidate);
      expect(conflict).toBeNull();
    });

    it('ignora turnos realizados', () => {
      const completedTurns = [
        { id: '5', startsAt: '2026-03-10T10:00:00', durationMinutes: 60, status: 'completed' },
      ];
      const candidate = { startsAt: '2026-03-10T10:15:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(completedTurns, candidate);
      expect(conflict).toBeNull();
    });

    it('permite guardar un turno realizado que se superpone', () => {
      const candidate = {
        startsAt: '2026-03-10T10:15:00',
        durationMinutes: 30,
        status: 'completed',
      };
      const conflict = findOverlappingAppointment(turns, candidate);
      expect(conflict).toBeNull();
    });

    it('ignora el mismo turno (edición)', () => {
      const candidate = { id: '1', startsAt: '2026-03-10T10:15:00', durationMinutes: 30 };
      const conflict = findOverlappingAppointment(turns, candidate);
      expect(conflict).toBeNull();
    });

    it('detecta conflicto con duración larga', () => {
      const candidate = { startsAt: '2026-03-10T09:30:00', durationMinutes: 90 };
      const conflict = findOverlappingAppointment(turns, candidate);
      expect(conflict?.id).toBe('1');
    });

    it('detecta un turno previo que invade el día candidato al cruzar medianoche', () => {
      const previousDayTurn = [
        {
          id: 'previous-day',
          startsAt: '2026-03-09T23:30:00',
          durationMinutes: 60,
          status: 'scheduled',
        },
      ];
      const candidate = { startsAt: '2026-03-10T00:15:00', durationMinutes: 30 };

      expect(findOverlappingAppointment(previousDayTurn, candidate)?.id).toBe('previous-day');
    });

    it('detecta un turno del día siguiente cuando el candidato invade medianoche', () => {
      const nextDayTurn = [
        {
          id: 'next-day',
          startsAt: '2026-03-11T00:15:00',
          durationMinutes: 30,
          status: 'confirmed',
        },
      ];
      const candidate = { startsAt: '2026-03-10T23:45:00', durationMinutes: 60 };

      expect(findOverlappingAppointment(nextDayTurn, candidate)?.id).toBe('next-day');
    });

    it('no bloquea un turno contiguo que termina exactamente a medianoche', () => {
      const previousDayTurn = [
        {
          id: 'previous-day',
          startsAt: '2026-03-09T23:30:00',
          durationMinutes: 30,
          status: 'scheduled',
        },
      ];
      const candidate = { startsAt: '2026-03-10T00:00:00', durationMinutes: 30 };

      expect(findOverlappingAppointment(previousDayTurn, candidate)).toBeNull();
    });

    it('no bloquea un turno del día siguiente si el candidato termina a medianoche', () => {
      const nextDayTurn = [
        {
          id: 'next-day',
          startsAt: '2026-03-11T00:00:00',
          durationMinutes: 30,
          status: 'scheduled',
        },
      ];
      const candidate = { startsAt: '2026-03-10T23:30:00', durationMinutes: 30 };

      expect(findOverlappingAppointment(nextDayTurn, candidate)).toBeNull();
    });

    it('ignora turnos archivados', () => {
      const archivedTurn = [
        {
          id: 'archived',
          startsAt: '2026-03-10T10:00:00',
          durationMinutes: 60,
          status: 'confirmed',
          archivedAt: '2026-03-10T08:00:00',
        },
      ];
      const candidate = { startsAt: '2026-03-10T10:15:00', durationMinutes: 30 };

      expect(findOverlappingAppointment(archivedTurn, candidate)).toBeNull();
    });
  });

  describe('validación de duración y estados bloqueantes', () => {
    it('acepta una duración de hasta 480 minutos y rechaza una mayor', () => {
      expect(MAX_APPOINTMENT_DURATION_MINUTES).toBe(480);
      expect(isValidAppointmentDuration(480)).toBe(true);
      expect(isValidAppointmentDuration(481)).toBe(false);
      expect(isValidAppointmentDuration(0)).toBe(false);
    });

    it('sólo scheduled y confirmed bloquean el horario', () => {
      expect(isBlockingAppointmentStatus('scheduled')).toBe(true);
      expect(isBlockingAppointmentStatus('confirmed')).toBe(true);
      expect(isBlockingAppointmentStatus('completed')).toBe(false);
      expect(isBlockingAppointmentStatus('cancelled')).toBe(false);
      expect(isBlockingAppointmentStatus('no-show')).toBe(false);
    });
  });

  describe('isWithinClinicHours', () => {
    const hours = {
      0: { open: '09:00', close: '14:00', closed: false },
      1: { open: '09:00', close: '18:00', closed: false },
      2: { open: '09:00', close: '18:00', closed: false },
      3: { open: '09:00', close: '18:00', closed: false },
      4: { open: '09:00', close: '18:00', closed: false },
      5: { open: '09:00', close: '13:00', closed: false },
      6: { open: '00:00', close: '00:00', closed: true },
    };

    it('dentro de horario', () => {
      expect(isWithinClinicHours('2026-03-10T10:00:00', 30, hours)).toBe(true);
    });

    it('fuera de horario (antes de abrir)', () => {
      expect(isWithinClinicHours('2026-03-10T08:00:00', 30, hours)).toBe(false);
    });

    it('fuera de horario (después de cerrar)', () => {
      expect(isWithinClinicHours('2026-03-10T17:45:00', 30, hours)).toBe(false);
    });

    it('fuera de horario (día cerrado)', () => {
      const closedHours = { ...hours, 0: { open: '00:00', close: '00:00', closed: true } };
      const sunday = new Date(2026, 2, 8); // domingo
      const iso = toLocalISO(sunday);
      expect(isWithinClinicHours(iso.replace('T00:00:00', 'T10:00:00'), 30, closedHours)).toBe(false);
    });

    it('turno que termina exactamente en el cierre está dentro', () => {
      expect(isWithinClinicHours('2026-03-10T17:30:00', 30, hours)).toBe(true);
    });
  });

  describe('findNextFreeSlot', () => {
    const hours = {
      0: { open: '09:00', close: '14:00', closed: false },
      1: { open: '09:00', close: '18:00', closed: false },
      2: { open: '09:00', close: '18:00', closed: false },
      3: { open: '09:00', close: '18:00', closed: false },
      4: { open: '09:00', close: '18:00', closed: false },
      5: { open: '09:00', close: '13:00', closed: false },
      6: { open: '00:00', close: '00:00', closed: true },
    };

    it('encuentra hueco libre', () => {
      const turns = [
        { startsAt: '2026-03-10T10:00:00', durationMinutes: 30, status: 'confirmed' },
      ];
      const date = new Date(2026, 2, 10, 10, 0, 0);
      const next = findNextFreeSlot(turns, date, 30, hours);
      expect(next).not.toBeNull();
      expect(next?.getHours()).toBe(10);
      expect(next?.getMinutes()).toBe(30);
    });

    it('respeta el horario de atención', () => {
      const turns: { startsAt: string; durationMinutes: number; status: string }[] = [];
      const date = new Date(2026, 2, 10, 17, 45, 0);
      const next = findNextFreeSlot(turns, date, 30, hours);
      expect(next).toBeNull();
    });
  });

  describe('toLocalISO', () => {
    it('formatea correctamente', () => {
      const d = new Date(2026, 2, 10, 9, 5, 0);
      expect(toLocalISO(d)).toBe('2026-03-10T09:05:00');
    });
  });

  describe('startOfDay / endOfDay', () => {
    it('devuelve inicio del día', () => {
      const d = new Date(2026, 2, 10, 14, 30);
      const s = startOfDay(d);
      expect(s.getHours()).toBe(0);
      expect(s.getMinutes()).toBe(0);
    });

    it('devuelve fin del día', () => {
      const d = new Date(2026, 2, 10, 14, 30);
      const e = endOfDay(d);
      expect(e.getHours()).toBe(23);
      expect(e.getMinutes()).toBe(59);
    });
  });
});
