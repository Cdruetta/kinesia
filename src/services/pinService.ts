/**
 * Servicio de bloqueo local con PIN.
 * Guarda solo un hash con sal (Web Crypto PBKDF2), nunca el PIN.
 * No hay recuperación de PIN: si se olvida, la única salida es borrar los datos locales.
 */

const ITERATIONS = 100000;
const HASH_LENGTH = 32;

export const pinService = {
  /** Genera una sal aleatoria en base64. */
  async generateSalt(): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...salt));
  },

  /** Hashea un PIN con la sal dada usando PBKDF2. */
  async hashPin(pin: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      HASH_LENGTH * 8
    );
    return btoa(String.fromCharCode(...new Uint8Array(derived)));
  },

  /** Verifica si un PIN coincide con el hash guardado. */
  async verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
    const computed = await this.hashPin(pin, salt);
    return computed === hash;
  },

  /** Valida que el PIN sea numérico de 4 a 6 dígitos. */
  isValidPin(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  },
};
