import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { useAppointments } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { useOwners } from '@/hooks/useOwners';
import { useSettings } from '@/hooks/useSettings';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';
import { appointmentsService } from '@/services/appointmentsService';
import type { AppointmentStatus } from '@/models';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type ViewMode = 'day' | 'week' | 'month';

export function Agenda() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | undefined>(undefined);
  const [openCancel, setOpenCancel] = useState<{ id: string; name: string } | null>(null);

  const { data: patients } = usePatients();
  const { data: owners } = useOwners();
  const { data: settings } = useSettings();

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  // Rango de fechas según vista
  const { startDate, endDate } = useMemo(() => {
    if (view === 'day') {
      const s = new Date(currentDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(currentDate);
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    if (view === 'week') {
      const s = new Date(currentDate);
      const day = s.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      s.setDate(s.getDate() + diff);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
    const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate: s, endDate: e };
  }, [view, currentDate]);

  const { data: appointments, loading } = useAppointments({
    startDate,
    endDate,
    status: statusFilter || undefined,
  });

  const filtered = (appointments ?? []).filter((a) => {
    if (!query) return true;
    const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const patient = patientById.get(a.patientId);
    const owner = a.ownerId ? ownerById.get(a.ownerId) : undefined;
    const haystack = [patient?.name ?? '', owner?.name ?? '', a.reason ?? ''].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return haystack.includes(q);
  });

  const navigateDate = (delta: number) => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + delta);
    else if (view === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
  };

  const handleCancel = async (id: string) => {
    try {
      await appointmentsService.cancel(id, 'Cancelado desde la agenda');
      toast({ variant: 'success', title: 'Turno cancelado' });
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo cancelar', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
    setOpenCancel(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await appointmentsService.changeStatus(id, status as AppointmentStatus);
      toast({ variant: 'success', title: 'Estado actualizado' });
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo cambiar el estado', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <PageHeader title="Agenda" />
        <div className="flex items-center justify-center min-h-[300px] text-ink-secondary dark:text-violet-200/70">
          Cargando turnos…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Agenda"
        subtitle="Turnos del día, semana y mes."
        actions={
          <Button onClick={() => { setEditingId(null); setPreselectedPatientId(undefined); setOpenForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo turno
          </Button>
        }
      />

      {/* Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-ink-main dark:text-violet-50 min-w-[140px] text-center">
            {view === 'day' && format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
            {view === 'week' && `Semana del ${format(startDate, 'd MMM', { locale: es })}`}
            {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: es })}
          </span>
          <Button variant="subtle" size="sm" onClick={() => navigateDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={view === 'day' ? 'primary' : 'subtle'} size="sm" onClick={() => setView('day')}>
            Día
          </Button>
          <Button variant={view === 'week' ? 'primary' : 'subtle'} size="sm" onClick={() => setView('week')}>
            Semana
          </Button>
          <Button variant={view === 'month' ? 'primary' : 'subtle'} size="sm" onClick={() => setView('month')}>
            Mes
          </Button>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <div className="relative w-full sm:w-48">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente o propietario"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44 min-w-[160px]">
            <option value="">Todos los estados</option>
            <option value="scheduled">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="completed">Realizado</option>
            <option value="cancelled">Cancelado</option>
            <option value="no-show">Ausente</option>
          </Select>
        </div>
      </div>

      {/* Vista diaria: timeline */}
      {view === 'day' && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8 text-violet-600" />}
              title="Sin turnos para este día"
              description="No hay turnos programados para esta fecha."
              action={{ label: 'Crear turno', onClick: () => { setEditingId(null); setPreselectedPatientId(undefined); setOpenForm(true); }, variant: 'primary' }}
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((apt) => {
                const patient = patientById.get(apt.patientId);
                const owner = apt.ownerId ? ownerById.get(apt.ownerId) : undefined;
                const start = new Date(apt.startsAt);
                const end = new Date(start.getTime() + apt.durationMinutes * 60 * 1000);
                const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
                const endTimeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

                return (
                  <div key={apt.id} className="flex items-start gap-4 p-4 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                    <div className="w-20 shrink-0 text-right">
                      <div className="text-sm font-medium text-ink-main dark:text-violet-50">{timeStr}</div>
                      <div className="text-xs text-ink-secondary dark:text-violet-200/70">{endTimeStr}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AppointmentStatusBadge status={apt.status} />
                        <span className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{patient?.name ?? 'Paciente desconocido'}</span>
                      </div>
                      <div className="text-xs text-ink-secondary dark:text-violet-200/70">
                        {owner?.name && <span>{owner.name} · </span>}
                        {apt.reason && <span>{apt.reason} · </span>}
                        <span>{apt.durationMinutes} min</span>
                      </div>
                      {apt.notes && <p className="text-xs text-ink-secondary dark:text-violet-200/70 mt-1">{apt.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      {apt.status === 'scheduled' && (
                        <Button variant="subtle" size="sm" onClick={() => handleStatusChange(apt.id, 'confirmed')} title="Confirmar">
                          Confirmar
                        </Button>
                      )}
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no-show' && (
                        <Button variant="destructive" size="sm" onClick={() => setOpenCancel({ id: apt.id, name: patient?.name ?? 'este turno' })} title="Cancelar">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <WhatsAppButton
                        phone={owner?.phone ?? null}
                        templateContent="Hola {nombre_propietario}, te confirmamos el turno de {nombre_paciente} para el día {fecha_turno} a las {hora_turno}. ¡Te esperamos en {nombre_clinica}!"
                        data={{
                          nombre_propietario: owner?.name ?? '',
                          nombre_paciente: patient?.name ?? '',
                          fecha_turno: format(start, 'dd/MM/yyyy', { locale: es }),
                          hora_turno: format(start, 'HH:mm', { locale: es }),
                          nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
                        }}
                        ownerId={owner?.id ?? null}
                        patientId={apt.patientId}
                        label="Confirmar"
                      />
                      <WhatsAppButton
                        phone={owner?.phone ?? null}
                        templateContent="Hola {nombre_propietario}, te recordamos que {nombre_paciente} tiene su sesión de fisioterapia veterinaria el día {fecha_turno} a las {hora_turno}. ¡Te esperamos!"
                        data={{
                          nombre_propietario: owner?.name ?? '',
                          nombre_paciente: patient?.name ?? '',
                          fecha_turno: format(start, 'dd/MM/yyyy', { locale: es }),
                          hora_turno: format(start, 'HH:mm', { locale: es }),
                          nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
                        }}
                        ownerId={owner?.id ?? null}
                        patientId={apt.patientId}
                        label="Recordar"
                      />
                      <WhatsAppButton
                        phone={owner?.phone ?? null}
                        templateContent="Hola {nombre_propietario}, te informamos que el turno de {nombre_paciente} del {fecha_turno} a las {hora_turno} fue reprogramado. Te avisaremos la nueva fecha. Disculpá las molestias."
                        data={{
                          nombre_propietario: owner?.name ?? '',
                          nombre_paciente: patient?.name ?? '',
                          fecha_turno: format(start, 'dd/MM/yyyy', { locale: es }),
                          hora_turno: format(start, 'HH:mm', { locale: es }),
                          nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
                        }}
                        ownerId={owner?.id ?? null}
                        patientId={apt.patientId}
                        label="Informar cambio"
                      />
                      <WhatsAppButton
                        phone={owner?.phone ?? null}
                        templateContent="Hola {nombre_propietario}, te informamos que el turno de {nombre_paciente} del {fecha_turno} a las {hora_turno} fue cancelado. Podés reprogramarlo cuando quieras."
                        data={{
                          nombre_propietario: owner?.name ?? '',
                          nombre_paciente: patient?.name ?? '',
                          fecha_turno: format(start, 'dd/MM/yyyy', { locale: es }),
                          hora_turno: format(start, 'HH:mm', { locale: es }),
                          nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
                        }}
                        ownerId={owner?.id ?? null}
                        patientId={apt.patientId}
                        label="Informar cancelación"
                      />
                      <WhatsAppButton
                        phone={owner?.phone ?? null}
                        templateContent="Hola {nombre_propietario}, "
                        data={{
                          nombre_propietario: owner?.name ?? '',
                          nombre_paciente: patient?.name ?? '',
                          fecha_turno: format(start, 'dd/MM/yyyy', { locale: es }),
                          hora_turno: format(start, 'HH:mm', { locale: es }),
                          nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
                        }}
                        ownerId={owner?.id ?? null}
                        patientId={apt.patientId}
                        label="Contactar"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista semanal */}
      {view === 'week' && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8 text-violet-600" />}
              title="Sin turnos para esta semana"
              description="No hay turnos programados para esta semana."
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((apt) => {
                const patient = patientById.get(apt.patientId);
                const owner = apt.ownerId ? ownerById.get(apt.ownerId) : undefined;
                const start = new Date(apt.startsAt);
                return (
                  <div key={apt.id} className="flex items-start gap-4 p-4 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                    <div className="w-24 shrink-0 text-right">
                      <div className="text-sm font-medium text-ink-main dark:text-violet-50">{format(start, 'EEE d MMM', { locale: es })}</div>
                      <div className="text-xs text-ink-secondary dark:text-violet-200/70">{format(start, 'HH:mm', { locale: es })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AppointmentStatusBadge status={apt.status} />
                        <span className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{patient?.name ?? 'Paciente desconocido'}</span>
                      </div>
                      <div className="text-xs text-ink-secondary dark:text-violet-200/70">
                        {owner?.name && <span>{owner.name} · </span>}
                        {apt.reason && <span>{apt.reason} · </span>}
                        <span>{apt.durationMinutes} min</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {apt.status === 'scheduled' && (
                        <Button variant="subtle" size="sm" onClick={() => handleStatusChange(apt.id, 'confirmed')} title="Confirmar">
                          Confirmar
                        </Button>
                      )}
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no-show' && (
                        <Button variant="destructive" size="sm" onClick={() => setOpenCancel({ id: apt.id, name: patient?.name ?? 'este turno' })} title="Cancelar">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista mensual */}
      {view === 'month' && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8 text-violet-600" />}
              title="Sin turnos para este mes"
              description="No hay turnos programados para este mes."
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((apt) => {
                const patient = patientById.get(apt.patientId);
                const owner = apt.ownerId ? ownerById.get(apt.ownerId) : undefined;
                const start = new Date(apt.startsAt);
                return (
                  <div key={apt.id} className="flex items-start gap-4 p-4 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                    <div className="w-24 shrink-0 text-right">
                      <div className="text-sm font-medium text-ink-main dark:text-violet-50">{format(start, 'd MMM', { locale: es })}</div>
                      <div className="text-xs text-ink-secondary dark:text-violet-200/70">{format(start, 'HH:mm', { locale: es })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AppointmentStatusBadge status={apt.status} />
                        <span className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{patient?.name ?? 'Paciente desconocido'}</span>
                      </div>
                      <div className="text-xs text-ink-secondary dark:text-violet-200/70">
                        {owner?.name && <span>{owner.name} · </span>}
                        {apt.reason && <span>{apt.reason} · </span>}
                        <span>{apt.durationMinutes} min</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {apt.status === 'scheduled' && (
                        <Button variant="subtle" size="sm" onClick={() => handleStatusChange(apt.id, 'confirmed')} title="Confirmar">
                          Confirmar
                        </Button>
                      )}
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no-show' && (
                        <Button variant="destructive" size="sm" onClick={() => setOpenCancel({ id: apt.id, name: patient?.name ?? 'este turno' })} title="Cancelar">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editingId ? 'Editar turno' : 'Nuevo turno'}>
        <AppointmentForm
          onClose={() => setOpenForm(false)}
          initialAppointmentId={editingId ?? undefined}
          preselectedPatientId={preselectedPatientId}
        />
      </Modal>

      <ConfirmDialog
        open={openCancel !== null}
        onConfirm={() => handleCancel(openCancel!.id)}
        onCancel={() => setOpenCancel(null)}
        title={`¿Cancelar el turno de ${openCancel?.name}?`}
        description="Esta acción cancelará el turno y liberará el horario."
        confirmLabel="Cancelar turno"
        cancelLabel="Volver"
        destructive
      />
    </div>
  );
}
