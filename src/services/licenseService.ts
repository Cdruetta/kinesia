/**
 * Servicio de licencias (freemium).
 * Valida códigos de licencia localmente con hash PBKDF2 (sin servidor).
 * Los hashes válidos se incluyen en cada build publicado.
 */

const ITERATIONS = 100000;
const SALT = 'kinesia-license-salt-2026';
const LICENSE_CODE_PATTERN = /^KIN-\d{4}-[A-Z0-9]{6}$/;
const LICENSE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Hashes habilitados en esta versión.
 *
 * La lista se entrega vacía: no existe un código universal. Para publicar una
 * licencia comercial hay que generar un código único, agregar solamente su
 * hash y publicar una nueva versión de la app.
 */
const VALID_LICENSE_HASHES: readonly string[] = [];

export interface LicenseService {
  isValidFormat(code: string): boolean;
  hashLicense(code: string): Promise<string>;
  validateLicense(code: string): Promise<boolean>;
  generateLicenseCode(): string;
}

/** Normaliza un código antes de validarlo, hashearlo o persistirlo. */
export function normalizeLicenseCode(code: string): string {
  return code.trim().toUpperCase();
}

function generateSuffix(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => LICENSE_CODE_ALPHABET[byte % LICENSE_CODE_ALPHABET.length]
  ).join('');
}

/**
 * Crea un validador con una lista de hashes explícita.
 *
 * La dependencia permite probar el flujo completo con un hash generado en la
 * propia prueba, sin incluir un código universal en el build de producción.
 */
export function createLicenseService(
  validLicenseHashes: readonly string[] = VALID_LICENSE_HASHES
): LicenseService {
  const hashes = new Set(validLicenseHashes);

  /** Valida que el código tenga formato correcto. */
  const isValidFormat = (code: string): boolean =>
    LICENSE_CODE_PATTERN.test(normalizeLicenseCode(code));

  /** Hashea un código de licencia con la sal fija. */
  const hashLicense = async (code: string): Promise<string> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(normalizeLicenseCode(code)),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const saltBytes = new TextEncoder().encode(SALT);
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return btoa(String.fromCharCode(...new Uint8Array(derived)));
  };

  return {
    isValidFormat,

    hashLicense,

    /** Valida un código de licencia contra los hashes de esta versión. */
    async validateLicense(code: string): Promise<boolean> {
      const normalizedCode = normalizeLicenseCode(code);
      if (!isValidFormat(normalizedCode)) return false;
      const hash = await hashLicense(normalizedCode);
      return hashes.has(hash);
    },

    /**
     * Genera un candidato aleatorio para desarrollo. No habilita una licencia
     * hasta que su hash se agrega a la lista de esta versión.
     */
    generateLicenseCode(): string {
      const year = new Date().getFullYear();
      return `KIN-${year}-${generateSuffix()}`;
    },
  };
}

/** Validador usado por la aplicación instalada. */
export const licenseService = createLicenseService();
