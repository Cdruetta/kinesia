import type { Cell, SheetData } from 'write-excel-file/browser';
import type {
  Appointment,
  Assessment,
  Communication,
  MessageTemplate,
  Owner,
  Patient,
  Session,
  Settings,
} from '@/models';
import { backupService, type BackupData } from '@/services/backupService';
import {
  buildCsvFiles,
  parseExportDateTime,
  parseLocalDate,
  type ExportColumn,
  type ExportTable,
  type ExportValue,
} from '@/utils/spreadsheetExport';
import { toLocalDateInput } from '@/utils/dates';

interface ExportData {
  owners: Owner[];
  patients: Patient[];
  appointments: Appointment[];
  assessments: Assessment[];
  sessions: Session[];
  communications: Communication[];
  messageTemplates: MessageTemplate[];
  settings: Settings[];
}

const APPOINTMENT_STATUS: Record<Appointment['status'], string> = {
  scheduled: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  'no-show': 'Ausente',
};

const SEX: Record<NonNullable<Patient['sex']>, string> = {
  macho: 'Macho',
  hembra: 'Hembra',
  otro: 'Otro',
};

const TREATMENT_LABELS: Record<Session['treatments'][number]['treatmentType'], string> = {
  magnetoterapia: 'Magnetoterapia',
  laser: 'Láser',
  fotobiomodulacion: 'Fotobiomodulación',
  tens: 'TENS',
  electroestimulacion: 'Electroestimulación',
  ultrasonido: 'Ultrasonido',
  ozonoterapia: 'Ozonoterapia',
};

const COMMUNICATION_TYPE: Record<Communication['type'], string> = {
  whatsapp: 'WhatsApp',
  call: 'Llamada',
  email: 'Correo',
};

const COMMUNICATION_DIRECTION: Record<Communication['direction'], string> = {
  inbound: 'Recibida',
  outbound: 'Enviada',
};

const COMMUNICATION_STATUS: Record<Communication['status'], string> = {
  prepared: 'Preparado',
  opened: 'WhatsApp abierto',
  sent: 'Marcado como enviado',
};

const TEMPLATE_CATEGORY: Record<MessageTemplate['category'], string> = {
  confirmacion_turno: 'Confirmación de turno',
  recordatorio_turno: 'Recordatorio de turno',
  reprogramacion: 'Reprogramación',
  cancelacion: 'Cancelación',
  recordatorio_sesion: 'Recordatorio de sesión',
  seguimiento_paciente: 'Seguimiento del paciente',
  consulta_evolucion: 'Consulta de evolución',
  personalizado: 'Personalizado',
};

function column(
  key: string,
  label: string,
  type: ExportColumn['type'] = 'text',
  width = 18
): ExportColumn {
  return { key, label, type, width };
}

function dateTime(value: string | null): Date | null {
  return parseExportDateTime(value);
}

function buildOwners(owners: Owner[]): ExportTable {
  return {
    sheetName: 'Propietarios',
    fileName: '01-propietarios.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('name', 'Nombre', 'text', 28),
      column('phone', 'Teléfono', 'text', 18),
      column('email', 'Correo', 'text', 28),
      column('address', 'Dirección', 'text', 32),
      column('notes', 'Notas', 'text', 32),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      address: owner.address,
      notes: owner.notes,
      createdAt: dateTime(owner.createdAt),
      updatedAt: dateTime(owner.updatedAt),
      archived: Boolean(owner.archivedAt),
      archivedAt: dateTime(owner.archivedAt),
    })),
  };
}

