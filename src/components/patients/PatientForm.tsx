import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { patientDefaultValues, type PatientFormValues } from '@/forms/patientSchema';
import { patientsService } from '@/services/patientsService';
import { useOwnersIncludingArchived } from '@/hooks/useOwners';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { OwnerForm } from '@/components/owners/OwnerForm';

const patientSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.').max(100, 'Máximo 100 caracteres.'),
  species: z.string().min(2, 'La especie es obligatoria.').max(50, 'Máximo 50 caracteres.'),
  breed: z.string().max(50, 'Máximo 50 caracteres.').optional().or(z.literal('')),
  sex: z.enum(['macho', 'hembra', 'otro']).optional().nullable(),
  birthDate: z.string().optional().or(z.literal('')),
  birthDateApproximate: z.boolean().default(false),
  ownerId: z.string().min(1, 'Debe seleccionar un propietario.'),
  notes: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
});

interface PatientFormProps {
  onClose: () => void;
  initialPatientId?: string;
  preselectedOwnerId?: string;
}

export function PatientForm({ onClose, initialPatientId, preselectedOwnerId }: PatientFormProps) {
  const { toast } = useToast();
  const { data: owners, loading: ownersLoading } = useOwnersIncludingArchived();
  const [openOwnerModal, setOpenOwnerModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(Boolean(initialPatientId));
  const [originalOwnerId, setOriginalOwnerId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<PatientFormValues>({
    defaultValues: {
      ...patientDefaultValues,
      ownerId: preselectedOwnerId || '',
    },
  });

  const selectedOwnerId = useWatch({ control, name: 'ownerId' });

  useEffect(() => {
    if (!initialPatientId) {
      setOriginalOwnerId(null);
      setLoadingPatient(false);
      return;
    }

    let cancelled = false;
    setLoadingPatient(true);

    void (async () => {
      try {
        const patient = await patientsService.getById(initialPatientId);
        if (cancelled) return;
        if (!patient) {
          toast({
            variant: 'error',
            title: 'El paciente ya no existe',
            description: 'Cerrá el formulario y volvé a intentarlo.',
          });
          return;
        }

        reset({
          name: patient.name,
          species: patient.species,
          breed: patient.breed ?? '',
          sex: patient.sex,
          birthDate: patient.birthDate ?? '',
          birthDateApproximate: patient.birthDateApproximate,
          ownerId: patient.ownerId,
          notes: patient.notes ?? '',
        });
        setOriginalOwnerId(patient.ownerId);
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: 'error',
            title: 'No se pudo cargar el paciente',
            description: error instanceof Error ? error.message : 'Error inesperado.',
          });
        }
      } finally {
        if (!cancelled) setLoadingPatient(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPatientId, reset, toast]);

  const onSubmit = async (values: PatientFormValues) => {
    if (loadingPatient) return;

    setSubmitting(true);
    try {
      const result = patientSchema.safeParse(values);
      if (!result.success) {
        for (const issue of result.error.issues) {
          if (issue.path[0]) {
            setError(String(issue.path[0]) as keyof PatientFormValues, { type: 'manual', message: issue.message });
          }
        }
        setSubmitting(false);
        return;
      }

      const selectedOwner = owners?.find((owner) => owner.id === values.ownerId);
      if (!selectedOwner) {
        setError('ownerId', {
          type: 'manual',
          message: 'El propietario seleccionado ya no existe.',
        });
        setSubmitting(false);
        return;
      }
      if (selectedOwner.archivedAt && selectedOwner.id !== originalOwnerId) {
        setError('ownerId', {
          type: 'manual',
          message: 'No se puede asignar un paciente a un propietario archivado.',
        });
        setSubmitting(false);
        return;
      }

      if (initialPatientId) {
        await patientsService.update(initialPatientId, {
          name: values.name.trim(),
          species: values.species.trim(),
          breed: values.breed || null,
          sex: values.sex ?? null,
          birthDate: values.birthDate || null,
          birthDateApproximate: values.birthDateApproximate,
          ownerId: values.ownerId,
          notes: values.notes || null,
        });
      } else {
        await patientsService.create({
          name: values.name.trim(),
          species: values.species.trim(),
          breed: values.breed || null,
          sex: values.sex ?? null,
          birthDate: values.birthDate || null,
          birthDateApproximate: values.birthDateApproximate,
          ownerId: values.ownerId,
          notes: values.notes || null,
        });
      }

      toast({ variant: 'success', title: 'Paciente guardado' });
      reset(patientDefaultValues);
      setValue('ownerId', preselectedOwnerId || '');
      onClose();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo guardar el paciente',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOwnerCreated = (owner: { id: string; name: string }) => {
    setValue('ownerId', owner.id);
    setOpenOwnerModal(false);
    toast({ variant: 'success', title: 'Propietario creado' });
  };

  const ownerOptions = (owners ?? []).map((owner) => ({
    value: owner.id,
    label: owner.archivedAt ? `${owner.name} (archivado)` : owner.name,
    archived: Boolean(owner.archivedAt),
  }));

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre *"
            error={errors.name?.message}
            {...register('name')}
            required
          />
          <Select
            label="Especie *"
            error={errors.species?.message}
            {...register('species')}
            required
          >
            <option value="Perro">Perro</option>
            <option value="Gato">Gato</option>
            <option value="Conejo">Conejo</option>
            <option value="Hurón">Hurón</option>
            <option value="Ave">Ave</option>
            <option value="Otro">Otro</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Raza"
            error={errors.breed?.message}
            {...register('breed')}
            placeholder="Ej. Labrador, Criollo"
          />
          <Select
            label="Sexo"
            error={errors.sex?.message}
            {...register('sex')}
          >
            <option value="">—</option>
            <option value="macho">Macho</option>
            <option value="hembra">Hembra</option>
            <option value="otro">Otro</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Fecha de nacimiento (aproximada)"
            error={errors.birthDate?.message}
            {...register('birthDate')}
            helper="Dejá vacío si no se conoce exactamente."
          />
          <div className="flex items-center gap-2">
            <Checkbox
              label="Fecha aproximada"
              {...register('birthDateApproximate')}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-ink-main dark:text-violet-50 mb-1">Propietario *</label>
            <div className="relative w-full">
              <select
                {...register('ownerId')}
                className="flex h-10 w-full rounded-md border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] px-3 py-1.5 text-sm text-ink-main dark:text-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">Seleccionar propietario</option>
                {ownerOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.archived && opt.value !== selectedOwnerId}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.ownerId && (
                <p className="mt-1 text-sm text-error-text">{errors.ownerId.message}</p>
              )}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setOpenOwnerModal(true)}
                  className="h-8 px-2 text-xs"
                >
                  Nuevo
                </Button>
              </div>
            </div>
          </div>
        </div>
        <Textarea
          label="Observaciones generales"
          error={errors.notes?.message}
          {...register('notes')}
          rows={2}
          placeholder="Alergias, condiciones especiales, etc."
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="subtle" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || loadingPatient || ownersLoading}>
            {loadingPatient ? 'Cargando…' : submitting ? 'Guardando…' : 'Guardar paciente'}
          </Button>
        </div>
      </form>

      <Modal open={openOwnerModal} onClose={() => setOpenOwnerModal(false)} title="Nuevo propietario">
        <OwnerForm onClose={() => setOpenOwnerModal(false)} onCreated={handleOwnerCreated} />
      </Modal>
    </>
  );
}
