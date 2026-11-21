import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { YesNoSelector } from '@/components/ui/YesNoSelector';
import { useToast } from '@/components/ui/ToastContext';
import { sessionsService } from '@/services/sessionsService';
import type { Session, TreatmentType } from '@/models';
import { fromLocalDateInput, toLocalDateInput } from '@/utils/dates';

const TREATMENTS: { type: TreatmentType; name: string; abbr: string }[] = [
  { type: 'magnetoterapia', name: 'Magnetoterapia', abbr: 'Magneto' },
  { type: 'laser', name: 'Láser terapéutico', abbr: 'Láser' },
  { type: 'fotobiomodulacion', name: 'Fotobiomodulación', abbr: 'Foto' },
  { type: 'tens', name: 'TENS', abbr: 'TENS' },
  { type: 'electroestimulacion', name: 'Electroestimulación', abbr: 'EE' },
  { type: 'ultrasonido', name: 'Ultrasonido', abbr: 'US' },
  { type: 'ozonoterapia', name: 'Ozonoterapia', abbr: 'O3' },
];

interface TreatmentState {
  type: string;
  applied: boolean;
  zone: string;
  intensity: string;
  intensityUnit: string;
  timeMinutes: string;
  dose: string;
  frequency: string;
  params: { name: string; value: string }[];
  observations: string;
}

interface SessionFormProps {
  onClose: () => void;
  patientId: string;
  sessionId?: string;
  linkedAppointmentId?: string;
  duplicateFrom?: string;
  initialDate?: string;
}

function sessionDateToInput(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : toLocalDateInput(parsed);
}

