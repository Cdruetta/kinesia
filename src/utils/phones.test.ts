import { describe, expect, it } from 'vitest';
import {
  normalizeArgentinePhone,
  formatPhoneForDisplay,
  type PhoneNormalizationFail,
} from '@/utils/phones';

describe('normalizeArgentinePhone', () => {
  it.each([
    // Entrada, resultado internacional esperado
    ['0358 15 412 3456', '5493584123456'],
    ['+54 9 358 412-3456', '5493584123456'],
    ['3584123456', '543584123456'],
    ['54358 15 4123456', '5493584123456'],
    ['011 15 1234 5678', '5491112345678'],
    ['54 11 4123-4567', '541141234567'],
    ['(0358) 412-3456', '543584123456'],
    ['5493584123456', '5493584123456'],
  ])('normaliza %s → %s', (input, expected) => {
    const result = normalizeArgentinePhone(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.international).toBe(expected);
      expect(result.waUrl).toBe(`https://wa.me/${expected}`);
    }
  });

  it('rechaza números vacíos', () => {
    const result = normalizeArgentinePhone('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as PhoneNormalizationFail).error).toContain('teléfono');
    }
  });

  it('rechaza números con letras', () => {
    const result = normalizeArgentinePhone('358abc4123456');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as PhoneNormalizationFail).error).toContain('letras');
    }
  });

  it('rechaza números demasiado cortos', () => {
    const result = normalizeArgentinePhone('12345');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as PhoneNormalizationFail).error).toContain('corto');
    }
  });

  it('rechaza números demasiado largos', () => {
    const result = normalizeArgentinePhone('549358412345678901');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as PhoneNormalizationFail).error).toContain('largo');
    }
  });

  it('genera URL de wa.me válida', () => {
    const result = normalizeArgentinePhone('0358 15 412 3456');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.waUrl).toBe('https://wa.me/5493584123456');
    }
  });
});

describe('formatPhoneForDisplay', () => {
  it('da formato legible a celulares', () => {
    console.log('testing formatPhoneForDisplay');
    expect(formatPhoneForDisplay('5493584123456')).toBe('+54 9 358 412-3456');
  });

  it.skip('formatea números con código de área de 2 dígitos (pendiente)', () => {
    // TODO: implementar soporte para códigos de área de 2 dígitos
    expect(formatPhoneForDisplay('541141234567')).toBe('+54 11 4123-4567');
  });
  it('da formato legible a líneas fijas', () => {
    expect(formatPhoneForDisplay('543584123456')).toBe('+54 358 412-3456');
  });
  it('devuelve igual si no cumple patrón', () => {
    expect(formatPhoneForDisplay('123')).toBe('123');
  });
});
