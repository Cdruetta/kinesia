import Dexie, { type Transaction } from 'dexie';
import type { Appointment, Owner, Patient, Settings } from '@/models';
import {
  DEMO_LIMIT_BY_RESOURCE,
  DEMO_LIMIT_LABELS,
  type DemoLimitedResource,
} from '@/utils/licenseLimits';
import {
  licenseService,
  normalizeLicenseCode,
  type LicenseService,
} from '@/services/licenseService';

export type LicenseValidator = Pick<LicenseService, 'validateLicense'>;

/** Código que ya fue validado contra los hashes de la versión instalada. */
export interface ValidatedLicense {
  readonly code: string;
}

/** Error de dominio para indicar que se alcanzó un límite del modo demo. */
export class DemoLimitExceededError extends Error {
  readonly resource: DemoLimitedResource;
  readonly limit: number;
  readonly currentCount?: number;

  constructor(
    resource: DemoLimitedResource,
    limit: number,
    currentCount?: number
  ) {
    super(
      currentCount === undefined
        ? `En modo demo solo podés tener hasta ${limit} ${DEMO_LIMIT_LABELS[resource]}. Activá una licencia para continuar.`
        : `El respaldo contiene ${currentCount} ${DEMO_LIMIT_LABELS[resource]} no archivados, pero el modo demo permite como máximo ${limit}. Activá una licencia para restaurarlo.`
    );
    this.name = 'DemoLimitExceededError';
    this.resource = resource;
    this.limit = limit;
    this.currentCount = currentCount;
  }
}

function assertTransactionScope(
  transaction: Transaction,
  resource: DemoLimitedResource
): void {
  if (!Dexie.currentTransaction) {
    throw new Error(
      'Los límites de licencia deben evaluarse dentro de una transacción Dexie.'
    );
  }

  if (
    !transaction.storeNames.includes('settings') ||
    !transaction.storeNames.includes(resource)
  ) {
    throw new Error(
      `La transacción de ${resource} debe incluir la tabla de límites y la tabla de configuración.`
    );
  }
}

/**
 * Valida un código dentro de la transacción que leerá la licencia vigente.
 *
 * La validación PBKDF2 es asíncrona. `Dexie.waitFor` mantiene viva la
 * transacción de IndexedDB mientras se resuelve, de modo que la decisión no
 * pueda quedar desactualizada si otra pestaña o conexión cambia la licencia.
 */
export async function validateLicenseInTransaction(
  transaction: Transaction,
  code: string | null | undefined,
  validator: LicenseValidator = licenseService
): Promise<ValidatedLicense | null> {
  if (!Dexie.currentTransaction) {
    throw new Error(
      'Los límites de licencia deben evaluarse dentro de una transacción Dexie.'
    );
  }

  if (!transaction.storeNames.includes('settings')) {
    throw new Error(
      'La transacción de licencia debe incluir la tabla de configuración.'
    );
  }

  if (!code) return null;

  const normalizedCode = normalizeLicenseCode(code);
  if (!normalizedCode) return null;

  try {
    const valid = await Dexie.waitFor(validator.validateLicense(normalizedCode));
    return valid ? { code: normalizedCode } : null;
  } catch {
    // Ante cualquier error de Web Crypto se falla de forma cerrada: una
    // licencia no verificable nunca habilita operaciones premium.
    return null;
  }
}

/**
 * Determina la licencia vigente y, si no hay una licencia válida, comprueba
 * el límite del recurso dentro de la misma transacción que hará el alta.
 *
 * El booleano `settings.isLicensed` es sólo un estado auxiliar: el código
 * validado es la fuente de verdad. La transacción incluye `settings` para
 * que una activación o revocación concurrente quede serializada con el alta.
 */
export async function assertCanCreateLimitedRecord(
  transaction: Transaction,
  resource: DemoLimitedResource,
  validator: LicenseValidator = licenseService
): Promise<void> {
  assertTransactionScope(transaction, resource);

  const settings = await transaction.table<Settings>('settings').get('settings');
  const validatedLicense = await validateLicenseInTransaction(
    transaction,
    settings?.licenseKey,
    validator
  );

  const now = new Date().toISOString();
  if (validatedLicense) {
    if (
      settings &&
      (!settings.isLicensed || settings.licenseKey !== validatedLicense.code)
    ) {
      await transaction.table<Settings>('settings').update('settings', {
        isLicensed: true,
        licenseKey: validatedLicense.code,
        updatedAt: now,
      });
    }
    return;
  }

  if (settings && (settings.isLicensed || settings.licenseKey)) {
    await transaction.table<Settings>('settings').update('settings', {
      isLicensed: false,
      licenseKey: null,
      updatedAt: now,
    });
  }

  const records = (await transaction.table(resource).toArray()) as Array<{
    id: string;
    archivedAt?: string | null;
  }>;
  const activeCount = records.filter((record) => !record.archivedAt).length;
  const limit = DEMO_LIMIT_BY_RESOURCE[resource];

  if (activeCount >= limit) {
    throw new DemoLimitExceededError(resource, limit);
  }
}

interface DemoLimitedRecord {
  id: string;
  archivedAt: string | null;
}

export interface DemoLimitedBackupData {
  owners: Owner[];
  patients: Patient[];
  appointments: Appointment[];
}

/**
 * Verifica que un respaldo demo respete los límites sin alterar su estado.
 *
 * La restauración clínica es all-or-nothing: archivar excedentes en silencio
 * podría invalidar relaciones que la aplicación no permite crear (por
 * ejemplo, un paciente activo cuyo propietario quedó archivado). Por eso un
 * respaldo que excede un límite se rechaza y la base actual permanece intacta.
 */
export function assertBackupWithinDemoLimits(data: DemoLimitedBackupData): void {
  const resources: Array<{
    resource: DemoLimitedResource;
    records: readonly DemoLimitedRecord[];
  }> = [
    { resource: 'owners', records: data.owners },
    { resource: 'patients', records: data.patients },
    { resource: 'appointments', records: data.appointments },
  ];

  for (const { resource, records } of resources) {
    const activeCount = records.filter((record) => !record.archivedAt).length;
    const limit = DEMO_LIMIT_BY_RESOURCE[resource];
    if (activeCount > limit) {
      throw new DemoLimitExceededError(resource, limit, activeCount);
    }
  }
}
