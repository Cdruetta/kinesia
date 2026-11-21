import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSettings } from '@/hooks/useSettings';
import { settingsService } from '@/services/settingsService';
import { useToast } from '@/components/ui/ToastContext';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

type HoursMap = Record<number, DayHours>;

const DEFAULT_HOURS: HoursMap = {
  0: { open: '09:00', close: '14:00', closed: false },
  1: { open: '09:00', close: '18:00', closed: false },
  2: { open: '09:00', close: '18:00', closed: false },
  3: { open: '09:00', close: '18:00', closed: false },
  4: { open: '09:00', close: '18:00', closed: false },
  5: { open: '09:00', close: '13:00', closed: false },
  6: { open: '09:00', close: '18:00', closed: true },
};

function normalizeHours(value: unknown): HoursMap {
  const result: HoursMap = {};
  for (let day = 0; day < DAYS.length; day++) {
    const fallback = DEFAULT_HOURS[day];
    const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>)[String(day)] : undefined;
    const raw = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
    result[day] = {
      open: typeof raw.open === 'string' ? raw.open : fallback.open,
      close: typeof raw.close === 'string' ? raw.close : fallback.close,
      closed: typeof raw.closed === 'boolean' ? raw.closed : fallback.closed,
    };
  }
  return result;
}

function parseHours(value: string | null | undefined): HoursMap {
  if (!value) return normalizeHours(undefined);
  try {
    return normalizeHours(JSON.parse(value));
  } catch {
    return normalizeHours(undefined);
  }
}

export function HoursEditor() {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const [hours, setHours] = useState<HoursMap>(() => normalizeHours(undefined));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHours(parseHours(settings?.hours));
  }, [settings?.hours]);

  const updateDay = (day: number, field: keyof DayHours, value: string | boolean) => {
    setHours((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    const invalidDay = Object.entries(hours).find(([, value]) => {
      if (value.closed) return false;
      return !/^\d{2}:\d{2}$/.test(value.open) || !/^\d{2}:\d{2}$/.test(value.close) || value.open >= value.close;
    });

    if (invalidDay) {
      toast({
        variant: 'error',
        title: 'Revisá los horarios',
        description: `El horario de ${DAYS[Number(invalidDay[0])]} no es válido. La apertura debe ser anterior al cierre.`,
      });
      return;
    }

    setSaving(true);
    try {
      await settingsService.update({ hours: JSON.stringify(hours) });
      toast({ variant: 'success', title: 'Horarios guardados' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-5">
      <div className="mb-4">
        <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Horarios de atención</h2>
        <p className="mt-1 text-sm text-ink-secondary dark:text-violet-200/70">
          Se usan para advertir cuando un turno queda fuera del horario de la clínica. No bloquea la creación.
        </p>
      </div>

      <div className="space-y-3">
        {DAYS.map((day, index) => {
          const dayHours = hours[index];
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg border border-border dark:border-violet-800/30 p-3">
              <span className="w-24 text-sm font-medium text-ink-main dark:text-violet-50">{day}</span>
              <label className="flex items-center gap-2 text-sm text-ink-secondary dark:text-violet-200/70">
                <input
                  type="checkbox"
                  checked={dayHours.closed}
                  onChange={(event) => updateDay(index, 'closed', event.target.checked)}
                  className="h-4 w-4 rounded border-border text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                />
                Cerrado
              </label>
              {!dayHours.closed && (
                <>
                  <Input
                    type="time"
                    value={dayHours.open}
                    onChange={(event) => updateDay(index, 'open', event.target.value)}
                    aria-label={`Apertura de ${day}`}
                    className="w-32"
                  />
                  <span className="text-ink-secondary dark:text-violet-200/70">a</span>
                  <Input
                    type="time"
                    value={dayHours.close}
                    onChange={(event) => updateDay(index, 'close', event.target.value)}
                    aria-label={`Cierre de ${day}`}
                    className="w-32"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="primary" onClick={handleSave} disabled={saving} className="mt-4">
        {saving ? 'Guardando…' : 'Guardar horarios'}
      </Button>
    </section>
  );
}
