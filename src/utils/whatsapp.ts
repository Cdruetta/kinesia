/**
 * Utilidades de WhatsApp: construcción de enlaces wa.me, reemplazo de variables
 * y canal de envío (Click-to-Chat).
 */

import { normalizeArgentinePhone } from '@/utils/phones';

export interface MessageChannel {
  /** Prepara el mensaje con los datos reales y devuelve el texto final. */
  prepare(template: string, data: Record<string, string>): string;
  /** Abre WhatsApp con el número y mensaje preparados. */
  open(phone: string, message: string): void;
}

export class ClickToChatChannel implements MessageChannel {
  prepare(template: string, data: Record<string, string>): string {
    return replaceVariables(template, data);
  }

  open(phone: string, message: string): void {
    const normalized = normalizeArgentinePhone(phone);
    if (!normalized.ok) {
      throw new Error((normalized as { error: string }).error);
    }
    const url = `https://wa.me/${normalized.international}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Variables soportadas en las plantillas. */
export const SUPPORTED_VARIABLES = [
  '{nombre_propietario}',
  '{nombre_paciente}',
  '{fecha_turno}',
  '{hora_turno}',
  '{nombre_clinica}',
] as const;

/** Reemplaza variables en una plantilla con los datos reales. */
export function replaceVariables(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    result = result.split(placeholder).join(value ?? '');
  }
  return result;
}

/** Devuelve las variables que no tienen dato (valor vacío o null). */
export function findMissingVariables(template: string, data: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const variable of SUPPORTED_VARIABLES) {
    const key = variable.slice(1, -1); // quitar llaves
    if (template.includes(variable)) {
      const value = data[key];
      if (!value || value.trim() === '') {
        missing.push(variable);
      }
    }
  }
  return missing;
}

/** Construye el enlace wa.me completo. */
export function buildWaLink(phone: string, message: string): string | null {
  const normalized = normalizeArgentinePhone(phone);
  if (!normalized.ok) return null;
  return `https://wa.me/${normalized.international}?text=${encodeURIComponent(message)}`;
}

/** Verifica si hay conexión a internet. */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
