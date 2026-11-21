import type { DexieOptions } from 'dexie';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import { KinesiaDB } from '@/db/instance';

export interface FakeDexieHarness {
  db: KinesiaDB;
  factory: IDBFactory;
  options: DexieOptions;
  name: string;
  cleanup: () => Promise<void>;
}

/**
 * Crea una base Dexie aislada sobre una instancia nueva de fake-indexeddb.
 *
 * Cada harness tiene su propio IDBFactory: aunque use un nombre estable,
 * no comparte almacenamiento ni bloqueos con la base singleton de producción
 * ni con los demás tests.
 */
export function createFakeDexieHarness(label: string): FakeDexieHarness {
  const factory = new FDBFactory();
  const name = `kinesia-test-${label}`;
  const options: DexieOptions = {
    autoOpen: false,
    indexedDB: factory,
    IDBKeyRange: FDBKeyRange,
  };
  const db = new KinesiaDB(name, options);

  return {
    db,
    factory,
    options,
    name,
    cleanup: async () => {
      db.close();

      await new Promise<void>((resolve, reject) => {
        const request = factory.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`No se pudo eliminar ${name}.`));
        request.onblocked = () => reject(new Error(`La base ${name} quedó bloqueada al eliminarla.`));
      });
    },
  };
}
