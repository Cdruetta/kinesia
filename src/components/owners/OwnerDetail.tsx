import { useParams, Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useOwner } from '@/hooks/useOwner';
import { usePatientsIncludingArchived } from '@/hooks/usePatients';
import { useAppointments } from '@/hooks/useAppointments';
import { useSettings } from '@/hooks/useSettings';
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';
import { Phone, PawPrint, Calendar, CalendarX, MapPin, AlertTriangle } from 'lucide-react';
import { formatPhoneForDisplay } from '@/utils/phones';
import { computeAge } from '@/utils/age';
import { formatDate, formatDateTime } from '@/utils/dates';

export function OwnerDetail() {
  const { id } = useParams();
  const { data: owner, loading } = useOwner(id);
  const { data: patients, loading: patientsLoading } = usePatientsIncludingArchived({ ownerId: id });
  const { data: appointments, loading: appointmentsLoading } = useAppointments();
  const { data: settings } = useSettings();

  if (loading || patientsLoading || appointmentsLoading) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <PageHeader title="Cargando…" />
        <div className="flex items-center justify-center min-h-[300px] text-ink-secondary dark:text-violet-200/70">
          Cargando información del propietario…
        </div>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="Propietario no encontrado" />
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-error-text" />}
          title="No se encontró el propietario"
          description="Es posible que haya sido archivado o eliminado."
        />
      </div>
    );
  }

  const activePatients = patients.filter((p) => !p.archivedAt);
  const patientIds = new Set(patients.map((patient) => patient.id));
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const ownerAppointments = (appointments ?? [])
    .filter((appointment) => patientIds.has(appointment.patientId))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Propietario"
        subtitle="Datos, pacientes y turnos asociados."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
            <h2 className="font-serif text-xl font-bold text-ink-main dark:text-violet-50 mb-2">
              {owner.name}
            </h2>
            <div className="space-y-3 text-sm text-ink-secondary dark:text-violet-200/70">
              {owner.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-violet-600 shrink-0" />
                  <span className="font-medium text-ink-main dark:text-violet-50">{formatPhoneForDisplay(owner.phone)}</span>
                </div>
              )}
              {owner.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <span className="font-medium text-ink-main dark:text-violet-50">{owner.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-violet-600 shrink-0" />
                <span className="font-medium text-ink-main dark:text-violet-50">
                  Registrado {formatDate(owner.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Pacientes</h3>
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded">
                {activePatients.length}
              </span>
            </div>
            {activePatients.length === 0 ? (
              <EmptyState
                icon={<PawPrint className="w-6 h-6 text-violet-600" />}
                title="Sin pacientes cargados"
                description="Los pacientes de este propietario aparecerán aquí."
              />
            ) : (
              <div className="space-y-3">
                {activePatients.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-violet-100 bg-violet-50 dark:bg-violet-900/20">
                    <PawPrint className="w-4 h-4 text-violet-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-main dark:text-violet-50 truncate">{p.name}</p>
                      <p className="text-xs text-ink-secondary dark:text-violet-200/70 truncate">
                        {p.species}{p.breed ? ` · ${p.breed}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-ink-secondary dark:text-violet-200/70">
                      {computeAge(p.birthDate)?.years != null
                        ? `${computeAge(p.birthDate)!.years} a`
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Turnos</h3>
              <Link
                to="/agenda"
                className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-300"
              >
                Ver agenda
              </Link>
            </div>
            {ownerAppointments.length === 0 ? (
              <EmptyState
                icon={<CalendarX className="w-6 h-6 text-ink-secondary dark:text-violet-200/70" />}
                title="Sin turnos registrados"
                description="Los turnos de los pacientes de este propietario aparecerán aquí."
              />
            ) : (
              <div className="space-y-3">
                {ownerAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border dark:border-violet-800/30 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-main dark:text-violet-50">
                        {patientById.get(appointment.patientId)?.name ?? 'Paciente'}
                      </p>
                      <p className="text-xs text-ink-secondary dark:text-violet-200/70">
                        {formatDateTime(appointment.startsAt)} · {appointment.durationMinutes} min
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
            <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Contacto</h3>
            <WhatsAppButton
              phone={owner.phone}
              templateContent="Hola {nombre_propietario}, "
              data={{
                nombre_propietario: owner.name,
                nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
              }}
              ownerId={owner.id}
              label="WhatsApp"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