function buildPatients(patients: Patient[], ownersById: Map<string, Owner>): ExportTable {
  return {
    sheetName: 'Pacientes',
    fileName: '02-pacientes.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('ownerId', 'Propietario ID', 'text', 38),
      column('ownerName', 'Propietario', 'text', 28),
      column('name', 'Nombre', 'text', 24),
      column('species', 'Especie', 'text', 16),
      column('breed', 'Raza', 'text', 20),
      column('sex', 'Sexo', 'text', 14),
      column('birthDate', 'Fecha de nacimiento', 'date', 20),
      column('birthDateApproximate', 'Nacimiento aproximado', 'boolean', 22),
      column('notes', 'Notas', 'text', 32),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: patients.map((patient) => ({
      id: patient.id,
      ownerId: patient.ownerId,
      ownerName: ownersById.get(patient.ownerId)?.name ?? '',
      name: patient.name,
      species: patient.species,
      breed: patient.breed,
      sex: patient.sex ? SEX[patient.sex] : '',
      birthDate: parseLocalDate(patient.birthDate),
      birthDateApproximate: patient.birthDateApproximate,
      notes: patient.notes,
      createdAt: dateTime(patient.createdAt),
      updatedAt: dateTime(patient.updatedAt),
      archived: Boolean(patient.archivedAt),
      archivedAt: dateTime(patient.archivedAt),
    })),
  };
}

function buildAppointments(
  appointments: Appointment[],
  patientsById: Map<string, Patient>,
  ownersById: Map<string, Owner>
): ExportTable {
  return {
    sheetName: 'Turnos',
    fileName: '03-turnos.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('patientId', 'Paciente ID', 'text', 38),
      column('patientName', 'Paciente', 'text', 24),
      column('ownerId', 'Propietario ID', 'text', 38),
      column('ownerName', 'Propietario', 'text', 28),
      column('startsAt', 'Inicio', 'datetime', 20),
      column('durationMinutes', 'Duración (min)', 'number', 16),
      column('status', 'Estado', 'text', 16),
      column('reason', 'Motivo', 'text', 28),
      column('notes', 'Notas', 'text', 32),
      column('rescheduledFrom', 'Reprogramado desde', 'text', 38),
      column('previousStartsAt', 'Inicio anterior', 'datetime', 20),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: appointments.map((appointment) => ({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: patientsById.get(appointment.patientId)?.name ?? '',
      ownerId: appointment.ownerId,
      ownerName: appointment.ownerId ? ownersById.get(appointment.ownerId)?.name ?? '' : '',
      startsAt: dateTime(appointment.startsAt),
      durationMinutes: appointment.durationMinutes,
      status: APPOINTMENT_STATUS[appointment.status],
      reason: appointment.reason,
      notes: appointment.notes,
      rescheduledFrom: appointment.rescheduledFrom,
      previousStartsAt: dateTime(appointment.previousStartsAt),
      createdAt: dateTime(appointment.createdAt),
      updatedAt: dateTime(appointment.updatedAt),
      archived: Boolean(appointment.archivedAt),
      archivedAt: dateTime(appointment.archivedAt),
    })),
  };
}

