import { describe, expect, it } from 'vitest';
import { computeAge } from '@/utils/age';

describe('computeAge', () => {
  const reference = new Date(2026, 2, 10); // 10/03/2026

  it('calcula años y meses desde una fecha de nacimiento', () => {
    // 15/01/2020 → 6 años y 1 mes al 10/03/2026
    const age = computeAge('2020-01-15', reference);
    expect(age).toEqual({ years: 6, months: 1 });
  });

  it('devuelve 0 años y 0 meses para bebés muy pequeños', () => {
    const age = computeAge('2026-02-20', reference); // 18 días
    expect(age).toEqual({ years: 0, months: 0 });
  });

  it('calcula correctamente un cumpleaños exacto', () => {
    const age = computeAge('2010-03-10', reference); // exactamente 16 años
    expect(age).toEqual({ years: 16, months: 0 });
  });

  it('devuelve null si la fecha está en el futuro', () => {
    expect(computeAge('2030-01-01', reference)).toBeNull();
  });

  it('devuelve null si no hay fecha', () => {
    expect(computeAge(null, reference)).toBeNull();
    expect(computeAge('')).toBeNull();
  });

  it('devuelve null si la fecha es inválida', () => {
    expect(computeAge('no-es-una-fecha', reference)).toBeNull();
  });

  it('usa la fecha actual por defecto si no se pasa referencia', () => {
    const age = computeAge('2000-01-01');
    expect(age?.years).toBeGreaterThan(0);
  });
});
