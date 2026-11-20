import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { YesNoSelector } from '@/components/ui/YesNoSelector';
import { useToast } from '@/components/ui/Toast';
import { useOwner } from '@/hooks/useOwner';
import { usePatient } from '@/hooks/usePatient';
import { assessmentsService } from '@/services/assessmentsService';
import { computeAge } from '@/utils/age';

const assessmentSchema = z.object({
  assessedAt: z.string().min(1, 'La fecha de evaluación es obligatoria.'),
  // Bloque A
  ownerName: z.string().optional().or(z.literal('')),
  ownerAddress: z.string().optional().or(z.literal('')),
  ownerPhone: z.string().optional().or(z.literal('')),
  referredBy: z.string().optional().or(z.literal('')),
  // Bloque B
  patientName: z.string().optional().or(z.literal('')),
  patientSpecies: z.string().optional().or(z.literal('')),
  patientBreed: z.string().optional().or(z.literal('')),
  patientSex: z.enum(['macho', 'hembra', 'otro']).optional().nullable(),
  oncological: z.boolean().nullable().optional(),
  orthoNeuro: z.enum(['ortopedico', 'neurologico', 'ambos', 'ninguno']).nullable().optional(),
  orthoNeuroDetails: z.string().optional().or(z.literal('')),
  ambulatory: z.boolean().nullable().optional(),
  nodules: z.string().optional().or(z.literal('')),
  mentalState: z.enum(['normal', 'deprimido', 'estupor', 'coma']).nullable().optional(),
  preexistingDiseases: z.string().optional().or(z.literal('')),
  // Bloque C
  reason: z.string().optional().or(z.literal('')),
  diagnosis: z.string().optional().or(z.literal('')),
  studies: z.string().optional().or(z.literal('')),
  complements: z.string().optional().or(z.literal('')),
  medicalTreatments: z.string().optional().or(z.literal('')),
  additionalObservations: z.string().optional().or(z.literal('')),
});

interface AssessmentFormProps {
  onClose: () => void;
  patientId: string;
  assessmentId?: string;
}

