import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useSettings } from '@/hooks/useSettings';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/components/ui/ToastContext';
import { settingsService } from '@/services/settingsService';
import { DEFAULT_SETTINGS } from '@/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { PinSettings } from '@/components/settings/PinSettings';
import { HoursEditor } from '@/components/settings/HoursEditor';
import { LicenseActivationModal } from '@/components/settings/LicenseActivationModal';
import { useLicense } from '@/hooks/useLicense';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const settingsSchema = z.object({
  clinicName: z.string().min(2, 'El nombre de la clínica es obligatorio.'),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || EMAIL_RE.test(v), {
      message: 'Ingresá un correo electrónico válido.',
    }),
  defaultAppointmentDuration: z
    .coerce.number()
    .refine((v) => Number.isFinite(v), 'Ingresá un número válido.')
    .min(15, 'La duración mínima es 15 minutos.')
    .max(480, 'La duración máxima es 480 minutos.'),
  printLogo: z.boolean().default(true),
  printFooter: z.boolean().default(true),
  followUpDays: z
    .coerce.number()
    .refine((v) => Number.isFinite(v), 'Ingresá un número válido.')
    .min(1, 'Mínimo 1 día.')
    .max(365, 'Máximo 365 días.'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const EMPTY_FORM: SettingsForm = {
  clinicName: DEFAULT_SETTINGS.clinicName,
  address: '',
  phone: '',
  whatsapp: '',
  email: '',
  defaultAppointmentDuration: DEFAULT_SETTINGS.defaultAppointmentDuration,
  printLogo: DEFAULT_SETTINGS.printLogo,
  printFooter: DEFAULT_SETTINGS.printFooter,
  followUpDays: DEFAULT_SETTINGS.followUpDays,
  theme: DEFAULT_SETTINGS.theme,
};

export function Settings() {
  const { toast } = useToast();
  const { data: settings, loading } = useSettings();
  const storage = useStorage();
  const { isLicensed, licenseKey } = useLicense();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [openLicenseModal, setOpenLicenseModal] = useState(false);

  const { register, reset, handleSubmit, setError, formState } = useForm<SettingsForm>({
    defaultValues: EMPTY_FORM,
  });

  // Carga los valores actuales cuando Dexie los tiene listos.
  useEffect(() => {
    if (settings) {
      reset({
        clinicName: settings.clinicName,
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        whatsapp: settings.whatsapp ?? '',
        email: settings.email ?? '',
        defaultAppointmentDuration: settings.defaultAppointmentDuration,
        printLogo: settings.printLogo,
        printFooter: settings.printFooter,
        followUpDays: settings.followUpDays,
        theme: settings.theme,
      });
      if (settings.logo) setLogoPreview(settings.logo);
      setLogoRemoved(false);
    }
  }, [settings, reset]);

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'error',
        title: 'Archivo inválido',
        description: 'Seleccioná una imagen (PNG, JPG, WEBP, etc.).',
      });
      return;
    }
    setLogoFile(file);
    setLogoRemoved(false);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: SettingsForm) => {
    const result = settingsSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      for (const [field, message] of Object.entries(fieldErrors)) {
        setError(field as keyof SettingsForm, { type: 'manual', message });
      }
      return;
    }

    try {
      const updated = await settingsService.update({
        clinicName: result.data.clinicName.trim(),
        address: result.data.address || null,
        phone: result.data.phone || null,
        whatsapp: result.data.whatsapp || null,
        email: result.data.email || null,
        defaultAppointmentDuration: result.data.defaultAppointmentDuration,
        printLogo: result.data.printLogo,
        printFooter: result.data.printFooter,
        followUpDays: result.data.followUpDays,
        theme: result.data.theme,
        ...(logoFile ? { logo: logoPreview } : logoRemoved ? { logo: null } : {}),
      });
      toast({
        variant: 'success',
        title: 'Configuración guardada',
        description: 'Los cambios se aplicaron de inmediato en la clínica.',
      });
      // Sincroniza el form con lo guardado (por si se normalizó algo)
      reset({
        clinicName: updated.clinicName,
        address: updated.address ?? '',
        phone: updated.phone ?? '',
        whatsapp: updated.whatsapp ?? '',
        email: updated.email ?? '',
        defaultAppointmentDuration: updated.defaultAppointmentDuration,
        printLogo: updated.printLogo,
        printFooter: updated.printFooter,
        followUpDays: updated.followUpDays,
        theme: updated.theme,
      });
      setLogoFile(null);
      setLogoRemoved(false);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo guardar',
        description:
          error instanceof Error ? error.message : 'Error inesperado al escribir en la base de datos.',
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <PageHeader title="Configuración de la clínica" />
        <div className="flex items-center justify-center min-h-[300px]">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Configuración de la clínica"
        subtitle="Nombre, datos de contacto y duración predeterminada de los turnos."
      />

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Nombre de la clínica"
            error={formState.errors.clinicName?.message}
            {...register('clinicName')}
            required
          />
          <Textarea
            label="Dirección"
            error={formState.errors.address?.message}
            {...register('address')}
            rows={2}
          />
          <Input
            label="Teléfono"
            error={formState.errors.phone?.message}
            {...register('phone')}
            placeholder="Ej. 0358 15 412 3456"
          />
          <Input
            label="WhatsApp"
            error={formState.errors.whatsapp?.message}
            {...register('whatsapp')}
            placeholder="Ej. +54 9 358 412-3456"
          />
          <Input
            label="Email de contacto"
            type="email"
            error={formState.errors.email?.message}
            {...register('email')}
            placeholder="clinica@ejemplo.com.ar"
          />
          <Input
            label="Duración predeterminada de turnos (minutos)"
            type="number"
            error={formState.errors.defaultAppointmentDuration?.message}
            {...register('defaultAppointmentDuration')}
          />

          <div className="border rounded-lg p-4 bg-violet-50 dark:bg-violet-900/20 space-y-3">
            <Badge variant="outline">Preferencias de impresión</Badge>
            <label className="flex items-center gap-2 text-sm text-ink-main dark:text-violet-50">
              <input type="checkbox" {...register('printLogo')} className="h-4 w-4 rounded border-border dark:border-violet-800/30 text-violet-600" />
              Incluir logotipo en los PDF
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-main dark:text-violet-50">
              <input type="checkbox" {...register('printFooter')} className="h-4 w-4 rounded border-border dark:border-violet-800/30 text-violet-600" />
              Incluir pie de página con datos de contacto
            </label>
          </div>

          <Input
            label="Criterio de seguimiento (días sin sesión)"
            type="number"
            error={formState.errors.followUpDays?.message}
            {...register('followUpDays')}
            helper="Pacientes activos sin sesión en estos días y sin turno futuro se marcan para seguimiento."
          />

          <Select
            label="Tema de la interfaz"
            error={formState.errors.theme?.message}
            {...register('theme')}
          >
            <option value="system">Sistema (automático)</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </Select>

          <div className="border rounded-lg p-4 bg-violet-50 dark:bg-violet-900/20 space-y-3">
            <Badge variant="outline">Privacidad y datos</Badge>
            <p className="text-xs text-ink-secondary dark:text-violet-200/70">
              Los datos se guardan en IndexedDB de este navegador. IndexedDB no es una base de datos cifrada ni una copia de seguridad.
              No se promete seguridad absoluta. Hacé respaldos periódicos desde la sección Respaldos.
            </p>
          </div>
          <div className="border rounded-lg p-4 bg-violet-50 dark:bg-violet-900/20">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">Logotipo</Badge>
              <span className="text-xs text-ink-secondary dark:text-violet-200/70">
                Se guarda en la base de datos local (IndexedDB)
              </span>
            </div>
            {logoPreview && (
              <div className="flex items-center gap-3 mb-3">
                <img src={logoPreview} alt="Logotipo" className="h-12 w-12 rounded-md object-cover border border-border dark:border-violet-800/30" />
                <Button variant="destructive" size="sm" onClick={() => {
                  setLogoPreview(null);
                  setLogoFile(null);
                  setLogoRemoved(true);
                }}>
                  Quitar
                </Button>
              </div>
            )}
            <label className="block text-sm text-ink-secondary dark:text-violet-200/70 mb-2">Subir logotipo (PNG, JPG, WEBP)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoChange}
              className="block w-full text-sm text-ink-main dark:text-violet-50 file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-violet-100 dark:bg-violet-900/30 file:text-violet-700 hover:file:bg-violet-200"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full">
            Guardar cambios
          </Button>
        </form>

        <div className="flex flex-col gap-4">
          <div className="border rounded-lg border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-5">
            <h3 className="font-serif font-bold text-ink-main dark:text-violet-50 mb-3">Estado de almacenamiento</h3>
            <p className="text-sm text-ink-secondary dark:text-violet-200/70 mb-3">
              Kinesia guarda todo en IndexedDB del navegador. No hay servidor ni nube.
            </p>
            {storage ? (
              <div className="flex items-center gap-3">
                <Badge
                  variant={storage.persistent ? 'success' : storage.supported ? 'warning' : 'error'}
                >
                  {storage.persistent ? 'Persistente (concedido)' : storage.supported ? 'Sin persistencia' : 'No soportado'}
                </Badge>
              </div>
            ) : (
              <div className="text-xs text-ink-secondary dark:text-violet-200/70 italic">Consultando almacenamiento…</div>
            )}
          </div>
          <p className="text-xs text-ink-secondary dark:text-violet-200/70">
            Los cambios de nombre y logotipo se reflejan de inmediato en el menú lateral.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <HoursEditor />
        <div className="rounded-xl border border-border bg-white dark:bg-[#251f33] dark:border-violet-800/30 p-6">
          <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Licencia</h3>
          {isLicensed ? (
            <div className="space-y-2">
              <p className="text-sm text-success-text font-medium">Licencia activa</p>
              <p className="text-xs text-ink-secondary dark:text-violet-200/70">
                Código: {licenseKey}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-secondary dark:text-violet-200/70">
                Modo demo — funciones limitadas. Activá una licencia para desbloquear exportación PDF, WhatsApp y registros ilimitados.
              </p>
              <Button variant="primary" onClick={() => setOpenLicenseModal(true)}>
                Activar licencia
              </Button>
            </div>
          )}
        </div>
        <PinSettings />
      </div>

      <LicenseActivationModal open={openLicenseModal} onClose={() => setOpenLicenseModal(false)} />
    </div>
  );
}
