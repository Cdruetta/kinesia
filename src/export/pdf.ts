import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Patient, Owner, Assessment, Session, Settings } from '@/models';

const VIOLET = [112, 81, 166] as [number, number, number]; // #7051A6
const VIOLET_DEEP = [73, 52, 109] as [number, number, number]; // #49346D
const TEXT_MAIN = [48, 42, 56] as [number, number, number]; // #302A38
const TEXT_SEC = [110, 100, 121] as [number, number, number]; // #6E6479
const BORDER = [232, 225, 239] as [number, number, number]; // #E8E1EF

function addHeader(doc: jsPDF, settings: Settings, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Logotipo
  if (settings.printLogo && settings.logo) {
    try {
      doc.addImage(settings.logo, 'PNG', 14, 10, 16, 16);
    } catch {
      // Si el logo no se puede cargar, seguir sin él
    }
  }

  // Nombre de la clínica
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(VIOLET_DEEP[0], VIOLET_DEEP[1], VIOLET_DEEP[2]);
  doc.text(settings.clinicName, settings.printLogo && settings.logo ? 34 : 14, 18);

  // Título del documento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
  doc.text(title, 14, 32);

  // Fecha de emisión
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_SEC[0], TEXT_SEC[1], TEXT_SEC[2]);
  const today = new Date().toLocaleDateString('es-AR');
  doc.text(`Emitido el ${today}`, pageWidth - 14, 18, { align: 'right' });

  // Línea separadora
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.5);
  doc.line(14, 36, pageWidth - 14, 36);
}

function addFooter(doc: jsPDF, settings: Settings) {
  if (!settings.printFooter) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.internal.pages.length - 1;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_SEC[0], TEXT_SEC[1], TEXT_SEC[2]);

    if (settings.address) {
      doc.text(settings.address, 14, pageHeight - 10);
    }
    if (settings.phone) {
      doc.text(`Tel: ${settings.phone}`, 14, pageHeight - 6);
    }
    if (settings.email) {
      doc.text(settings.email, pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }
}