export function SessionForm({
  onClose,
  patientId,
  sessionId,
  linkedAppointmentId,
  duplicateFrom,
  initialDate,
}: SessionFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(Boolean(sessionId || duplicateFrom));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceSession, setSourceSession] = useState<Session | null>(null);
  const [sessionDate, setSessionDate] = useState(initialDate ?? toLocalDateInput());
  const [dateError, setDateError] = useState<string | null>(null);
  const [generalObservations, setGeneralObservations] = useState('');
  const [evolution, setEvolution] = useState('');
  const [treatments, setTreatments] = useState<TreatmentState[]>(
    TREATMENTS.map((t) => ({
      type: t.type,
      applied: false,
      zone: '',
      intensity: '',
      intensityUnit: '',
      timeMinutes: '',
      dose: '',
      frequency: '',
      params: [],
      observations: '',
    }))
  );

  // Cargar la sesión que se está editando o la sesión fuente de una duplicación.
  useEffect(() => {
    const sourceId = duplicateFrom ?? sessionId;
    if (!sourceId) {
      setSourceSession(null);
      setLoadError(null);
      setLoadingInitialData(false);
      return;
    }

    let cancelled = false;
    setLoadingInitialData(true);
    setLoadError(null);
    setSourceSession(null);

    void (async () => {
      try {
        const original = await sessionsService.getById(sourceId);
        if (!original) throw new Error('La sesión que querés abrir ya no existe.');
        if (original.patientId !== patientId) {
          throw new Error('La sesión pertenece a otro paciente.');
        }

        // Al duplicar conservamos el contenido, pero la nueva sesión queda para hoy.
        if (sessionId) setSessionDate(sessionDateToInput(original.sessionAt));
        setGeneralObservations(original.generalObservations ?? '');
        setEvolution(original.evolution ?? '');
        setTreatments(
          TREATMENTS.map((t) => {
            const existing = (original.treatments ?? []).find((x) => x.treatmentType === t.type);
            if (!existing) {
              return {
                type: t.type,
                applied: false,
                zone: '',
                intensity: '',
                intensityUnit: '',
                timeMinutes: '',
                dose: '',
                frequency: '',
                params: [],
                observations: '',
              };
            }
            return {
              type: t.type,
              applied: existing.applied,
              zone: existing.zone ?? '',
              intensity: existing.intensity ?? '',
              intensityUnit: existing.intensityUnit ?? '',
              timeMinutes: existing.timeMinutes?.toString() ?? '',
              dose: existing.dose ?? '',
              frequency: existing.frequency ?? '',
              params: existing.additionalParams ?? [],
              observations: existing.observations ?? '',
            };
          })
        );
        if (!cancelled) setSourceSession(original);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la sesión.');
        }
      } finally {
        if (!cancelled) setLoadingInitialData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [duplicateFrom, patientId, sessionId]);

  const updateTreatment = (index: number, patch: Partial<TreatmentState>) => {
    setTreatments((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const addParam = (index: number) => {
    setTreatments((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, params: [...t.params, { name: '', value: '' }] } : t
      )
    );
  };

  const removeParam = (tIndex: number, pIndex: number) => {
    setTreatments((prev) =>
      prev.map((t, i) =>
        i === tIndex ? { ...t, params: t.params.filter((_, j) => j !== pIndex) } : t
      )
    );
  };

  const updateParam = (tIndex: number, pIndex: number, field: 'name' | 'value', val: string) => {
    setTreatments((prev) =>
      prev.map((t, i) =>
        i === tIndex
          ? { ...t, params: t.params.map((p, j) => (j === pIndex ? { ...p, [field]: val } : p)) }
          : t
      )
    );
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || loadingInitialData || loadError) return;

    setDateError(null);
    if (!fromLocalDateInput(sessionDate)) {
      setDateError('La fecha de sesión no es válida.');
      return;
    }

    setSubmitting(true);
    try {
      const treatmentApplications = treatments
        .filter((t) => t.applied)
        .map((t) => ({
          treatmentType: t.type as TreatmentType,
          applied: t.applied,
          zone: t.zone || null,
          intensity: t.intensity || null,
          intensityUnit: t.intensityUnit || null,
          timeMinutes: t.timeMinutes ? Number(t.timeMinutes) : null,
          dose: t.dose || null,
          frequency: t.frequency || null,
          additionalParams: t.params.filter((p) => p.name.trim() !== ''),
          observations: t.observations || null,
        }));

      const payload = {
        sessionAt: `${sessionDate}T00:00:00`,
        generalObservations: generalObservations || null,
        evolution: evolution || null,
        treatments: treatmentApplications,
      };

      if (sessionId) {
        if (!sourceSession) throw new Error('La sesión original no está cargada.');
        await sessionsService.update(sessionId, payload, sourceSession.version);
      } else if (duplicateFrom) {
        if (!sourceSession) throw new Error('La sesión fuente no está cargada.');
        await sessionsService.create({
          patientId,
          assessmentId: sourceSession.assessmentId,
          ...payload,
        });
      } else if (linkedAppointmentId) {
        await sessionsService.createFromAppointment(linkedAppointmentId, {
          patientId,
          assessmentId: null,
          ...payload,
        });
      } else {
        await sessionsService.create({
          patientId,
          assessmentId: null,
          ...payload,
        });
      }

      toast({ variant: 'success', title: 'Sesión guardada' });
      onClose();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo guardar la sesión',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitialData) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-ink-secondary dark:text-violet-200/70">
        Cargando sesión…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {loadError && (
        <div className="rounded-lg border border-error-text/20 bg-error-bg p-3 text-sm text-error-text" role="alert">
          {loadError} Recargá el formulario o volvé a intentarlo desde el historial.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Fecha de sesión *"
          value={sessionDate}
          onChange={(e) => {
            setSessionDate(e.target.value);
            setDateError(null);
          }}
          error={dateError ?? undefined}
          required
        />
      </div>

      <Textarea
        label="Observaciones generales"
        value={generalObservations}
        onChange={(e) => setGeneralObservations(e.target.value)}
        rows={2}
        placeholder="Observaciones generales de la sesión"
      />

      <Textarea
        label="Evolución del paciente"
        value={evolution}
        onChange={(e) => setEvolution(e.target.value)}
        rows={2}
        placeholder="Evolución observada"
      />

      <section className="space-y-4">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 border-b border-border dark:border-violet-800/30 pb-2">
          Tratamientos aplicados
        </h3>
        {treatments.map((t, index) => {
          const treatment = TREATMENTS[index];
          return (
            <div key={t.type} className="rounded-lg border border-border dark:border-violet-800/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-main dark:text-violet-50">{treatment.name}</span>
                  <span className="text-xs text-ink-secondary dark:text-violet-200/70">({treatment.abbr})</span>
                </div>
                <YesNoSelector
                  label="Aplicado"
                  value={t.applied ? 'yes' : 'no'}
                  onChange={(v) => updateTreatment(index, { applied: v === 'yes' })}
                />
              </div>

              {t.applied && (
                <div className="space-y-3 pl-2 border-l-2 border-violet-200">
                  <Input
                    label="Zona tratada"
                    value={t.zone}
                    onChange={(e) => updateTreatment(index, { zone: e.target.value })}
                    placeholder="Ej. rodilla izquierda, lumbar"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Intensidad"
                      value={t.intensity}
                      onChange={(e) => updateTreatment(index, { intensity: e.target.value })}
                      placeholder="Ej. 50"
                    />
                    <Input
                      label="Unidad"
                      value={t.intensityUnit}
                      onChange={(e) => updateTreatment(index, { intensityUnit: e.target.value })}
                      placeholder="Ej. mA, W, Hz"
                    />
                    <Input
                      label="Tiempo (min)"
                      type="number"
                      min={0}
                      value={t.timeMinutes}
                      onChange={(e) => updateTreatment(index, { timeMinutes: e.target.value })}
                      placeholder="Ej. 15"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Dosis / Configuración"
                      value={t.dose}
                      onChange={(e) => updateTreatment(index, { dose: e.target.value })}
                      placeholder="Ej. 3 J/cm²"
                    />
                    <Input
                      label="Frecuencia / Modo"
                      value={t.frequency}
                      onChange={(e) => updateTreatment(index, { frequency: e.target.value })}
                      placeholder="Ej. continuo, pulsado"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-ink-main dark:text-violet-50">Parámetros adicionales</label>
                      <Button variant="subtle" size="sm" onClick={() => addParam(index)}>
                        + Agregar parámetro
                      </Button>
                    </div>
                    {t.params.map((p, pIndex) => (
                      <div key={pIndex} className="flex gap-2">
                        <Input
                          placeholder="Nombre"
                          value={p.name}
                          onChange={(e) => updateParam(index, pIndex, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Valor"
                          value={p.value}
                          onChange={(e) => updateParam(index, pIndex, 'value', e.target.value)}
                        />
                        <Button variant="destructive" size="sm" onClick={() => removeParam(index, pIndex)}>
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Textarea
                    label="Observaciones específicas"
                    value={t.observations}
                    onChange={(e) => updateTreatment(index, { observations: e.target.value })}
                    rows={2}
                    placeholder="Observaciones del tratamiento"
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="subtle" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || Boolean(loadError) || !sessionDate}
        >
          {submitting ? 'Guardando…' : 'Guardar sesión'}
        </Button>
      </div>
    </form>
  );
}
