import type { Settings } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';
import type { settingsService as SettingsServiceValue } from '@/services/settingsService';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDexieHarness, type FakeDexieHarness } from '@/test/fakeDexie';

type SettingsService = typeof SettingsServiceValue;

const NOW = '2026-11-20T12:00:00.000Z';

let harness: FakeDexieHarness;
let settingsService: SettingsService;

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'settings',
    ...DEFAULT_SETTINGS,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  };
}

beforeAll(async () => {
  harness = createFakeDexieHarness('settings-concurrency');
  await harness.db.open();
  vi.doMock('@/db/instance', () => ({ db: harness.db }));
  ({ settingsService } = await import('@/services/settingsService'));
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

describe('settingsService.update', () => {
  it('conserva cambios concurrentes de campos distintos', async () => {
    await Promise.all([
      settingsService.update({ clinicName: 'Clínica Centro' }),
      settingsService.update({ autoLockMinutes: 15 }),
    ]);

    expect(await harness.db.settings.get('settings')).toMatchObject({
      clinicName: 'Clínica Centro',
      autoLockMinutes: 15,
    });
  });
});

describe('settingsService.updateLicenseState', () => {
  it('no revoca una licencia que otra pestaña cambió', async () => {
    await harness.db.settings.update('settings', {
      isLicensed: true,
      licenseKey: 'KIN-2099-AAAA11',
    });
    await harness.db.settings.update('settings', {
      isLicensed: true,
      licenseKey: 'KIN-2099-BBBB22',
    });

    const updated = await settingsService.updateLicenseState(
      'KIN-2099-AAAA11',
      { isLicensed: false, licenseKey: null }
    );

    expect(updated).toBeNull();
    expect(await harness.db.settings.get('settings')).toMatchObject({
      isLicensed: true,
      licenseKey: 'KIN-2099-BBBB22',
    });
  });

  it('no restaura una licencia desactivada en otra pestaña', async () => {
    await harness.db.settings.update('settings', {
      isLicensed: false,
      licenseKey: null,
    });

    const updated = await settingsService.updateLicenseState(
      'KIN-2099-AAAA11',
      { isLicensed: true, licenseKey: 'KIN-2099-AAAA11' }
    );

    expect(updated).toBeNull();
    expect(await harness.db.settings.get('settings')).toMatchObject({
      isLicensed: false,
      licenseKey: null,
    });
  });
});
