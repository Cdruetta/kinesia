import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '@/hooks/useSettings';
import { DEFAULT_SETTINGS, type Settings } from '@/models';
import { settingsService } from '@/services/settingsService';
import { createLicenseService } from '@/services/licenseService';
import { useLicense } from '@/hooks/useLicense';

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@/services/settingsService', () => ({
  settingsService: {
    get: vi.fn(),
    update: vi.fn(),
    updateLicenseState: vi.fn(),
  },
}));

const TEST_CODE = 'KIN-2099-X7Q42M';

function createSettings(overrides: Partial<Settings> = {}): Settings {
  const now = '2026-11-20T12:00:00.000Z';
  return {
    ...DEFAULT_SETTINGS,
    id: 'settings',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides,
  };
}

describe('useLicense', () => {
  let currentSettings: Settings;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSettings = createSettings();

    vi.mocked(useSettings).mockReturnValue({
      data: currentSettings,
      loading: false,
    });
    vi.mocked(settingsService.get).mockImplementation(async () => currentSettings);
    vi.mocked(settingsService.update).mockImplementation(async (patch) => {
      currentSettings = { ...currentSettings, ...patch };
      return currentSettings;
    });
    vi.mocked(settingsService.updateLicenseState).mockImplementation(
      async (expectedKey, state) => {
        const currentKey = currentSettings.licenseKey ?? null;
        if (currentKey !== expectedKey) return null;
        currentSettings = { ...currentSettings, ...state };
        return currentSettings;
      }
    );
  });

  it('activa una licencia válida y persiste el código normalizado', async () => {
    const hash = await createLicenseService().hashLicense(TEST_CODE);
    const validator = createLicenseService([hash]);
    const { result } = renderHook(() => useLicense(validator));

    await act(async () => {
      await expect(
        result.current.activateLicense(`  ${TEST_CODE.toLowerCase()}  `)
      ).resolves.toBe(true);
    });

    expect(settingsService.update).toHaveBeenCalledWith({
      isLicensed: true,
      licenseKey: TEST_CODE,
    });
    expect(result.current.isLicensed).toBe(true);
    expect(result.current.licenseKey).toBe(TEST_CODE);
  });

  it('revalida un código persistido y concede premium solo si sigue válido', async () => {
    const hash = await createLicenseService().hashLicense(TEST_CODE);
    const validator = createLicenseService([hash]);
    currentSettings = createSettings({
      isLicensed: false,
      licenseKey: TEST_CODE,
    });
    vi.mocked(useSettings).mockReturnValue({
      data: currentSettings,
      loading: false,
    });

    const { result } = renderHook(() => useLicense(validator));

    await waitFor(() => {
      expect(result.current.isLicensed).toBe(true);
    });
    expect(settingsService.updateLicenseState).toHaveBeenCalledWith(TEST_CODE, {
      isLicensed: true,
      licenseKey: TEST_CODE,
    });
  });

  it('revoca el booleano persistido cuando el código no pertenece a la versión', async () => {
    currentSettings = createSettings({
      isLicensed: true,
      licenseKey: 'KIN-2099-Z9C42M',
    });
    vi.mocked(useSettings).mockReturnValue({
      data: currentSettings,
      loading: false,
    });

    const { result } = renderHook(() => useLicense(createLicenseService([])));

    await waitFor(() => {
      expect(settingsService.updateLicenseState).toHaveBeenCalledWith(
        'KIN-2099-Z9C42M',
        {
          isLicensed: false,
          licenseKey: null,
        }
      );
    });
    expect(result.current.isLicensed).toBe(false);
    expect(result.current.licenseKey).toBeNull();
  });
});
