/**
 * Helpers genéricos que no encajan en ningún módulo específico.
 * FIXME: refactorizar esto en utils más específicos cuando crezca el proyecto.
 */

export function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// TODO: agregar más helpers a medida que se necesiten
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
