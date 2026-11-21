import type { Settings } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';
import type { pinAccessService as PinAccessServiceValue } from '@/services/pinAccessService';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

type PinAccessService = typeof PinAccessServiceValue;

const NOW = '2026-11-20T12:00:00.000Z';

let harness: FakeDexieHarness;
let pinAccessService: PinAccessService;

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'settings',
    ...DEFAULT_SETTINGS,
    pinEnabled: true,
    pinHash: 'pin-hash',
    pinSalt: 'pin-salt',
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  };
}

beforeAll(async () => {
  harness = createFakeDexieHarness('pin-access');
  await harness.db.open();
  vi.doMock('@/db/instance', () => ({ db: harness.db }));
  ({ pinAccessService } = await import('@/services/pinAccessService'));
});

beforeEach(async () => {
  await harness.db.settings.clear();
  await harness.db.settings.add(makeSettings());
});

afterAll(async () => {
  vi.doUnmock('@/db/instance');
  vi.resetModules();
  await harness.cleanup();
});

describe('pinAccessService', () => {
  it('respeta un bloqueo temporal persistido sin verificar el PIN', async () => {
    const lockedUntil = new Date(Date.now() + 60_000).toISOString();
    await harness.db.settings.update('settings', { pinLockedUntil: lockedUntil });
    const verify = vi.fn(async () => false);

    const result = await pinAccessService.unlock('1234', verify);

    expect(result).toEqual({
      status: 'locked',
      attempts: 0,
      lockedUntil,
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('serializa intentos simultáneos y conserva cada incremento', async () => {
    const verify = vi.fn(async () => false);

    const results = await Promise.all([
      pinAccessService.unlock('1234', verify),
      pinAccessService.unlock('1234', verify),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'invalid',
      'invalid',
    ]);
    expect(
      results
        .map((result) => (result.status === 'invalid' ? result.attempts : 0))
        .sort()
    ).toEqual([1, 2]);
    expect(await harness.db.settings.get('settings')).toMatchObject({
      pinAttempts: 2,
      pinLockedUntil: null,
    });
  });

  it('persiste una espera creciente desde el cuarto intento', async () => {
    await harness.db.settings.update('settings', { pinAttempts: 3 });
    const verify = vi.fn(async () => false);

    const result = await pinAccessService.unlock('1234', verify);

    expect(result).toMatchObject({ status: 'invalid', attempts: 4 });
    expect(result.status === 'invalid' && result.lockedUntil).not.toBeNull();
    expect(await harness.db.settings.get('settings')).toMatchObject({
      pinAttempts: 4,
    });
  });

  it('reinicia los intentos al verificar un PIN correcto', async () => {
    await harness.db.settings.update('settings', {
      pinAttempts: 4,
      pinLockedUntil: new Date(Date.now() - 1_000).toISOString(),
    });
    const verify = vi.fn(async () => true);

    await expect(pinAccessService.unlock('1234', verify)).resolves.toEqual({
      status: 'success',
      attempts: 0,
    });
    expect(await harness.db.settings.get('settings')).toMatchObject({
      pinAttempts: 0,
      pinLockedUntil: null,
    });
  });
});
