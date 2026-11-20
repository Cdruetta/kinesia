import { addYears, differenceInCalendarMonths, differenceInCalendarYears, isValid, parseISO } from 'date-fns';

export interface Age {
  years: number;
  months: number;
}

/**
 * Calcula la edad en años y meses a partir de una fecha de nacimiento
 * aproximada. Si la fecha es inválida o está en el futuro, devuelve null.
 */
export function computeAge(
  birthDate: Date | string | null,
  reference: Date = new Date()
): Age | null {
  if (!birthDate) return null;
  const born = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(born)) return null;
  if (born > reference) return null;

  const years = differenceInCalendarYears(reference, born);
  const anniversary = addYears(born, years);
  let months = differenceInCalendarMonths(reference, anniversary);
  // Si aún no se llegó al día del aniversario en el mes en curso,
  // ese mes no está cumplido.
  if (reference.getDate() < anniversary.getDate()) {
    months -= 1;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
  };
}