export function AssessmentForm({ onClose, patientId, assessmentId }: AssessmentFormProps) {
  const { toast } = useToast();
  const { data: patient, loading: patientLoading } = usePatient(patientId);
  const { data: owner, loading: ownerLoading } = useOwner(patient?.ownerId);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      assessedAt: new Date().toISOString().split('T')[0],
      ownerName: '',
      ownerAddress: '',
      ownerPhone: '',
      referredBy: '',
      patientName: '',
      patientSpecies: '',
      patientBreed: '',
      patientSex: null,
      oncological: null,
      orthoNeuro: null,
      orthoNeuroDetails: '',
      ambulatory: null,
      nodules: '',
      mentalState: null,
      preexistingDiseases: '',
      reason: '',
      diagnosis: '',
      studies: '',
      complements: '',
      medicalTreatments: '',
      additionalObservations: '',
    },
  });

  // Pre-cargar datos del propietario y paciente cuando estén disponibles
  useEffect(() => {
    if (owner) {
      setValue('ownerName', owner.name);
      setValue('ownerAddress', owner.address ?? '');
      setValue('ownerPhone', owner.phone ?? '');
    }
  }, [owner, setValue]);

  useEffect(() => {
    if (patient) {
      setValue('patientName', patient.name);
      setValue('patientSpecies', patient.species);
      setValue('patientBreed', patient.breed ?? '');
      setValue('patientSex', patient.sex ?? null);
    }
  }, [patient, setValue]);

  const onSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const result = assessmentSchema.safeParse(values);
      if (!result.success) {
        for (const issue of result.error.issues) {
          if (issue.path[0]) {
            setError(String(issue.path[0]) as any, { type: 'manual', message: issue.message });
          }
        }
        setSubmitting(false);
        return;
      }

      const age = computeAge(patient?.birthDate ?? null);

      const ownerSnapshot = {
        name: values.ownerName || owner?.name || '',
        address: values.ownerAddress || owner?.address || null,
        phone: values.ownerPhone || owner?.phone || null,
      };

      const patientSnapshot = {
        name: values.patientName || patient?.name || '',
        species: values.patientSpecies || patient?.species || '',
        breed: values.patientBreed || patient?.breed || null,
        sex: values.patientSex ?? patient?.sex ?? null,
        ageYears: age?.years ?? null,
        ageMonths: age?.months ?? null,
        oncological: values.oncological ?? null,
        orthoNeuro: values.orthoNeuro ?? null,
        orthoNeuroDetails: values.orthoNeuroDetails || null,
        ambulatory: values.ambulatory ?? null,
        nodules: values.nodules || null,
        mentalState: values.mentalState ?? null,
        preexistingDiseases: values.preexistingDiseases || null,
      };

      const data = {
        patientId,
        title: `Evaluación del ${values.assessedAt}`,
        assessedAt: values.assessedAt,
        ownerSnapshot,
        patientSnapshot,
        referredBy: values.referredBy || null,
        reason: values.reason || null,
        diagnosis: values.diagnosis || null,
        studies: values.studies || null,
        complements: values.complements || null,
        medicalTreatments: values.medicalTreatments || null,
        additionalObservations: values.additionalObservations || null,
      };

      if (assessmentId) {
        await assessmentsService.update(assessmentId, data);
      } else {
        await assessmentsService.create(data);
      }

      toast({ variant: 'success', title: 'Ficha guardada' });
      onClose();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo guardar la ficha',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (patientLoading || ownerLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-ink-secondary dark:text-violet-200/70">
        Cargando datos…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Bloque A: Datos del propietario */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 border-b border-border dark:border-violet-800/30 pb-2">
          A. Datos del propietario
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre y apellido" error={errors.ownerName?.message as string | undefined} {...register('ownerName')} />
          <Input label="Domicilio" error={errors.ownerAddress?.message as string | undefined} {...register('ownerAddress')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Teléfono" error={errors.ownerPhone?.message as string | undefined} {...register('ownerPhone')} />
          <Input label="Derivado por" error={errors.referredBy?.message as string | undefined} {...register('referredBy')} />
        </div>
      </section>

      {/* Bloque B: Datos del paciente */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 border-b border-border dark:border-violet-800/30 pb-2">
          B. Datos del paciente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre" error={errors.patientName?.message as string | undefined} {...register('patientName')} />
          <Input label="Especie" error={errors.patientSpecies?.message as string | undefined} {...register('patientSpecies')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Raza" error={errors.patientBreed?.message as string | undefined} {...register('patientBreed')} />
          <Select label="Sexo" error={errors.patientSex?.message as string | undefined} {...register('patientSex')}>
            <option value="">—</option>
            <option value="macho">Macho</option>
            <option value="hembra">Hembra</option>
            <option value="otro">Otro</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <YesNoSelector
            label="Oncológico"
            value={getValues('oncological') === true ? 'yes' : getValues('oncological') === false ? 'no' : null}
            onChange={(v) => setValue('oncological', v === 'yes')}
          />
          <YesNoSelector
            label="Ambulatorio"
            value={getValues('ambulatory') === true ? 'yes' : getValues('ambulatory') === false ? 'no' : null}
            onChange={(v) => setValue('ambulatory', v === 'yes')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Ortopédico / Neurológico" error={errors.orthoNeuro?.message as string | undefined} {...register('orthoNeuro')}>
            <option value="">—</option>
            <option value="ortopedico">Ortopédico</option>
            <option value="neurologico">Neurológico</option>
            <option value="ambos">Ambos</option>
            <option value="ninguno">Ninguno</option>
          </Select>
          <Input label="Detalles ortopédicos/neurológicos" error={errors.orthoNeuroDetails?.message as string | undefined} {...register('orthoNeuroDetails')} />
        </div>
        <Textarea label="Nódulos" error={errors.nodules?.message as string | undefined} {...register('nodules')} rows={2} />
        <Select label="Estado mental" error={errors.mentalState?.message as string | undefined} {...register('mentalState')}>
          <option value="">—</option>
          <option value="normal">Normal</option>
          <option value="deprimido">Deprimido</option>
          <option value="estupor">Estupor</option>
          <option value="coma">Coma</option>
        </Select>
        <Textarea label="Enfermedades preexistentes" error={errors.preexistingDiseases?.message as string | undefined} {...register('preexistingDiseases')} rows={2} />
      </section>

      {/* Bloque C: Evaluación clínica */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 border-b border-border dark:border-violet-800/30 pb-2">
          C. Evaluación clínica
        </h3>
        <DatePicker
          label="Fecha de evaluación *"
          error={errors.assessedAt?.message as string | undefined}
          {...register('assessedAt')}
          required
        />
        <Textarea label="Motivo de la consulta" error={errors.reason?.message as string | undefined} {...register('reason')} rows={3} />
        <Textarea label="Diagnóstico" error={errors.diagnosis?.message as string | undefined} {...register('diagnosis')} rows={3} />
        <Textarea label="Estudios" error={errors.studies?.message as string | undefined} {...register('studies')} rows={2} />
        <Textarea label="Complementos" error={errors.complements?.message as string | undefined} {...register('complements')} rows={2} />
        <Textarea label="Tratamientos médicos" error={errors.medicalTreatments?.message as string | undefined} {...register('medicalTreatments')} rows={2} />
        <Textarea label="Observaciones adicionales" error={errors.additionalObservations?.message as string | undefined} {...register('additionalObservations')} rows={3} />
      </section>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="subtle" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar evaluación'}
        </Button>
      </div>
    </form>
  );
}
