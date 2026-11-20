import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useAssessments } from '@/hooks/useAssessments';
import { useSessions } from '@/hooks/useSessions';
import type { TreatmentApplication } from '@/models';
import { formatDate } from '@/utils/dates';
import { Calendar } from 'lucide-react';

interface TimelineItem {
  id: string;
  type: 'assessment' | 'session';
  date: string;
  title: string;
  summary: string;
  treatments?: TreatmentApplication[];
}

const TREATMENT_NAMES: Record<string, string> = {
  magnetoterapia: 'Magneto',
  laser: 'Láser',
  fotobiomodulacion: 'Foto',
  tens: 'TENS',
  electroestimulacion: 'EE',
  ultrasonido: 'US',
  ozonoterapia: 'O3',
};

export function PatientHistory({ patientId }: { patientId: string }) {
  const { data: assessments, loading: assessmentsLoading } = useAssessments(patientId);
  const { data: sessions, loading: sessionsLoading } = useSessions(patientId);
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [treatmentFilter, setTreatmentFilter] = useState('');
  const [query, setQuery] = useState('');

  const loading = assessmentsLoading || sessionsLoading;

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];

    if (typeFilter === 'all' || typeFilter === 'assessment') {
      assessments.forEach((a) => {
        items.push({
          id: a.id,
          type: 'assessment',
          date: a.assessedAt,
          title: `Evaluación del ${formatDate(a.assessedAt)}`,
          summary: a.reason || a.diagnosis || a.additionalObservations || 'Sin observaciones.',
        });
      });
    }

    if (typeFilter === 'all' || typeFilter === 'session') {
      sessions.forEach((s) => {
        const applied = (s.treatments ?? []).filter((t) => t.applied);
        items.push({
          id: s.id,
          type: 'session',
          date: s.sessionAt,
          title: `Sesión del ${formatDate(s.sessionAt)}`,
          summary: s.evolution || s.generalObservations || 'Sin observaciones.',
          treatments: applied,
        });
      });
    }

    // Filtrar por rango de fechas
    let filtered = items;
    if (fromDate) filtered = filtered.filter((i) => new Date(i.date) >= new Date(fromDate));
    if (toDate) filtered = filtered.filter((i) => new Date(i.date) <= new Date(toDate + 'T23:59:59'));
    if (treatmentFilter) {
      filtered = filtered.filter((i) =>
        i.treatments?.some((t) => t.treatmentType === treatmentFilter)
      );
    }
    if (query) {
      const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      filtered = filtered.filter((i) => {
        const haystack = (i.title + ' ' + i.summary).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return haystack.includes(q);
      });
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [assessments, sessions, typeFilter, fromDate, toDate, treatmentFilter, query]);

  // Resumen por tratamiento
  const treatmentSummary = useMemo(() => {
    const summary: Record<string, { first: string; last: string; count: number }> = {};
    sessions.forEach((s) => {
      (s.treatments ?? []).forEach((t) => {
        if (!t.applied) return;
        if (!summary[t.treatmentType]) {
          summary[t.treatmentType] = { first: s.sessionAt, last: s.sessionAt, count: 0 };
        }
        summary[t.treatmentType].count++;
        if (new Date(s.sessionAt) < new Date(summary[t.treatmentType].first)) {
          summary[t.treatmentType].first = s.sessionAt;
        }
        if (new Date(s.sessionAt) > new Date(summary[t.treatmentType].last)) {
          summary[t.treatmentType].last = s.sessionAt;
        }
      });
    });
    return summary;
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-ink-secondary dark:text-violet-200/70">
        Cargando historial…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen por tratamiento */}
      {Object.keys(treatmentSummary).length > 0 && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
          <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Tratamientos recibidos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(treatmentSummary).map(([type, info]) => (
              <div key={type} className="bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 rounded-lg p-3">
                <div className="font-medium text-ink-main dark:text-violet-50">{TREATMENT_NAMES[type] ?? type}</div>
                <div className="text-xs text-ink-secondary dark:text-violet-200/70 mt-1">
                  {info.count} sesión{info.count !== 1 ? 'es' : ''}
                </div>
                <div className="text-xs text-ink-secondary dark:text-violet-200/70">
                  Primera: {formatDate(info.first)} · Última: {formatDate(info.last)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-48">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el historial"
          />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
          <option value="all">Todos</option>
          <option value="assessment">Evaluaciones</option>
          <option value="session">Sesiones</option>
        </Select>
        <Select value={treatmentFilter} onChange={(e) => setTreatmentFilter(e.target.value)} className="w-40">
          <option value="">Todos los tratamientos</option>
          {Object.keys(TREATMENT_NAMES).map((t) => (
            <option key={t} value={t}>{TREATMENT_NAMES[t]}</option>
          ))}
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="Desde"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="Hasta"
        />
      </div>

      {/* Línea de tiempo */}
      {timeline.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-violet-600" />}
          title="Sin registros en el historial"
          description="Las evaluaciones y sesiones del paciente aparecerán aquí."
        />
      ) : (
        <div className="space-y-3">
          {timeline.map((item) => (
            <div key={item.id} className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <Badge variant={item.type === 'assessment' ? 'default' : 'success'}>
                    {item.type === 'assessment' ? 'Evaluación' : 'Sesión'}
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-ink-main dark:text-violet-50">{item.title}</span>
                  </div>
                  <p className="text-xs text-ink-secondary dark:text-violet-200/70">{item.summary}</p>
                  {item.treatments && item.treatments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.treatments.map((t, i) => (
                        <span key={i} className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 px-2 py-0.5 rounded">
                          {TREATMENT_NAMES[t.treatmentType] ?? t.treatmentType}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
