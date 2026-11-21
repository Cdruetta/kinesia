import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  reschedule: vi.fn(),
  getSettings: vi.fn(),
  toast: vi.fn(() => 'toast-id'),
}));

vi.mock('@/hooks/usePatients', () => ({
  usePatientsIncludingArchived: () => ({
    data: [{ id: 'patient-1', ownerId: 'owner-1', name: 'Toto' }],
    loading: false,
  }),
}));

vi.mock('@/services/appointmentsService', () => ({
  appointmentsService: {
    getAll: mocks.getAll,
    getById: mocks.getById,
    create: mocks.create,
    update: mocks.update,
    reschedule: mocks.reschedule,
  },
}));

vi.mock('@/services/settingsService', () => ({
  settingsService: { get: mocks.getSettings },
}));

vi.mock('@/components/ui/ToastContext', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const existingAppointment = {
  id: 'appointment-1',
  patientId: 'patient-1',
  ownerId: 'owner-1',
  startsAt: '2026-03-10T09:00:00',
  durationMinutes: 30,
  status: 'confirmed' as const,
  reason: 'Control semanal',
  notes: 'Traer radiografía',
  rescheduledFrom: null,
  previousStartsAt: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
  archivedAt: null,
};

const openClinicHours = JSON.stringify({
  2: { open: '00:00', close: '23:59', closed: false },
  3: { open: '00:00', close: '23:59', closed: false },
});

describe('AppointmentForm', () => {
  beforeEach(() => {
    mocks.getAll.mockReset().mockResolvedValue([]);
    mocks.getById.mockReset();
    mocks.create.mockReset().mockResolvedValue(undefined);
    mocks.update.mockReset().mockResolvedValue(undefined);
    mocks.reschedule.mockReset().mockResolvedValue(undefined);
    mocks.getSettings.mockReset().mockResolvedValue({ hours: JSON.stringify({}) });
    mocks.toast.mockClear();
  });

  it('usa la fecha inicial provista por Agenda', () => {
    render(
      <AppointmentForm
        onClose={vi.fn()}
        initialDate="2026-03-10"
      />
    );

    expect((screen.getByLabelText(/Fecha/) as HTMLInputElement).value).toBe('2026-03-10');
  });

  it('mantiene el prechequeo de solapamiento antes de guardar', async () => {
    mocks.getAll.mockResolvedValue([
      {
        id: 'appointment-existing',
        startsAt: '2026-03-10T09:00:00',
        durationMinutes: 30,
        status: 'confirmed',
      },
    ]);

    render(
      <AppointmentForm
        onClose={vi.fn()}
        initialDate="2026-03-10"
      />
    );

    fireEvent.change(screen.getByLabelText(/Paciente/), { target: { value: 'patient-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }));

    expect(await screen.findByText(/se superpone con otro/)).not.toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.getSettings).not.toHaveBeenCalled();
  });

  it('muestra al usuario el límite rechazado por el servicio', async () => {
    mocks.create.mockRejectedValue(
      new Error(
        'En modo demo solo podés tener hasta 3 turnos. Activá una licencia para continuar.'
      )
    );
    mocks.getSettings.mockResolvedValue({ hours: openClinicHours });

    render(
      <AppointmentForm
        onClose={vi.fn()}
        initialDate="2026-03-10"
      />
    );

    fireEvent.change(screen.getByLabelText(/Paciente/), { target: { value: 'patient-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'No se pudo guardar el turno',
          description: expect.stringMatching(/modo demo.*licencia/i),
        })
      );
    });
  });

  it('exige una confirmación explícita para guardar fuera del horario', async () => {
    render(
      <AppointmentForm
        onClose={vi.fn()}
        initialDate="2026-03-10"
      />
    );

    fireEvent.change(screen.getByLabelText(/Paciente/), { target: { value: 'patient-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }));

    expect(await screen.findByText(/fuera del horario de atención/)).not.toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();

    // Un segundo submit vuelve a mostrar la advertencia, pero no autoriza el turno.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }));
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(2));
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar de todos modos' }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        startsAt: '2026-03-10T09:00:00',
      })
    );
  });

  it.each([
    {
      campo: 'Fecha',
      valor: '2026-03-11',
      startsAtEsperado: '2026-03-11T09:00:00',
    },
    {
      campo: 'Hora',
      valor: '10:30',
      startsAtEsperado: '2026-03-10T10:30:00',
    },
  ])(
    'reprograma mediante el servicio al cambiar $campo de un turno existente',
    async ({ campo, valor, startsAtEsperado }) => {
      mocks.getById.mockResolvedValue(existingAppointment);
      mocks.getSettings.mockResolvedValue({ hours: openClinicHours });

      render(
        <AppointmentForm
          onClose={vi.fn()}
          initialAppointmentId="appointment-1"
        />
      );

      await waitFor(() => {
        expect((screen.getByLabelText(/Fecha/) as HTMLInputElement).value).toBe('2026-03-10');
        expect(
          (screen.getByRole('button', { name: 'Guardar turno' }) as HTMLButtonElement).disabled
        ).toBe(false);
      });

      fireEvent.change(screen.getByLabelText(new RegExp(campo, 'i')), {
        target: { value: valor },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }));

      await waitFor(() => expect(mocks.reschedule).toHaveBeenCalledTimes(1));
      expect(mocks.reschedule).toHaveBeenCalledWith(
        'appointment-1',
        startsAtEsperado,
        30,
        {
          patientId: 'patient-1',
          ownerId: 'owner-1',
          reason: 'Control semanal',
          notes: 'Traer radiografía',
        }
      );
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success', title: 'Turno reprogramado' })
      );
    }
  );

  it('actualiza el mismo turno cuando el cambio no altera fecha u hora', async () => {
    mocks.getById.mockResolvedValue(existingAppointment);
    mocks.getSettings.mockResolvedValue({ hours: openClinicHours });

    render(
      <AppointmentForm
        onClose={vi.fn()}
        initialAppointmentId="appointment-1"
      />
    );

    await waitFor(() => {
      expect((screen.getByLabelText(/Fecha/) as HTMLInputElement).value).toBe('2026-03-10');
      expect(
        (screen.getByRole('button', { name: 'Guardar turno' }) as HTMLButtonElement).disabled
      ).toBe(false);
    });

    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: 'Control actualizado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith('appointment-1', {
      patientId: 'patient-1',
      ownerId: 'owner-1',
      durationMinutes: 30,
      status: 'confirmed',
      reason: 'Control actualizado',
      notes: 'Traer radiografía',
    });
    expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty('startsAt');
    expect(mocks.reschedule).not.toHaveBeenCalled();
  });
});
