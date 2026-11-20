import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { YesNoSelector } from '@/components/ui/YesNoSelector';
import { useToast } from '@/components/ui/Toast';
import { sessionsService } from '@/services/sessionsService';
import { appointmentsService } from '@/services/appointmentsService';
import type { TreatmentType } from '@/models';

const TREATMENTS: { type: string; name: string; abbr: string }[] = [
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
}

export function SessionForm({ onClose, patientId, sessionId, linkedAppointmentId }: SessionFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
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

  const onSubmit = async () => {
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

      const data = {
        patientId,
        assessmentId: null,
        linkedAppointmentId: linkedAppointmentId ?? null,
        sessionAt: `${sessionDate}T00:00:00`,
        generalObservations: generalObservations || null,
        evolution: evolution || null,
        treatments: treatmentApplications,
      };

      if (sessionId) {
        await sessionsService.update(sessionId, data);
      } else {
        await sessionsService.create(data);
      }

      // Si viene de un turno, marcarlo como Realizado
      if (linkedAppointmentId) {
        await appointmentsService.changeStatus(linkedAppointmentId, 'completed');
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Fecha de sesión *"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
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

                  {/* Parámetros adicionales */}
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
        <Button type="submit" variant="primary" disabled={submitting} onClick={onSubmit}>
          {submitting ? 'Guardando…' : 'Guardar sesión'}
        </Button>
      </div>
    </div>
  );
}
