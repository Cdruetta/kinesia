import { describe, expect, it } from 'vitest';
import {
  formatDate,
  fromLocalDateInput,
  parseDateAr,
  toLocalDateInput,
} from '@/utils/dates';

describe('fechas locales', () => {
  it('convierte un Date a YYYY-MM-DD sin usar UTC', () => {
    expect(toLocalDateInput(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02');
  });

  it('convierte YYYY-MM-DD a medianoche local', () => {
    const date = fromLocalDateInput('2026-03-10');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(10);
    expect(date?.getHours()).toBe(0);
  });

  it('rechaza fechas inexistentes o con formato incorrecto', () => {
    expect(fromLocalDateInput('2026-02-30')).toBeNull();
    expect(fromLocalDateInput('10/03/2026')).toBeNull();
  });

  it('formatea fechas YYYY-MM-DD sin cambiar de día', () => {
    expect(formatDate('2026-03-10')).toBe('10/03/2026');
  });

  it('valida fechas rioplatenses', () => {
    expect(parseDateAr('10/03/2026')?.getDate()).toBe(10);
    expect(parseDateAr('31/02/2026')).toBeNull();
  });
});