function buildAssessments(
  assessments: Assessment[],
  patientsById: Map<string, Patient>
): ExportTable {
  return {
    sheetName: 'Evaluaciones',
    fileName: '04-evaluaciones.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('patientId', 'Paciente ID', 'text', 38),
      column('patientName', 'Paciente', 'text', 24),
      column('title', 'Título', 'text', 24),
      column('assessedAt', 'Fecha de evaluación', 'date', 20),
      column('ownerName', 'Propietario (snapshot)', 'text', 26),
      column('ownerAddress', 'Domicilio (snapshot)', 'text', 30),
      column('ownerPhone', 'Teléfono (snapshot)', 'text', 18),
      column('patientNameSnapshot', 'Paciente (snapshot)', 'text', 24),
      column('patientSpecies', 'Especie (snapshot)', 'text', 18),
      column('patientBreed', 'Raza (snapshot)', 'text', 20),
      column('patientSex', 'Sexo (snapshot)', 'text', 16),
      column('ageYears', 'Edad (años)', 'number', 14),
      column('ageMonths', 'Edad (meses)', 'number', 15),
      column('oncological', 'Oncológico', 'boolean', 16),
      column('orthoNeuro', 'Clasificación', 'text', 20),
      column('orthoNeuroDetails', 'Detalles orto/neuro', 'text', 28),
      column('ambulatory', 'Ambulatorio', 'boolean', 16),
      column('nodules', 'Nódulos', 'text', 24),
      column('mentalState', 'Estado mental', 'text', 18),
      column('preexistingDiseases', 'Enfermedades preexistentes', 'text', 30),
      column('referredBy', 'Derivado por', 'text', 24),
      column('reason', 'Motivo', 'text', 30),
      column('diagnosis', 'Diagnóstico', 'text', 32),
      column('studies', 'Estudios', 'text', 30),
      column('complements', 'Complementos', 'text', 28),
      column('medicalTreatments', 'Tratamientos médicos', 'text', 30),
      column('additionalObservations', 'Observaciones adicionales', 'text', 34),
      column('version', 'Versión', 'number', 12),
      column('previousVersionId', 'Versión anterior ID', 'text', 38),
      column('isLatest', 'Es versión actual', 'boolean', 18),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: assessments.map((assessment) => ({
      id: assessment.id,
      patientId: assessment.patientId,
      patientName: patientsById.get(assessment.patientId)?.name ?? '',
      title: assessment.title,
      assessedAt: parseLocalDate(assessment.assessedAt),
      ownerName: assessment.ownerSnapshot?.name ?? '',
      ownerAddress: assessment.ownerSnapshot?.address ?? '',
      ownerPhone: assessment.ownerSnapshot?.phone ?? '',
      patientNameSnapshot: assessment.patientSnapshot?.name ?? '',
      patientSpecies: assessment.patientSnapshot?.species ?? '',
      patientBreed: assessment.patientSnapshot?.breed ?? '',
      patientSex: assessment.patientSnapshot?.sex
        ? SEX[assessment.patientSnapshot.sex]
        : '',
      ageYears: assessment.patientSnapshot?.ageYears ?? null,
      ageMonths: assessment.patientSnapshot?.ageMonths ?? null,
      oncological: assessment.patientSnapshot?.oncological ?? null,
      orthoNeuro: assessment.patientSnapshot?.orthoNeuro ?? '',
      orthoNeuroDetails: assessment.patientSnapshot?.orthoNeuroDetails ?? '',
      ambulatory: assessment.patientSnapshot?.ambulatory ?? null,
      nodules: assessment.patientSnapshot?.nodules ?? '',
      mentalState: assessment.patientSnapshot?.mentalState ?? '',
      preexistingDiseases: assessment.patientSnapshot?.preexistingDiseases ?? '',
      referredBy: assessment.referredBy,
      reason: assessment.reason,
      diagnosis: assessment.diagnosis,
      studies: assessment.studies,
      complements: assessment.complements,
      medicalTreatments: assessment.medicalTreatments,
      additionalObservations: assessment.additionalObservations,
      version: assessment.version,
      previousVersionId: assessment.previousVersionId,
      isLatest: assessment.isLatest,
      createdAt: dateTime(assessment.createdAt),
      updatedAt: dateTime(assessment.updatedAt),
      archived: Boolean(assessment.archivedAt),
      archivedAt: dateTime(assessment.archivedAt),
    })),
  };
}

