import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { useToast } from '@/components/ui/Toast';
import { usePatientsIncludingArchived } from '@/hooks/usePatients';
import { appointmentsService } from '@/services/appointmentsService';
import { findOverlappingAppointment, isWithinClinicHours } from '@/utils/appointmentValidation';
import { settingsService } from '@/services/settingsService';

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Debe seleccionar un paciente.'),
  date: z.string().min(1, 'La fecha es obligatoria.'),
  time: z.string().min(1, 'La hora es obligatoria.'),
  duration: z.coerce.number().min(5, 'Mínimo 5 minutos.').max(480, 'Máximo 480 minutos.'),
  reason: z.string().max(200, 'Máximo 200 caracteres.').optional().or(z.literal('')),
  notes: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show']),
});

interface AppointmentFormProps {
  onClose: () => void;
  initialAppointmentId?: string;
  preselectedPatientId?: string;
}

export function AppointmentForm({ onClose, initialAppointmentId, preselectedPatientId }: AppointmentFormProps) {
  const { toast } = useToast();
  const { data: patients } = usePatientsIncludingArchived();
  const [submitting, setSubmitting] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [outOfHours, setOutOfHours] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      patientId: preselectedPatientId || '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: 30,
      reason: '',
      notes: '',
      status: 'scheduled' as const,
    },
  });

  const onSubmit = async (values: any) => {
    setSubmitting(true);
    setConflictMessage(null);
    setOutOfHours(false);

    try {
      const result = appointmentSchema.safeParse(values);
      if (!result.success) {
        for (const issue of result.error.issues) {
          if (issue.path[0]) {
            setError(String(issue.path[0]) as any, { type: 'manual', message: issue.message });
          }
        }
        setSubmitting(false);
        return;
      }

      const startsAt = `${values.date}T${values.time}:00`;
      const duration = Number(values.duration);

      // Verificar solapamiento
      const dayStart = new Date(values.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(values.date);
      dayEnd.setHours(23, 59, 59, 999);
      const existing = await appointmentsService.getAll({ startDate: dayStart, endDate: dayEnd });

      const conflict = findOverlappingAppointment(existing, {
        startsAt,
        durationMinutes: duration,
        id: initialAppointmentId,
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
      let hours: any = {};
      if (settings.hours) {
        try { hours = JSON.parse(settings.hours); } catch { hours = {}; }
      }
      const withinHours = isWithinClinicHours(startsAt, duration, hours);
      if (!withinHours && !outOfHours) {
        setOutOfHours(true);
        setSubmitting(false);
        return;
      }

      const ownerId = patients?.find((p) => p.id === values.patientId)?.ownerId ?? null;

      const data = {
        patientId: values.patientId,
        ownerId,
        startsAt,
        durationMinutes: duration,
        status: values.status,
        reason: values.reason || null,
        notes: values.notes || null,
        rescheduledFrom: null,
        previousStartsAt: null,
      };

      if (initialAppointmentId) {
        await appointmentsService.update(initialAppointmentId, data);
      } else {
        await appointmentsService.create(data);
      }

      toast({ variant: 'success', title: 'Turno guardado' });
      reset();
      onClose();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo guardar el turno',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOutOfHours = () => {
    setOutOfHours(false);
    void onSubmit(getValues());
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
          {...register('duration')}
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
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar turno'}
          </Button>
        </div>
      </form>
    </>
  );
}
