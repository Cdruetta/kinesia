import { describe, expect, it } from 'vitest';
import { buildWaLink, findMissingVariables, replaceVariables } from '@/utils/whatsapp';

describe('whatsapp utils', () => {
  describe('buildWaLink', () => {
    it('construye enlace correcto con número y mensaje', () => {
      const link = buildWaLink('0358 15 412 3456', 'Hola mundo');
      expect(link).toBe('https://wa.me/5493584123456?text=Hola%20mundo');
    });

    it('codifica caracteres especiales', () => {
      const link = buildWaLink('0358 15 412 3456', 'Hola, ¿cómo estás? ¡Bien!');
      expect(link).toContain('Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F%20%C2%A1Bien!');
    });

    it('codifica saltos de línea', () => {
      const link = buildWaLink('0358 15 412 3456', 'Línea 1\nLínea 2');
      expect(link).toContain('L%C3%ADnea%201%0AL%C3%ADnea%202');
    });

    it('devuelve null si el número es inválido', () => {
      const link = buildWaLink('abc', 'Hola');
      expect(link).toBeNull();
    });

    it('devuelve null si el número es demasiado corto', () => {
      const link = buildWaLink('123', 'Hola');
      expect(link).toBeNull();
    });
  });

  describe('replaceVariables', () => {
    it('reemplaza variables con datos reales', () => {
      const template = 'Hola {nombre_propietario}, {nombre_paciente} tiene turno el {fecha_turno} a las {hora_turno}.';
      const data = {
        nombre_propietario: 'Juan',
        nombre_paciente: 'Firulais',
        fecha_turno: '10/03/2026',
        hora_turno: '10:00',
      };
      const result = replaceVariables(template, data);
      expect(result).toBe('Hola Juan, Firulais tiene turno el 10/03/2026 a las 10:00.');
    });

    it('maneja variables faltantes (valor vacío)', () => {
      const template = 'Hola {nombre_propietario}, {nombre_paciente} tiene turno.';
      const data = { nombre_propietario: 'Juan', nombre_paciente: '' };
      const result = replaceVariables(template, data);
      expect(result).toBe('Hola Juan,  tiene turno.');
    });

    it('no modifica texto sin variables', () => {
      const template = 'Hola, ¿cómo estás?';
      const result = replaceVariables(template, {});
      expect(result).toBe('Hola, ¿cómo estás?');
    });
  });

  describe('findMissingVariables', () => {
    it('detecta variables sin dato', () => {
      const template = 'Hola {nombre_propietario}, {nombre_paciente} tiene turno el {fecha_turno}.';
      const data = { nombre_propietario: 'Juan', nombre_paciente: '', fecha_turno: '' };
      const missing = findMissingVariables(template, data);
      expect(missing).toContain('{nombre_paciente}');
      expect(missing).toContain('{fecha_turno}');
      expect(missing).not.toContain('{nombre_propietario}');
    });

    it('no detecta variables que no están en la plantilla', () => {
      const template = 'Hola {nombre_propietario}.';
      const data = { nombre_propietario: 'Juan' };
      const missing = findMissingVariables(template, data);
      expect(missing).toHaveLength(0);
    });

    it('detecta variable sin dato aunque no esté en data', () => {
      const template = 'Hola {nombre_propietario}.';
      const data = {};
      const missing = findMissingVariables(template, data);
      expect(missing).toContain('{nombre_propietario}');
    });
  });
});