function buildSessions(
  sessions: Session[],
  patientsById: Map<string, Patient>,
  assessmentsById: Map<string, Assessment>,
  appointmentsById: Map<string, Appointment>
): ExportTable {
  return {
    sheetName: 'Sesiones',
    fileName: '05-sesiones.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('patientId', 'Paciente ID', 'text', 38),
      column('patientName', 'Paciente', 'text', 24),
      column('assessmentId', 'Ficha ID', 'text', 38),
      column('assessmentTitle', 'Ficha', 'text', 26),
      column('linkedAppointmentId', 'Turno ID', 'text', 38),
      column('appointmentStartsAt', 'Fecha del turno', 'datetime', 20),
      column('sessionAt', 'Fecha de sesión', 'datetime', 20),
      column('generalObservations', 'Observaciones generales', 'text', 34),
      column('evolution', 'Evolución', 'text', 34),
      column('appliedTreatments', 'Tratamientos aplicados', 'text', 42),
      column('version', 'Versión', 'number', 12),
      column('previousVersionId', 'Versión anterior ID', 'text', 38),
      column('isLatest', 'Es versión actual', 'boolean', 18),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: sessions.map((session) => {
      const linkedAppointment = session.linkedAppointmentId
        ? appointmentsById.get(session.linkedAppointmentId)
        : undefined;
      const appliedTreatments = session.treatments
        .filter((treatment) => treatment.applied)
        .map((treatment) => TREATMENT_LABELS[treatment.treatmentType])
        .join(' | ');

      return {
        id: session.id,
        patientId: session.patientId,
        patientName: patientsById.get(session.patientId)?.name ?? '',
        assessmentId: session.assessmentId,
        assessmentTitle: session.assessmentId
          ? assessmentsById.get(session.assessmentId)?.title ?? ''
          : '',
        linkedAppointmentId: session.linkedAppointmentId,
        appointmentStartsAt: linkedAppointment ? dateTime(linkedAppointment.startsAt) : null,
        sessionAt: dateTime(session.sessionAt),
        generalObservations: session.generalObservations,
        evolution: session.evolution,
        appliedTreatments,
        version: session.version,
        previousVersionId: session.previousVersionId,
        isLatest: session.isLatest,
        createdAt: dateTime(session.createdAt),
        updatedAt: dateTime(session.updatedAt),
        archived: Boolean(session.archivedAt),
        archivedAt: dateTime(session.archivedAt),
      };
    }),
  };
}

function buildTreatments(
  sessions: Session[],
  patientsById: Map<string, Patient>
): ExportTable {
  return {
    sheetName: 'Tratamientos',
    fileName: '06-tratamientos.csv',
    columns: [
      column('sessionId', 'Sesión ID', 'text', 38),
      column('patientId', 'Paciente ID', 'text', 38),
      column('patientName', 'Paciente', 'text', 24),
      column('sessionAt', 'Fecha de sesión', 'datetime', 20),
      column('treatmentType', 'Tratamiento', 'text', 24),
      column('applied', 'Aplicado', 'boolean', 12),
      column('zone', 'Zona', 'text', 22),
      column('intensity', 'Intensidad', 'text', 16),
      column('intensityUnit', 'Unidad', 'text', 14),
      column('timeMinutes', 'Tiempo (min)', 'number', 16),
      column('dose', 'Dosis / Configuración', 'text', 24),
      column('frequency', 'Frecuencia / Modo', 'text', 22),
      column('additionalParams', 'Parámetros adicionales', 'text', 34),
      column('observations', 'Observaciones', 'text', 32),
      column('sessionVersion', 'Versión de sesión', 'number', 16),
      column('isLatest', 'Es versión actual', 'boolean', 18),
    ],
    rows: sessions.flatMap((session) =>
      session.treatments.map((treatment) => ({
        sessionId: session.id,
        patientId: session.patientId,
        patientName: patientsById.get(session.patientId)?.name ?? '',
        sessionAt: dateTime(session.sessionAt),
        treatmentType: TREATMENT_LABELS[treatment.treatmentType],
        applied: treatment.applied,
        zone: treatment.zone,
        intensity: treatment.intensity,
        intensityUnit: treatment.intensityUnit,
        timeMinutes: treatment.timeMinutes,
        dose: treatment.dose,
        frequency: treatment.frequency,
        additionalParams: JSON.stringify(treatment.additionalParams),
        observations: treatment.observations,
        sessionVersion: session.version,
        isLatest: session.isLatest,
      }))
    ),
  };
}

