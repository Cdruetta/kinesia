/**
 * Normalización de teléfonos argentinos para enlaces wa.me (WhatsApp).
 *
 * Reglas:
 * 1. Quitar espacios, guiones, paréntesis y signo +.
 * 2. Quitar el 0 inicial del código de área.
 * 3. Quitar el 15 que sigue al código de área (prefijo móvil antiguo).
 * 4. Si no empieza con 54, anteponer 54.
 * 5. Formato final de celulares: 549 + código de área + número.
 * 6. Validar longitud; devolver error claro si es inválido.
 */

export type PhoneNormalizationOk = {
  ok: true;
  /** Dígitos internacionales, ej. "5493584123456" */
  international: string;
  /** URL para wa.me */
  waUrl: string;
};

export type PhoneNormalizationFail = {
  ok: false;
  error: string;
};

export type PhoneNormalization = PhoneNormalizationOk | PhoneNormalizationFail;

const MIN_LENGTH = 10;
const MAX_LENGTH = 14;

function fail(error: string): PhoneNormalizationFail {
  return { ok: false, error };
}

/**
 * Normaliza un teléfono argentino. Letras y longitudes fuera de rango
 * devuelven { ok: false, error } con un mensaje claro.
 */
export function normalizeArgentinePhone(raw: string | null | undefined): PhoneNormalization {
  if (raw == null || raw.trim() === '') {
    return fail('Ingresá un número de teléfono.');
  }

  // Las letras no son válidas en un número de teléfono
  if (/[a-zA-Záéíóúñü]/.test(raw)) {
    return fail('El número de teléfono no puede contener letras.');
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return fail('Ingresá un número de teléfono válido.');
  }

  let s = digits;

  // Prefijo internacional con doble cero: 00... → quitar los ceros
  if (s.startsWith('00')) {
    s = s.slice(2);
  }

  // País: si no empieza con 54, anteponer 54
  let national: string;
  if (s.startsWith('54')) {
    national = s.slice(2);
  } else {
    national = s;
  }

  // Quitar el 0 inicial del código de área: 54 0 358 ... → 54 358 ...
  if (national.startsWith('0')) {
    national = national.slice(1);
  }

  let mobile = false;

  // Prefijo móvil antiguo "15" tras código de área de 2 o 3 dígitos:
  // 54 11 15 xxxx xxxx  |  54 358 15 xxx xxxx
  if (national.slice(2, 4) === '15') {
    national = national.slice(0, 2) + national.slice(4);
    mobile = true;
  } else if (national.slice(3, 5) === '15') {
    national = national.slice(0, 3) + national.slice(5);
    mobile = true;
  }

  let international: string;

  if (national.startsWith('9')) {
    // Móvil moderno: el 9 viaja con el país (54 9 ...)
    international = '54' + national;
  } else if (mobile) {
    international = '549' + national;
  } else {
    international = '54' + national;
  }

  if (international.length < MIN_LENGTH) {
    return fail('El número de teléfono es demasiado corto.');
  }
  if (international.length > MAX_LENGTH) {
    return fail('El número de teléfono es demasiado largo.');
  }

  return {
    ok: true,
    international,
    waUrl: `https://wa.me/${international}`,
  };
}

/** Formato legible para mostrar en pantallas: +54 9 358 412-3456. */
export function formatPhoneForDisplay(international: string): string {
  const m = /^(\d{2})(9?)(\d{2,3})(\d{6,8})$/.exec(international);
  if (!m) return international;
  const [, country, mobile9, area, number] = m;
  const parts = [`+${country}`];
  if (mobile9 === '9') parts.push('9');
  parts.push(area);
  parts.push(number.length > 4 ? `${number.slice(0, -4)}-${number.slice(-4)}` : number);
  return parts.join(' ');
}
