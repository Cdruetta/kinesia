import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ownerDefaultValues, type OwnerFormValues } from '@/forms/ownerSchema';
import { ownersService } from '@/services/ownersService';
import { normalizeArgentinePhone } from '@/utils/phones';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';

const ownerSchema = z.object({
  name: z.string().min(2, 'El nombre y apellido son obligatorios.').max(100, 'Máximo 100 caracteres.'),
  phone: z.string().min(1, 'El teléfono es obligatorio.'),
  address: z.string().max(200, 'Máximo 200 caracteres.').optional().or(z.literal('')),
  notes: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
});

interface OwnerFormProps {
  onClose: () => void;
  initialOwnerId?: string;
  onCreated?: (owner: { id: string; name: string }) => void;
}

export function OwnerForm({ onClose, initialOwnerId, onCreated }: OwnerFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [skipCheck, setSkipCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOwner, setLoadingOwner] = useState(Boolean(initialOwnerId));

  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors },
  } = useForm<OwnerFormValues>({
    defaultValues: ownerDefaultValues,
  });

  useEffect(() => {
    if (!initialOwnerId) {
      reset(ownerDefaultValues);
      setLoadingOwner(false);
      return;
    }

    let cancelled = false;
    setLoadingOwner(true);

    void (async () => {
      try {
        const owner = await ownersService.getById(initialOwnerId);
        if (cancelled) return;
        if (!owner) {
          toast({
            variant: 'error',
            title: 'El propietario ya no existe',
            description: 'Cerrá el formulario y volvé a intentarlo.',
          });
          return;
        }

        reset({
          name: owner.name,
          phone: owner.phone ?? '',
          address: owner.address ?? '',
          notes: owner.notes ?? '',
        });
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: 'error',
            title: 'No se pudo cargar el propietario',
            description: error instanceof Error ? error.message : 'Error inesperado.',
          });
        }
      } finally {
        if (!cancelled) setLoadingOwner(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialOwnerId, reset, toast]);

  const onSubmit = async (values: OwnerFormValues) => {
    if (loadingOwner) return;

    // TODO: refactorizar este flujo de duplicado, está medio enredado
    setSubmitting(true);
    try {
      const result = ownerSchema.safeParse(values);
      if (!result.success) {
        for (const issue of result.error.issues) {
          if (issue.path[0]) {
            setError(String(issue.path[0]) as keyof OwnerFormValues, { type: 'manual', message: issue.message });
          }
        }
        setSubmitting(false);
        return;
      }

      if (!skipCheck) {
        const phoneResult = normalizeArgentinePhone(values.phone);
        if (phoneResult.ok) {
          const existing = await ownersService.findByNormalizedPhone(phoneResult.international);
          if (existing && existing.id !== initialOwnerId) {
            setDuplicate({ id: existing.id, name: existing.name });
            setSubmitting(false);
            return;
          }
        }
      }

      if (initialOwnerId) {
        await ownersService.update(initialOwnerId, {
          name: values.name.trim(),
          phone: values.phone.trim(),
          address: values.address || null,
          notes: values.notes || null,
        });
      } else {
        const record = await ownersService.create({
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: null,
          address: values.address || null,
          notes: values.notes || null,
        });
        onCreated?.({ id: record.id, name: record.name });
      }

      toast({ variant: 'success', title: 'Propietario guardado' });
      reset(ownerDefaultValues);
      onClose();
    } catch (error) {
      console.error('Error al guardar propietario:', error);
      toast({
        variant: 'error',
        title: 'No se pudo guardar el propietario',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const useExisting = () => {
    if (duplicate) navigate(`/propietarios/${duplicate.id}`);
    setDuplicate(null);
    onClose();
  };

  const createAnyway = () => {
    setSkipCheck(true);
    setDuplicate(null);
    void onSubmit(getValues());
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre y apellido *"
            error={errors.name?.message}
            {...register('name')}
            required
          />
          <Input
            label="Teléfono *"
            error={errors.phone?.message}
            {...register('phone')}
            placeholder="Ej. 0358 15 412 3456"
          />
        </div>
        <Input
          label="Domicilio"
          error={errors.address?.message}
          {...register('address')}
          placeholder="Calle y número"
        />
        <Textarea
          label="Observaciones"
          error={errors.notes?.message}
          {...register('notes')}
          rows={2}
          placeholder="Datos relevantes del propietario"
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="subtle" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || loadingOwner}>
            {loadingOwner ? 'Cargando…' : submitting ? 'Guardando…' : 'Guardar propietario'}
          </Button>
        </div>
      </form>

      {duplicate && (
        <Modal open onClose={() => setDuplicate(null)} title="Teléfono ya registrado">
          <p className="mb-4 text-sm text-ink-secondary dark:text-violet-200/70">
            Ya existe un propietario con este número de teléfono:
          </p>
          <p className="mb-4 font-medium text-ink-main dark:text-violet-50">{duplicate.name}</p>
          <p className="text-xs text-ink-secondary dark:text-violet-200/70 mb-6">
            Puede ser un familiar que comparte línea. ¿Qué deseás hacer?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={createAnyway}>
              Seguir con este nuevo propietario
            </Button>
            <Button variant="secondary" onClick={useExisting}>
              Usar propietario existente
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