function buildCommunications(
  communications: Communication[],
  patientsById: Map<string, Patient>,
  ownersById: Map<string, Owner>,
  templatesById: Map<string, MessageTemplate>
): ExportTable {
  return {
    sheetName: 'Comunicaciones',
    fileName: '07-comunicaciones.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('type', 'Tipo', 'text', 16),
      column('direction', 'Dirección', 'text', 16),
      column('contact', 'Contacto', 'text', 24),
      column('message', 'Mensaje', 'text', 40),
      column('status', 'Estado', 'text', 22),
      column('patientId', 'Paciente ID', 'text', 38),
      column('patientName', 'Paciente', 'text', 24),
      column('ownerId', 'Propietario ID', 'text', 38),
      column('ownerName', 'Propietario', 'text', 28),
      column('templateId', 'Plantilla ID', 'text', 38),
      column('templateName', 'Plantilla', 'text', 24),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: communications.map((communication) => ({
      id: communication.id,
      type: COMMUNICATION_TYPE[communication.type],
      direction: COMMUNICATION_DIRECTION[communication.direction],
      contact: communication.contact,
      message: communication.message,
      status: COMMUNICATION_STATUS[communication.status],
      patientId: communication.patientId,
      patientName: communication.patientId
        ? patientsById.get(communication.patientId)?.name ?? ''
        : '',
      ownerId: communication.ownerId,
      ownerName: communication.ownerId ? ownersById.get(communication.ownerId)?.name ?? '' : '',
      templateId: communication.templateId,
      templateName: communication.templateId
        ? templatesById.get(communication.templateId)?.name ?? ''
        : '',
      createdAt: dateTime(communication.createdAt),
      updatedAt: dateTime(communication.updatedAt),
      archived: Boolean(communication.archivedAt),
      archivedAt: dateTime(communication.archivedAt),
    })),
  };
}

function buildTemplates(templates: MessageTemplate[]): ExportTable {
  return {
    sheetName: 'Plantillas',
    fileName: '08-plantillas.csv',
    columns: [
      column('id', 'ID', 'text', 38),
      column('name', 'Nombre', 'text', 28),
      column('category', 'Categoría', 'text', 26),
      column('content', 'Contenido', 'text', 48),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
      column('archived', 'Archivado', 'boolean', 12),
      column('archivedAt', 'Fecha de archivado', 'datetime', 20),
    ],
    rows: templates.map((template) => ({
      id: template.id,
      name: template.name,
      category: TEMPLATE_CATEGORY[template.category],
      content: template.content,
      createdAt: dateTime(template.createdAt),
      updatedAt: dateTime(template.updatedAt),
      archived: Boolean(template.archivedAt),
      archivedAt: dateTime(template.archivedAt),
    })),
  };
}

function buildSettings(settings: Settings[]): ExportTable {
  return {
    sheetName: 'Configuración',
    fileName: '09-configuracion.csv',
    columns: [
      column('id', 'ID', 'text', 16),
      column('clinicName', 'Clínica', 'text', 28),
      column('address', 'Dirección', 'text', 32),
      column('phone', 'Teléfono', 'text', 18),
      column('whatsapp', 'WhatsApp', 'text', 18),
      column('email', 'Correo', 'text', 28),
      column('hours', 'Horarios (JSON)', 'text', 48),
      column('defaultAppointmentDuration', 'Duración predeterminada', 'number', 24),
      column('printLogo', 'Imprimir logotipo', 'boolean', 20),
      column('printFooter', 'Imprimir pie', 'boolean', 18),
      column('followUpDays', 'Días de seguimiento', 'number', 20),
      column('theme', 'Tema', 'text', 14),
      column('pinEnabled', 'PIN habilitado', 'boolean', 18),
      column('autoLockMinutes', 'Bloqueo automático (min)', 'number', 24),
      column('lastBackupDate', 'Último respaldo', 'datetime', 20),
      column('backupReminderDays', 'Recordatorio de respaldo (días)', 'number', 28),
      column('createdAt', 'Creado', 'datetime', 20),
      column('updatedAt', 'Modificado', 'datetime', 20),
    ],
    rows: settings.map((setting) => ({
      id: setting.id,
      clinicName: setting.clinicName,
      address: setting.address,
      phone: setting.phone,
      whatsapp: setting.whatsapp,
      email: setting.email,
      hours: setting.hours,
      defaultAppointmentDuration: setting.defaultAppointmentDuration,
      printLogo: setting.printLogo,
      printFooter: setting.printFooter,
      followUpDays: setting.followUpDays,
      theme: setting.theme,
      pinEnabled: setting.pinEnabled,
      autoLockMinutes: setting.autoLockMinutes,
      lastBackupDate: dateTime(setting.lastBackupDate),
      backupReminderDays: setting.backupReminderDays,
      createdAt: dateTime(setting.createdAt),
      updatedAt: dateTime(setting.updatedAt),
    })),
  };
}

