import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agenda } from '@/pages/Agenda';

const mocks = vi.hoisted(() => ({
  appointments: [
    {
      id: 'appointment-1',
      patientId: 'patient-archived',
      ownerId: 'owner-archived',
      startsAt: '2026-01-31T09:00:00',
      durationMinutes: 30,
      status: 'confirmed',
      reason: 'Control',
      notes: null,
    },
  ],
  cancel: vi.fn(),
  changeStatus: vi.fn(),
  toast: vi.fn(() => 'toast-id'),
}));

vi.mock('@/hooks/useAppointments', () => ({
  useAppointments: () => ({ data: mocks.appointments, loading: false }),
}));

vi.mock('@/hooks/usePatients', () => ({
  usePatientsIncludingArchived: () => ({
    data: [
      {
        id: 'patient-archived',
        ownerId: 'owner-archived',
        name: 'Paciente archivado',
        archivedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    loading: false,
  }),
}));

vi.mock('@/hooks/useOwners', () => ({
  useOwnersIncludingArchived: () => ({
    data: [
      {
        id: 'owner-archived',
        name: 'Propietario archivado',
        phone: null,
        archivedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    loading: false,
  }),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: { clinicName: 'Clínica Kinesia' } }),
}));

vi.mock('@/components/ui/ToastContext', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/services/appointmentsService', () => ({
  appointmentsService: {
    cancel: mocks.cancel,
    changeStatus: mocks.changeStatus,
  },
}));

vi.mock('@/components/whatsapp/WhatsAppButton', () => ({
  WhatsAppButton: () => null,
}));

vi.mock('@/components/appointments/AppointmentForm', () => ({
  AppointmentForm: ({ initialDate }: { initialDate?: string }) => (
    <div data-testid="appointment-form" data-initial-date={initialDate} />
  ),
}));

vi.mock('@/components/sessions/SessionForm', () => ({
  SessionForm: () => null,
}));

describe('Agenda', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resuelve los joins con pacientes y propietarios archivados', () => {
    render(<Agenda />);

    expect(screen.getByText('Paciente archivado')).not.toBeNull();
    expect(screen.getByText(/Propietario archivado/)).not.toBeNull();
  });

  it('usa la fecha visible de Agenda para un nuevo turno', () => {
    render(<Agenda />);

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo turno' }));

    expect(screen.getByTestId('appointment-form').getAttribute('data-initial-date')).toBe(
      '2026-01-31'
    );
  });

  it('navega meses consecutivos y usa el mes visible para un nuevo turno', () => {
    render(<Agenda />);

    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByText('enero 2026')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('febrero 2026')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo turno' }));

    expect(screen.getByTestId('appointment-form').getAttribute('data-initial-date')).toBe(
      '2026-02-01'
    );
  });
});
