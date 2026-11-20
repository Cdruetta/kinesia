import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Formatea una fecha en español rioplatense (dd/mm/aaaa). */
export function formatDate(value: Date | string | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) return '';
  return format(date, 'dd/MM/yyyy', { locale: es });
}

/** Formatea fecha y hora en formato local: dd/mm/aaaa a las HH:mm. */
export function formatDateTime(value: Date | string | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) return '';
  return format(date, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
}

/** Parsea una fecha dd/mm/aaaa a Date (medianoche local). Devuelve null si inválida. */
export function parseDateAr(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.test(value) && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return null;
  // Validar que no se haya desbordado el mes (ej. 31/02)
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return null;
  }
  return date;
}

/** Compara dos fechas solo por día (ignora hora). */
export function isSameDay(a: Date | string | null, b: Date | string | null): boolean {
  if (!a || !b) return false;
  const da = typeof a === 'string' ? parseISO(a) : a;
  const db = typeof b === 'string' ? parseISO(b) : b;
  if (!isValid(da) || !isValid(db)) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Ahora mismo como string ISO (zona horaria local del navegador). */
export function nowISO(): string {
  return new Date().toISOString();
}