export function buildSpreadsheetTables(backup: BackupData): ExportTable[] {
  const data = backup.data as unknown as ExportData;
  const ownersById = new Map(data.owners.map((owner) => [owner.id, owner]));
  const patientsById = new Map(data.patients.map((patient) => [patient.id, patient]));
  const assessmentsById = new Map(data.assessments.map((assessment) => [assessment.id, assessment]));
  const appointmentsById = new Map(
    data.appointments.map((appointment) => [appointment.id, appointment])
  );
  const templatesById = new Map(
    data.messageTemplates.map((template) => [template.id, template])
  );

  return [
    buildOwners(data.owners),
    buildPatients(data.patients, ownersById),
    buildAppointments(data.appointments, patientsById, ownersById),
    buildAssessments(data.assessments, patientsById),
    buildSessions(data.sessions, patientsById, assessmentsById, appointmentsById),
    buildTreatments(data.sessions, patientsById),
    buildCommunications(
      data.communications,
      patientsById,
      ownersById,
      templatesById
    ),
    buildTemplates(data.messageTemplates),
    buildSettings(data.settings),
  ];
}

function toCell(value: ExportValue, type: ExportColumn['type']): Cell {
  if (value === null) return '';
  if (value instanceof Date) {
    return {
      value,
      type: Date,
      format: type === 'date' ? 'dd/mm/yyyy' : 'dd/mm/yyyy hh:mm',
    };
  }
  if (typeof value === 'number') return { value, type: Number };
  if (typeof value === 'boolean') return { value, type: Boolean };
  return value;
}

function toSheetData(table: ExportTable): SheetData {
  const header = table.columns.map((columnDefinition) => ({
    value: columnDefinition.label,
    fontWeight: 'bold' as const,
  }));
  const rows = table.rows.map((row) =>
    table.columns.map((columnDefinition) =>
      toCell(row[columnDefinition.key] ?? null, columnDefinition.type)
    )
  );
  return [header, ...rows];
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const spreadsheetExportService = {
  async downloadXlsx(): Promise<void> {
    const backup = await backupService.exportAll();
    const tables = buildSpreadsheetTables(backup);
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const sheets = tables.map((table) => ({
      data: toSheetData(table),
      sheet: table.sheetName,
      columns: table.columns.map((columnDefinition) => ({
        width: columnDefinition.width ?? 18,
      })),
      stickyRowsCount: 1,
    }));

    await writeXlsxFile(sheets).toFile(`kinesia-datos-${toLocalDateInput()}.xlsx`);
    await backupService.markBackupExported();
  },

  async downloadCsvArchive(): Promise<void> {
    const backup = await backupService.exportAll();
    const tables = buildSpreadsheetTables(backup);
    const csvFiles = buildCsvFiles(tables, new Date(backup.exportedAt));
    const { strToU8, zipSync } = await import('fflate');
    const entries = Object.fromEntries(
      Object.entries(csvFiles).map(([fileName, content]) => [fileName, strToU8(content)])
    );
    const archive = zipSync(entries, { level: 6 });
    const blob = new Blob([archive], { type: 'application/zip' });

    downloadBlob(blob, `kinesia-csv-${toLocalDateInput()}.zip`);
    await backupService.markBackupExported();
  },
};
