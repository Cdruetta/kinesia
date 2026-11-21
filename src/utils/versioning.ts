export interface VersionedRecord {
  id: string;
  patientId: string;
  version: number;
  previousVersionId: string | null;
  isLatest: boolean;
}

/**
 * Devuelve la cadena lineal de versiones que contiene el registro indicado.
 *
 * La validación es deliberadamente estricta: una cadena válida tiene una sola
 * versión actual, versiones consecutivas, un único predecesor por versión y
 * ningún ciclo. Se usa antes de reemplazar una versión clínica para evitar que
 * dos pestañas creen ramas paralelas del mismo historial.
 */
export function getVersionChain<T extends VersionedRecord>(records: T[], id: string): T[] {
  const byId = new Map<string, T>();
  for (const record of records) {
    if (byId.has(record.id)) {
      throw new Error(`El historial clínico contiene el identificador duplicado "${record.id}".`);
    }
    byId.set(record.id, record);
  }

  const current = byId.get(id);
  if (!current) throw new Error('El registro clínico ya no existe.');

  const ancestors: T[] = [];
  const visited = new Set<string>();
  let cursor: T | undefined = current;

  while (cursor) {
    if (visited.has(cursor.id)) {
      throw new Error('El historial clínico contiene un ciclo de versiones.');
    }
    visited.add(cursor.id);
    ancestors.push(cursor);

    if (!cursor.previousVersionId) break;

    const previous = byId.get(cursor.previousVersionId);
    if (!previous) {
      throw new Error('El historial clínico está incompleto: falta una versión anterior.');
    }
    if (visited.has(previous.id)) {
      throw new Error('El historial clínico contiene un ciclo de versiones.');
    }
    if (previous.patientId !== cursor.patientId) {
      throw new Error('El historial clínico contiene versiones de pacientes diferentes.');
    }
    if (cursor.version !== previous.version + 1) {
      throw new Error('El historial clínico contiene una numeración de versiones inconsistente.');
    }
    cursor = previous;
  }

  const root = ancestors[ancestors.length - 1];
  if (root.version !== 1 || root.previousVersionId !== null) {
    throw new Error('El historial clínico no tiene una versión inicial válida.');
  }

  const chain: T[] = [root];
  const usedVersions = new Set<number>([root.version]);
  let previous = root;

  while (true) {
    const children = records.filter((record) => record.previousVersionId === previous.id);
    if (children.length === 0) break;
    if (children.length > 1) {
      throw new Error('El historial clínico contiene ramas paralelas.');
    }

    const child = children[0];
    if (child.patientId !== previous.patientId) {
      throw new Error('El historial clínico contiene versiones de pacientes diferentes.');
    }
    if (child.version !== previous.version + 1) {
      throw new Error('El historial clínico contiene una numeración de versiones inconsistente.');
    }
    if (usedVersions.has(child.version)) {
      throw new Error('El historial clínico contiene versiones duplicadas.');
    }

    usedVersions.add(child.version);
    chain.push(child);
    previous = child;
  }

  const latest = chain.filter((record) => record.isLatest);
  if (latest.length !== 1) {
    throw new Error('El historial clínico no tiene una única versión actual.');
  }
  if (latest[0].id !== chain[chain.length - 1].id) {
    throw new Error('La versión actual del historial clínico no es la más reciente.');
  }

  return chain;
}
