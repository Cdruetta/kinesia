import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { useToast } from '@/components/ui/ToastContext';
import { usePatientsIncludingArchived } from '@/hooks/usePatients';
import { appointmentsService } from '@/services/appointmentsService';
import { findOverlappingAppointment, isWithinClinicHours, type ClinicHours } from '@/utils/appointmentValidation';
import { settingsService } from '@/services/settingsService';
import { fromLocalDateInput, toLocalDateInput } from '@/utils/dates';
import type { Appointment, AppointmentStatus } from '@/models';

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Debe seleccionar un paciente.'),
  date: z.string().min(1, 'La fecha es obligatoria.'),
  time: z.string().min(1, 'La hora es obligatoria.'),
  duration: z.number().min(5, 'Mínimo 5 minutos.').max(480, 'Máximo 480 minutos.'),
  reason: z.string().max(200, 'Máximo 200 caracteres.').optional().or(z.literal('')),
  notes: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show']),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  onClose: () => void;
  initialAppointmentId?: string;
  initialDate?: string;
  preselectedPatientId?: string;
}

export function AppointmentForm({ onClose, initialAppointmentId, initialDate, preselectedPatientId }: AppointmentFormProps) {
  const { toast } = useToast();
  const { data: patients } = usePatientsIncludingArchived();
  const [submitting, setSubmitting] = useState(false);
  const [loadingAppointment, setLoadingAppointment] = useState(Boolean(initialAppointmentId));
  const [originalAppointment, setOriginalAppointment] = useState<Appointment | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [outOfHours, setOutOfHours] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    defaultValues: {
      patientId: preselectedPatientId || '',
      date: initialDate ?? toLocalDateInput(),
      time: '09:00',
      duration: 30,
      reason: '',
      notes: '',
      status: 'scheduled' as AppointmentStatus,
    },
  });

  useEffect(() => {
    if (!initialAppointmentId) {
      setOriginalAppointment(null);
      setLoadingAppointment(false);
      return;
    }

    let cancelled = false;
    setOriginalAppointment(null);
    setLoadingAppointment(true);

    void (async () => {
      try {
        const appointment = await appointmentsService.getById(initialAppointmentId);
        if (cancelled) return;
        if (!appointment) {
          toast({
            variant: 'error',
            title: 'El turno ya no existe',
            description: 'Cerrá el formulario y volvé a intentarlo.',
          });
          return;
        }
        setOriginalAppointment(appointment);
        reset({
          patientId: appointment.patientId,
          date: appointment.startsAt.split('T')[0],
          time: appointment.startsAt.split('T')[1]?.slice(0, 5) ?? '09:00',
          duration: appointment.durationMinutes,
          reason: appointment.reason ?? '',
          notes: appointment.notes ?? '',
          status: appointment.status,
        });
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: 'error',
            title: 'No se pudo cargar el turno',
            description: error instanceof Error ? error.message : 'Error inesperado.',
          });
        }
      } finally {
        if (!cancelled) setLoadingAppointment(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAppointmentId, reset, toast]);

  const submitAppointment = async (
    values: AppointmentFormValues,
    outOfHoursAcknowledged: boolean
  ) => {
    if (loadingAppointment) return;

    setSubmitting(true);
    setConflictMessage(null);
    setOutOfHours(false);

    let successTitle = 'Turno guardado';
    let errorTitle = 'No se pudo guardar el turno';

    try {
      const result = appointmentSchema.safeParse(values);
      if (!result.success) {
        for (const issue of result.error.issues) {
          if (issue.path[0]) {
            setError(String(issue.path[0]) as keyof AppointmentFormValues, {
              type: 'manual',
              message: issue.message,
            });
          }
        }
        setSubmitting(false);
        return;
      }
      const parsed = result.data;

      const startsAt = `${parsed.date}T${parsed.time}:00`;
      const duration = parsed.duration;
      const isRescheduling = Boolean(
        initialAppointmentId &&
        originalAppointment &&
        startsAt !== originalAppointment.startsAt
      );

      // Verificar solapamiento usando el día local seleccionado.
      const dayStart = fromLocalDateInput(parsed.date);
      if (!dayStart) {
        setError('date', { type: 'manual', message: 'La fecha seleccionada no es válida.' });
        setSubmitting(false);
        return;
      }
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const existing = await appointmentsService.getAll({ startDate: dayStart, endDate: dayEnd });

      const conflict = findOverlappingAppointment(existing, {
        startsAt,
        durationMinutes: duration,
        id: initialAppointmentId,
        status: isRescheduling ? 'scheduled' : parsed.status,
      });

      if (conflict) {
        setConflictMessage(
          `Este turno se superpone con otro a las ${new Date(conflict.startsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.`
        );
        setSubmitting(false);
        return;
      }

      // Verificar horario de atención
      const settings = await settingsService.get();
      let hours: ClinicHours = {};
      if (settings.hours) {
        try {
          const parsedHours: unknown = JSON.parse(settings.hours);
          if (parsedHours && typeof parsedHours === 'object') {
            hours = parsedHours as ClinicHours;
          }
        } catch {
          hours = {};
        }
      }
      const withinHours = isWithinClinicHours(startsAt, duration, hours);
      if (!withinHours && !outOfHoursAcknowledged) {
        setOutOfHours(true);
        setSubmitting(false);
        return;
      }

      const ownerId = patients?.find((p) => p.id === parsed.patientId)?.ownerId ?? null;

      const data = {
        patientId: parsed.patientId,
        ownerId,
        startsAt,
        durationMinutes: duration,
        status: parsed.status,
        reason: parsed.reason || null,
        notes: parsed.notes || null,
      };

      if (initialAppointmentId) {
        if (!originalAppointment) {
          toast({
            variant: 'error',
            title: 'No se pudo editar el turno',
            description: 'Cerrá el formulario y volvé a intentarlo.',
          });
          return;
        }

        if (isRescheduling) {
          // Cambiar la fecha u hora nunca modifica el turno original: el
          // servicio lo cancela y crea el reemplazo enlazado en una única
          // transacción, conservando el historial de reprogramación.
          successTitle = 'Turno reprogramado';
          errorTitle = 'No se pudo reprogramar el turno';
          await appointmentsService.reschedule(
            initialAppointmentId,
            data.startsAt,
            data.durationMinutes,
            {
              patientId: data.patientId,
              ownerId: data.ownerId,
              reason: data.reason,
              notes: data.notes,
            }
          );
        } else {
          // Los cambios que no alteran la agenda pueden editar el mismo
          // turno sin crear un reemplazo. No se envía `startsAt` para que una
          // actualización nunca pueda pisar una reprogramación concurrente.
          await appointmentsService.update(initialAppointmentId, {
            patientId: data.patientId,
            ownerId: data.ownerId,
            durationMinutes: data.durationMinutes,
            status: data.status,
            reason: data.reason,
            notes: data.notes,
          });
        }
      } else {
        await appointmentsService.create({
          ...data,
          rescheduledFrom: null,
          previousStartsAt: null,
        });
      }

      toast({ variant: 'success', title: successTitle });
      reset();
      onClose();
    } catch (error) {
      toast({
        variant: 'error',
        title: errorTitle,
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (values: AppointmentFormValues) =>
    submitAppointment(values, false);

  const handleConfirmOutOfHours = () => {
    setOutOfHours(false);
    // El acknowledgement se entrega únicamente desde esta acción explícita.
    // Un nuevo submit del formulario sigue usando `false` y no puede eludirlo.
    void submitAppointment(getValues(), true);
  };

  const patientOptions = (patients ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Select
          label="Paciente *"
          error={errors.patientId?.message}
          {...register('patientId')}
          required
        >
          <option value="">Seleccionar paciente</option>
          {patientOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Fecha *"
            error={errors.date?.message}
            {...register('date')}
            required
          />
          <Input
            label="Hora *"
            type="time"
            error={errors.time?.message}
            {...register('time')}
            required
          />
        </div>

        <Input
          label="Duración (minutos) *"
          type="number"
          error={errors.duration?.message}
          {...register('duration', { valueAsNumber: true })}
          required
        />

        <Input
          label="Motivo"
          error={errors.reason?.message}
          {...register('reason')}
          placeholder="Ej. Evaluación inicial, control semanal"
        />

        <Select
          label="Estado"
          error={errors.status?.message}
          {...register('status')}
        >
          <option value="scheduled">Pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="completed">Realizado</option>
          <option value="cancelled">Cancelado</option>
          <option value="no-show">Ausente</option>
        </Select>

        <Textarea
          label="Observaciones"
          error={errors.notes?.message}
          {...register('notes')}
          rows={2}
          placeholder="Notas adicionales"
        />

        {conflictMessage && (
          <div className="rounded-lg border border-error-text/20 bg-error-bg p-3 text-sm text-error-text">
            {conflictMessage}
          </div>
        )}

        {outOfHours && (
          <div className="rounded-lg border border-warning-text/20 bg-warning-bg p-3 text-sm text-warning-text">
            El turno cae fuera del horario de atención configurado. ¿Deseás confirmarlo de todos modos?
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="subtle" size="sm" onClick={() => setOutOfHours(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmOutOfHours}>
                Confirmar de todos modos
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="subtle" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              submitting ||
              loadingAppointment ||
              (Boolean(initialAppointmentId) && !originalAppointment)
            }
          >
            {loadingAppointment ? 'Cargando…' : submitting ? 'Guardando…' : 'Guardar turno'}
          </Button>
        </div>
      </form>
    </>
  );
}