function addPatientInfo(doc: jsPDF, patient: Patient, owner: Owner | null, startY: number): number {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
  doc.text('Datos del paciente', 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Nombre', patient.name],
      ['Especie', patient.species],
      ['Raza', patient.breed ?? '—'],
      ['Sexo', patient.sex ?? '—'],
      ['Fecha de nacimiento', patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-AR') : '—'],
      ['Propietario', owner?.name ?? '—'],
      ['Teléfono', owner?.phone ?? '—'],
      ['Domicilio', owner?.address ?? '—'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 8;
}

function addSection(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
  doc.text(title, 14, y);
  return y + 6;
}

function addTextBlock(doc: jsPDF, label: string, text: string | null, y: number, pageWidth: number): number {
  if (!text) return y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_SEC[0], TEXT_SEC[1], TEXT_SEC[2]);
  doc.text(label, 14, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
  const lines = doc.splitTextToSize(text, pageWidth - 28);
  doc.text(lines, 14, y);
  y += lines.length * 4 + 4;
  return y;
}

export async function generatePatientPdf(patient: Patient, owner: Owner | null, settings: Settings): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, settings, 'Datos del paciente y propietario');
  let y = 44;

  y = addPatientInfo(doc, patient, owner, y);

  if (patient.notes) {
    y = addSection(doc, 'Observaciones', y);
    void addTextBlock(doc, '', patient.notes, y, pageWidth);
  }

  addFooter(doc, settings);

  const filename = `Paciente_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export async function generateAssessmentPdf(
  assessment: Assessment,
  patient: Patient,
  owner: Owner | null,
  settings: Settings
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, settings, 'Ficha fisiátrica');
  let y = 44;

  y = addPatientInfo(doc, patient, owner, y);

  // Bloque A: propietario
  if (assessment.ownerSnapshot) {
    y = addSection(doc, 'A. Datos del propietario', y);
    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: [
        ['Nombre', assessment.ownerSnapshot.name],
        ['Domicilio', assessment.ownerSnapshot.address ?? '—'],
        ['Teléfono', assessment.ownerSnapshot.phone ?? '—'],
        ['Derivado por', assessment.referredBy ?? '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Bloque B: paciente
  if (assessment.patientSnapshot) {
    const ps = assessment.patientSnapshot;
    y = addSection(doc, 'B. Datos del paciente', y);
    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: [
        ['Nombre', ps.name],
        ['Especie', ps.species],
        ['Raza', ps.breed ?? '—'],
        ['Sexo', ps.sex ?? '—'],
        ['Edad', ps.ageYears != null ? `${ps.ageYears} años, ${ps.ageMonths ?? 0} meses` : '—'],
        ['Oncológico', ps.oncological === true ? 'Sí' : ps.oncological === false ? 'No' : '—'],
        ['Ortopédico/Neurológico', ps.orthoNeuro ? ps.orthoNeuro.charAt(0).toUpperCase() + ps.orthoNeuro.slice(1) : '—'],
        ['Detalles orto/neuro', ps.orthoNeuroDetails ?? '—'],
        ['Ambulatorio', ps.ambulatory === true ? 'Sí' : ps.ambulatory === false ? 'No' : '—'],
        ['Nódulos', ps.nodules ?? '—'],
        ['Estado mental', ps.mentalState ? ps.mentalState.charAt(0).toUpperCase() + ps.mentalState.slice(1) : '—'],
        ['Enfermedades preexistentes', ps.preexistingDiseases ?? '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Bloque C: evaluación clínica
  y = addSection(doc, 'C. Evaluación clínica', y);
  y = addTextBlock(doc, 'Fecha de evaluación', new Date(assessment.assessedAt).toLocaleDateString('es-AR'), y, pageWidth);
  y = addTextBlock(doc, 'Motivo de la consulta', assessment.reason, y, pageWidth);
  y = addTextBlock(doc, 'Diagnóstico', assessment.diagnosis, y, pageWidth);
  y = addTextBlock(doc, 'Estudios', assessment.studies, y, pageWidth);
  y = addTextBlock(doc, 'Complementos', assessment.complements, y, pageWidth);
  y = addTextBlock(doc, 'Tratamientos médicos', assessment.medicalTreatments, y, pageWidth);
  void addTextBlock(doc, 'Observaciones adicionales', assessment.additionalObservations, y, pageWidth);

  addFooter(doc, settings);

  const filename = `Ficha_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export async function generateSessionPdf(
  session: Session,
  patient: Patient,
  owner: Owner | null,
  settings: Settings
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  addHeader(doc, settings, 'Registro de sesión');
  let y = 44;

  y = addPatientInfo(doc, patient, owner, y);

  y = addSection(doc, 'Datos de la sesión', y);
  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Fecha', new Date(session.sessionAt).toLocaleDateString('es-AR')],
      ['Observaciones generales', session.generalObservations ?? '—'],
      ['Evolución', session.evolution ?? '—'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  if (session.treatments && session.treatments.length > 0) {
    y = addSection(doc, 'Tratamientos aplicados', y);
    const treatmentRows = session.treatments
      .filter((t) => t.applied)
      .map((t) => [
        t.treatmentType.charAt(0).toUpperCase() + t.treatmentType.slice(1),
        t.zone ?? '—',
        t.intensity ? `${t.intensity} ${t.intensityUnit ?? ''}`.trim() : '—',
        t.timeMinutes ? `${t.timeMinutes} min` : '—',
        t.dose ?? '—',
        t.frequency ?? '—',
        t.observations ?? '—',
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Tratamiento', 'Zona', 'Intensidad', 'Tiempo', 'Dosis', 'Frecuencia', 'Observaciones']],
      body: treatmentRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc, settings);

  const filename = `Sesion_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export async function generateTreatmentHistoryPdf(
  patient: Patient,
  sessions: Session[],
  settings: Settings
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  addHeader(doc, settings, 'Historial de tratamientos');
  let y = 44;

  // Resumen por tratamiento
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

  if (Object.keys(summary).length > 0) {
    y = addSection(doc, 'Resumen por tratamiento', y);
    autoTable(doc, {
      startY: y,
      head: [['Tratamiento', 'Primera aplicación', 'Última aplicación', 'Cantidad']],
      body: Object.entries(summary).map(([type, info]) => [
        type.charAt(0).toUpperCase() + type.slice(1),
        new Date(info.first).toLocaleDateString('es-AR'),
        new Date(info.last).toLocaleDateString('es-AR'),
        String(info.count),
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Tabla cronológica de sesiones
  y = addSection(doc, 'Sesiones cronológicas', y);
  const sessionRows = sessions.map((s) => [
    new Date(s.sessionAt).toLocaleDateString('es-AR'),
    (s.treatments ?? [])
      .filter((t) => t.applied)
      .map((t) => t.treatmentType.charAt(0).toUpperCase() + t.treatmentType.slice(1))
      .join(', ') || '—',
    s.evolution ?? s.generalObservations ?? '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Tratamientos aplicados', 'Evolución / Observaciones']],
    body: sessionRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 2: { cellWidth: 60 } },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, settings);

  const filename = `Historial_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
