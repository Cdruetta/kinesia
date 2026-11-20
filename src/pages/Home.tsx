import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAppointments } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { useSessions } from '@/hooks/useSessions';
import { useSettings } from '@/hooks/useSettings';
import { useOwners } from '@/hooks/useOwners';
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge';
import {
  Calendar,
  AlertTriangle,
  Plus,
  UserPlus,
  PawPrint,
  FileText,
  ClipboardList,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    toast({
      variant: 'default',
      title: 'Bienvenido a Kinesia',
      description: 'Panel de control de la clínica.',
    });
  }, []);
  const { data: settings } = useSettings();
  const { data: appointments } = useAppointments();
  const { data: patients } = usePatients({});
  const { data: sessions } = useSessions();
  const { data: owners } = useOwners();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const activePatients = (patients ?? []).filter((p) => !p.archivedAt);

  const todayAppointments = (appointments ?? []).filter((a) => {
    const d = new Date(a.startsAt);
    return d >= todayStart && d <= todayEnd && !a.archivedAt;
  });

  const upcomingAppointments = (appointments ?? [])
    .filter((a) => {
      const d = new Date(a.startsAt);
      return d > todayEnd && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && !a.archivedAt && a.status !== 'cancelled' && a.status !== 'no-show' && a.status !== 'completed';
    })
    .slice(0, 5);

  const pendingConfirmation = (appointments ?? []).filter((a) => a.status === 'scheduled' && !a.archivedAt);

  const sessionsThisWeek = (sessions ?? []).filter((s) => {
    const d = new Date(s.sessionAt);
    return d >= weekStart && d <= weekEnd && !s.archivedAt;
  });

  const sessionsThisMonth = (sessions ?? []).filter((s) => {
    const d = new Date(s.sessionAt);
    return d >= monthStart && d <= monthEnd && !s.archivedAt;
  });

  const followUpDays = settings?.followUpDays ?? 30;
  const cutoffDate = new Date(now.getTime() - followUpDays * 24 * 60 * 60 * 1000);

  const patientsNeedingFollowUp = activePatients.filter((p) => {
    const patientSessions = (sessions ?? []).filter((s) => s.patientId === p.id && !s.archivedAt);
    const lastSession = patientSessions.length > 0
      ? patientSessions.reduce((latest, s) => (new Date(s.sessionAt) > new Date(latest.sessionAt) ? s : latest))
      : null;
    const hasFutureAppointment = (appointments ?? []).some((a) => a.patientId === p.id && !a.archivedAt && new Date(a.startsAt) > now && a.status !== 'cancelled' && a.status !== 'no-show');
    if (hasFutureAppointment) return false;
    if (!lastSession) return true;
    return new Date(lastSession.sessionAt) < cutoffDate;
  });

  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Inicio"
        subtitle="Panel de la clínica: turnos, pacientes y seguimiento."
      />

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => navigate('/agenda')}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo turno
        </Button>
        <Button variant="subtle" size="sm" onClick={() => navigate('/propietarios')}>
          <UserPlus className="w-4 h-4 mr-2" /> Registrar propietario
        </Button>
        <Button variant="subtle" size="sm" onClick={() => navigate('/pacientes')}>
          <PawPrint className="w-4 h-4 mr-2" /> Registrar paciente
        </Button>
        <Button variant="subtle" size="sm" onClick={() => navigate('/pacientes')}>
          <FileText className="w-4 h-4 mr-2" /> Nueva ficha fisiátrica
        </Button>
        <Button variant="subtle" size="sm" onClick={() => navigate('/pacientes')}>
          <ClipboardList className="w-4 h-4 mr-2" /> Registrar sesión
        </Button>
        <Button variant="subtle" size="sm" onClick={() => navigate('/comunicaciones')}>
          <MessageSquare className="w-4 h-4 mr-2" /> Enviar WhatsApp
        </Button>
      </div>

      {/* Turnos de hoy */}
      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
        <div className="px-6 py-4 border-b border-border dark:border-violet-800/30 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Turnos de hoy</h2>
          <span className="text-xs font-semibold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded">
            {todayAppointments.length}
          </span>
        </div>
        {todayAppointments.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-6 h-6 text-violet-600" />}
            title="Sin turnos para hoy"
            description="No hay turnos programados para el día de hoy."
          />
        ) : (
          <div className="divide-y divide-border">
            {todayAppointments.map((apt) => {
              const patient = patientById.get(apt.patientId);
              const owner = apt.ownerId ? ownerById.get(apt.ownerId) : undefined;
              const start = new Date(apt.startsAt);
              return (
                <div key={apt.id} className="flex items-center gap-4 px-6 py-3 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                  <div className="w-16 shrink-0 text-right">
                    <div className="text-sm font-medium text-ink-main dark:text-violet-50">{format(start, 'HH:mm', { locale: es })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{patient?.name ?? 'Paciente desconocido'}</span>
                      <AppointmentStatusBadge status={apt.status} />
                    </div>
                    {owner && <p className="text-xs text-ink-secondary dark:text-violet-200/70">{owner.name}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-secondary dark:text-violet-200/70 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-4">
          <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Pacientes activos</div>
          <div className="text-2xl font-bold text-ink-main dark:text-violet-50">{activePatients.length}</div>
        </div>
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-4">
          <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Pendientes de confirmar</div>
          <div className="text-2xl font-bold text-ink-main dark:text-violet-50">{pendingConfirmation.length}</div>
        </div>
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-4">
          <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Sesiones esta semana</div>
          <div className="text-2xl font-bold text-ink-main dark:text-violet-50">{sessionsThisWeek.length}</div>
        </div>
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-4">
          <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Sesiones este mes</div>
          <div className="text-2xl font-bold text-ink-main dark:text-violet-50">{sessionsThisMonth.length}</div>
        </div>
      </div>

      {/* Pacientes que requieren seguimiento */}
      {patientsNeedingFollowUp.length > 0 && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          <div className="px-6 py-4 border-b border-border dark:border-violet-800/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-text" />
            <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Pacientes que requieren seguimiento</h2>
            <span className="text-xs font-semibold text-warning-text bg-warning-bg px-2 py-0.5 rounded">
              {patientsNeedingFollowUp.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {patientsNeedingFollowUp.slice(0, 5).map((p) => {
              const owner = p.ownerId ? ownerById.get(p.ownerId) : undefined;
              return (
                <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                  <PawPrint className="w-4 h-4 text-violet-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{p.name}</p>
                    <p className="text-xs text-ink-secondary dark:text-violet-200/70">{p.species}{owner ? ` · ${owner.name}` : ''}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-secondary dark:text-violet-200/70 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Próximos turnos */}
      {upcomingAppointments.length > 0 && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          <div className="px-6 py-4 border-b border-border dark:border-violet-800/30">
            <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Próximos turnos</h2>
          </div>
          <div className="divide-y divide-border">
            {upcomingAppointments.map((apt) => {
              const patient = patientById.get(apt.patientId);
              const owner = apt.ownerId ? ownerById.get(apt.ownerId) : undefined;
              const start = new Date(apt.startsAt);
              return (
                <div key={apt.id} className="flex items-center gap-4 px-6 py-3 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                  <div className="w-20 shrink-0 text-right">
                    <div className="text-sm font-medium text-ink-main dark:text-violet-50">{format(start, 'dd/MM', { locale: es })}</div>
                    <div className="text-xs text-ink-secondary dark:text-violet-200/70">{format(start, 'HH:mm', { locale: es })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{patient?.name ?? 'Paciente desconocido'}</span>
                      <AppointmentStatusBadge status={apt.status} />
                    </div>
                    {owner && <p className="text-xs text-ink-secondary dark:text-violet-200/70">{owner.name}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-secondary dark:text-violet-200/70 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
