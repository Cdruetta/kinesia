import { describe, expect, it } from 'vitest';
import { getVersionChain, type VersionedRecord } from '@/utils/versioning';

function version(
  id: string,
  version: number,
  previousVersionId: string | null,
  isLatest: boolean,
  patientId = 'patient-1'
): VersionedRecord {
  return { id, patientId, version, previousVersionId, isLatest };
}

describe('getVersionChain', () => {
  it('devuelve una cadena lineal y valida su versión actual', () => {
    const records = [
      version('v1', 1, null, false),
      version('v2', 2, 'v1', true),
    ];

    expect(getVersionChain(records, 'v2').map((record) => record.id)).toEqual(['v1', 'v2']);
  });

  it('rechaza una cadena con dos versiones actuales', () => {
    const records = [
      version('v1', 1, null, true),
      version('v2', 2, 'v1', true),
    ];

    expect(() => getVersionChain(records, 'v2')).toThrow('única versión actual');
  });

  it('rechaza ramas paralelas', () => {
    const records = [
      version('v1', 1, null, false),
      version('v2a', 2, 'v1', true),
      version('v2b', 2, 'v1', false),
    ];

    expect(() => getVersionChain(records, 'v2a')).toThrow('ramas paralelas');
  });

  it('rechaza ciclos', () => {
    const records = [
      version('v1', 2, 'v2', false),
      version('v2', 1, 'v1', true),
    ];

    expect(() => getVersionChain(records, 'v1')).toThrow('ciclo');
  });

  it('rechaza una referencia a una versión inexistente', () => {
    const records = [version('v2', 2, 'v1', true)];

    expect(() => getVersionChain(records, 'v2')).toThrow('falta una versión anterior');
  });
});
