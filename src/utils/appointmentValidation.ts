/**
 * Funciones puras de validación y cálculo de horarios para la agenda.
 * No dependen de Dexie ni de React; son testeables con Vitest.
 */

export type TimeSlot = { start: Date; end: Date };

export interface ClinicDayHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
  closed: boolean;
}

export interface ClinicHours {
  [day: number]: ClinicDayHours;
}

/** Parsea "HH:mm" a minutos desde medianoche. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:mm". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Devuelve el slot {start, end} de un turno. */
export function appointmentSlot(startsAt: string, durationMinutes: number): TimeSlot {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start, end };
}

/**
 * Determina si dos slots se superponen.
 * Bordes: un turno que termina cuando otro empieza NO se superpone.
 */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Detecta conflicto de solapamiento entre un candidato y una lista de turnos.
 * Los turnos Cancelado y Ausente no bloquean.
 * Devuelve el turno que choca, o null si no hay conflicto.
 */
export function findOverlappingAppointment<T extends { startsAt: string; durationMinutes: number; status: string; id?: string; patientId?: string }>(
  turns: T[],
  candidate: { startsAt: string; durationMinutes: number; id?: string }
): T | null {
  const candidateSlot = appointmentSlot(candidate.startsAt, candidate.durationMinutes);
  for (const t of turns) {
    if (t.id === candidate.id) continue;
    if (t.status === 'cancelled' || t.status === 'no-show') continue;
    const slot = appointmentSlot(t.startsAt, t.durationMinutes);
    if (slotsOverlap(candidateSlot, slot)) return t;
  }
  return null;
}

/**
 * Comprueba si un turno cae dentro del horario de atención del día.
 * Devuelve true si está dentro, false si cae fuera.
 */
export function isWithinClinicHours(
  startsAt: string,
  durationMinutes: number,
  hours: ClinicHours
): boolean {
  const start = new Date(startsAt);
  const day = start.getDay();
  const dayHours = hours[day];
  if (!dayHours || dayHours.closed) return false;

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = startMinutes + durationMinutes;
  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);

  return startMinutes >= openMinutes && endMinutes <= closeMinutes;
}

/**
 * Busca el siguiente horario libre en el día dado, a partir de `from`,
 * con la duración indicada y respetando los horarios de atención.
 * Devuelve null si no hay espacio.
 */
export function findNextFreeSlot(
  turns: { startsAt: string; durationMinutes: number; status: string }[],
  date: Date,
  durationMinutes: number,
  hours: ClinicHours,
  stepMinutes = 15
): Date | null {
  const day = date.getDay();
  const dayHours = hours[day];
  if (!dayHours || dayHours.closed) return null;

  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);

  // Convertir date a minutos desde medianoche
  let cursor = date.getHours() * 60 + date.getMinutes();
  if (cursor < openMinutes) cursor = openMinutes;

  // Alinear al step
  cursor = Math.ceil(cursor / stepMinutes) * stepMinutes;

  const activeTurns = turns.filter((t) => t.status !== 'cancelled' && t.status !== 'no-show');

  while (cursor + durationMinutes <= closeMinutes) {
    const slotStart = new Date(date);
    slotStart.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

    const candidateSlot = { start: slotStart, end: slotEnd };
    const conflicts = activeTurns.some((t) => {
      const s = appointmentSlot(t.startsAt, t.durationMinutes);
      return slotsOverlap(candidateSlot, s);
    });

    if (!conflicts) return slotStart;
    cursor += stepMinutes;
  }

  return null;
}

/** Formatea una fecha Date a ISO local (sin zona horaria). */
export function toLocalISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

/** Devuelve el inicio del día (00:00:00) como Date. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Devuelve el fin del día (23:59:59) como Date. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Devuelve la fecha del lunes de la semana de la fecha dada. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Devuelve la fecha del domingo de la semana de la fecha dada. */
export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Devuelve el primer día del mes. */
export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Devuelve el último día del mes. */
export function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Formatea un slot a "HH:mm - HH:mm". */
export function formatSlot(slot: TimeSlot): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const s = `${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`;
  const e = `${pad(slot.end.getHours())}:${pad(slot.end.getMinutes())}`;
  return `${s} - ${e}`;
}
