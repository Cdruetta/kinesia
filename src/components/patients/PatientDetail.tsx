import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsTrigger, TabsList } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { usePatient } from '@/hooks/usePatient';
import { useOwner } from '@/hooks/useOwner';
import { useAssessments } from '@/hooks/useAssessments';
import { useSessions } from '@/hooks/useSessions';
import { useSettings } from '@/hooks/useSettings';
import { generateAssessmentPdf, generateSessionPdf, generateTreatmentHistoryPdf, generatePatientPdf } from '@/export/pdf';
import { useCommunications } from '@/hooks/useCommunications';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { SessionForm } from '@/components/sessions/SessionForm';
import { PatientHistory } from '@/components/patients/PatientHistory';
import { PawPrint, FileText, Clock, Calendar, Mail, Plus } from 'lucide-react';
import { computeAge } from '@/utils/age';
import { formatDate } from '@/utils/dates';

export function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: patient, loading } = usePatient(id);
  const { data: owner, loading: ownerLoading } = useOwner(patient?.ownerId);
  const { data: assessments, loading: assessmentsLoading } = useAssessments(id);
  const { data: sessions, loading: sessionsLoading } = useSessions(id);
  const { data: communications } = useCommunications({ patientId: id });
  const { data: settings } = useSettings();
  const [activeTab, setActiveTab] = useState('resumen');
  const [openAssessmentForm, setOpenAssessmentForm] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | undefined>(undefined);
  const [openSessionForm, setOpenSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | undefined>(undefined);

  if (loading || ownerLoading) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <PageHeader title="Cargando…" />
        <div className="flex items-center justify-center min-h-[300px] text-ink-secondary dark:text-violet-200/70">
          Cargando información del paciente…
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="Paciente no encontrado" />
        <EmptyState
          icon={<PawPrint className="w-8 h-8 text-error-text" />}
          title="No se encontró el paciente"
          description="Es posible que haya sido archivado o eliminado."
        />
      </div>
    );
  }

  const age = computeAge(patient.birthDate);
  const ageText = age
    ? `${age.years} año${age.years !== 1 ? 's' : ''}, ${age.months ?? 0} mes${(age.months ?? 0) !== 1 ? 'es' : ''}`
    : 'Edad desconocida';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Paciente" subtitle={patient.name} />

      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink-main dark:text-violet-50">{patient.name}</h1>
            <p className="text-sm text-ink-secondary dark:text-violet-200/70">
              {patient.species}{patient.breed ? ` · ${patient.breed}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default">{patient.sex || '—'}</Badge>
            <Badge variant={patient.birthDateApproximate ? 'warning' : 'default'}>
              {patient.birthDateApproximate ? 'Nacimiento aproximado' : 'Edad calculada'}
            </Badge>
            <span className="text-sm font-medium text-ink-main dark:text-violet-50">{ageText}</span>
            {owner && (
              <WhatsAppButton
                phone={owner.phone}
                templateContent="Hola {nombre_propietario}, ¿cómo sigue {nombre_paciente}? Esperamos que la evolución sea positiva. Cualquier consulta, estamos a disposición."
                data={{
                  nombre_propietario: owner.name,
                  nombre_paciente: patient.name,
                  nombre_clinica: settings?.clinicName ?? 'Clínica Kinesia',
                }}
                ownerId={owner.id}
                patientId={patient.id}
                label="WhatsApp"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 rounded-lg p-4">
            <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Propietario</div>
            {owner ? (
              <Button
                variant="subtle"
                className="w-full text-left justify-between"
                onClick={() => navigate(`/propietarios/${owner.id}`)}
              >
                <span>{owner.name}</span>
              </Button>
            ) : (
              <span className="text-sm text-ink-secondary dark:text-violet-200/70">—</span>
            )}
          </div>
          <div className="bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 rounded-lg p-4">
            <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Fecha de alta</div>
            <p className="text-sm font-medium text-ink-main dark:text-violet-50">{formatDate(patient.createdAt)}</p>
          </div>
          <div className="bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 rounded-lg p-4">
            <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Nacimiento</div>
            <p className="text-sm font-medium text-ink-main dark:text-violet-50">
              {patient.birthDate ? formatDate(patient.birthDate) : '—'}
            </p>
          </div>
        </div>

        {patient.notes && (
          <div className="mt-6 rounded-lg border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-4">
            <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Observaciones</div>
            <p className="text-sm text-ink-main dark:text-violet-50">{patient.notes}</p>
          </div>
        )}
      </div>

      <Tabs>
        <TabsList>
          <TabsTrigger value="resumen" selected={activeTab === 'resumen'} onSelect={() => setActiveTab('resumen')}>
            <PawPrint className="w-4 h-4 mr-2" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="fichas" selected={activeTab === 'fichas'} onSelect={() => setActiveTab('fichas')}>
            <FileText className="w-4 h-4 mr-2" /> Fichas
          </TabsTrigger>
          <TabsTrigger value="sesiones" selected={activeTab === 'sesiones'} onSelect={() => setActiveTab('sesiones')}>
            <Clock className="w-4 h-4 mr-2" /> Sesiones
          </TabsTrigger>
          <TabsTrigger value="historial" selected={activeTab === 'historial'} onSelect={() => setActiveTab('historial')}>
            <Calendar className="w-4 h-4 mr-2" /> Historial
          </TabsTrigger>
          <TabsTrigger value="comunicaciones" selected={activeTab === 'comunicaciones'} onSelect={() => setActiveTab('comunicaciones')}>
            <Mail className="w-4 h-4 mr-2" /> Comunicaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" currentValue={activeTab}>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Resumen del paciente</h2>
              <Button variant="subtle" size="sm" onClick={() => settings && generatePatientPdf(patient, owner ?? null, settings)}>
                Exportar datos PDF
              </Button>
            </div>
            <p className="text-sm text-ink-secondary dark:text-violet-200/70">
              Aquí se muestran los datos principales del paciente. Las fichas fisiátricas,
              sesiones, historial clínico y comunicaciones se irán agregando en los módulos
              siguientes y aparecerán en sus respectivas pestañas.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="fichas" currentValue={activeTab}>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Fichas fisiátricas</h2>
              <Button onClick={() => { setEditingAssessmentId(undefined); setOpenAssessmentForm(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Nueva evaluación
              </Button>
            </div>
            {assessmentsLoading ? (
              <div className="text-ink-secondary dark:text-violet-200/70">Cargando fichas…</div>
            ) : (assessments ?? []).length === 0 ? (
              <EmptyState
                icon={<FileText className="w-6 h-6 text-violet-600" />}
                title="Sin fichas fisiátricas"
                description="Las evaluaciones del paciente aparecerán aquí."
              />
            ) : (
              <div className="space-y-3">
                {(assessments ?? []).map((a) => (
                  <div key={a.id} className="rounded-lg border border-border dark:border-violet-800/30 p-4 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                    <div className="flex items-center justify-between">
                      <div className="cursor-pointer" onClick={() => { setEditingAssessmentId(a.id); setOpenAssessmentForm(true); }}>
                        <p className="text-sm font-medium text-ink-main dark:text-violet-50">{formatDate(a.assessedAt)}</p>
                        {a.reason && <p className="text-xs text-ink-secondary dark:text-violet-200/70">{a.reason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">v{a.version}</Badge>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => settings && generateAssessmentPdf(a, patient, owner ?? null, settings)}
                          title="Exportar PDF"
                        >
                          PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sesiones" currentValue={activeTab}>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Sesiones de fisioterapia</h2>
              <Button onClick={() => { setEditingSessionId(undefined); setOpenSessionForm(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Nueva sesión
              </Button>
            </div>
            {sessionsLoading ? (
              <div className="text-ink-secondary dark:text-violet-200/70">Cargando sesiones…</div>
            ) : (sessions ?? []).length === 0 ? (
              <EmptyState
                icon={<Clock className="w-6 h-6 text-violet-600" />}
                title="Sin sesiones registradas"
                description="Las sesiones de fisioterapia aparecerán aquí."
              />
            ) : (
              <div className="space-y-3">
                {(sessions ?? []).map((s) => (
                  <div key={s.id} className="rounded-lg border border-border dark:border-violet-800/30 p-4 hover:bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10">
                    <div className="flex items-center justify-between">
                      <div className="cursor-pointer" onClick={() => { setEditingSessionId(s.id); setOpenSessionForm(true); }}>
                        <p className="text-sm font-medium text-ink-main dark:text-violet-50">{formatDate(s.sessionAt)}</p>
                        {s.evolution && <p className="text-xs text-ink-secondary dark:text-violet-200/70">{s.evolution}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {(s.treatments ?? []).filter((t) => t.applied).map((t, i) => (
                            <span key={i} className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 px-2 py-0.5 rounded">
                              {t.treatmentType === 'magnetoterapia' ? 'Magneto' :
                               t.treatmentType === 'laser' ? 'Láser' :
                               t.treatmentType === 'fotobiomodulacion' ? 'Foto' :
                               t.treatmentType === 'tens' ? 'TENS' :
                               t.treatmentType === 'electroestimulacion' ? 'EE' :
                               t.treatmentType === 'ultrasonido' ? 'US' :
                               t.treatmentType === 'ozonoterapia' ? 'O3' : t.treatmentType}
                            </span>
                          ))}
                        </div>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => settings && generateSessionPdf(s, patient, owner ?? null, settings)}
                          title="Exportar PDF"
                        >
                          PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historial" currentValue={activeTab}>
          <div className="p-6 space-y-4">
            <div className="flex justify-end">
              <Button variant="subtle" size="sm" onClick={() => settings && generateTreatmentHistoryPdf(patient, sessions ?? [], settings)}>
                Exportar historial PDF
              </Button>
            </div>
            <PatientHistory patientId={id!} />
          </div>
        </TabsContent>

        <TabsContent value="comunicaciones" currentValue={activeTab}>
          <div className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Comunicaciones</h2>
            {(communications ?? []).length === 0 ? (
              <EmptyState
                icon={<Mail className="w-6 h-6 text-violet-600" />}
                title="Sin comunicaciones"
                description="Los mensajes enviados por WhatsApp aparecerán aquí."
              />
            ) : (
              <div className="space-y-3">
                {(communications ?? []).map((c) => (
                  <div key={c.id} className="rounded-lg border border-border dark:border-violet-800/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ink-secondary dark:text-violet-200/70">{formatDate(c.createdAt)}</span>
                      <Badge variant={c.status === 'sent' ? 'success' : c.status === 'opened' ? 'default' : 'warning'}>
                        {c.status === 'prepared' ? 'Preparado' : c.status === 'opened' ? 'WhatsApp abierto' : 'Marcado como enviado'}
                      </Badge>
                    </div>
                    <p className="text-sm text-ink-main dark:text-violet-50">{c.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Modal open={openAssessmentForm} onClose={() => setOpenAssessmentForm(false)} title={editingAssessmentId ? 'Editar evaluación' : 'Nueva evaluación'}>
        <AssessmentForm
          onClose={() => setOpenAssessmentForm(false)}
          patientId={id!}
          assessmentId={editingAssessmentId}
        />
      </Modal>

      <Modal open={openSessionForm} onClose={() => setOpenSessionForm(false)} title={editingSessionId ? 'Editar sesión' : 'Nueva sesión'}>
        <SessionForm
          onClose={() => setOpenSessionForm(false)}
          patientId={id!}
          sessionId={editingSessionId}
        />
      </Modal>
    </div>
  );
}
