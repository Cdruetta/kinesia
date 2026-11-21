import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '@/hooks/useSettings';
import { DEFAULT_SETTINGS, type Settings } from '@/models';
import { pinAccessService } from '@/services/pinAccessService';
import { usePin } from '@/hooks/usePin';

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@/services/pinAccessService', () => ({
  pinAccessService: {
    unlock: vi.fn(),
  },
}));

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  const now = '2026-11-20T12:00:00.000Z';
  return {
    ...DEFAULT_SETTINGS,
    id: 'settings',
    pinEnabled: true,
    pinHash: 'pin-hash',
    pinSalt: 'pin-salt',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides,
  };
}

describe('usePin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rehidrata los intentos y el bloqueo desde la configuración persistida', () => {
    vi.mocked(useSettings).mockReturnValue({
      data: makeSettings({
        pinAttempts: 4,
        pinLockedUntil: new Date(Date.now() + 60_000).toISOString(),
      }),
      loading: false,
    });

    const { result } = renderHook(() => usePin());

    expect(result.current.locked).toBe(true);
    expect(result.current.attempts).toBe(4);
    expect(result.current.isTemporarilyLocked).toBe(true);
    expect(result.current.remainingSeconds).toBeGreaterThan(0);
  });

  it('vuelve a habilitar el formulario cuando vence el bloqueo temporal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
    vi.mocked(useSettings).mockReturnValue({
      data: makeSettings({
        pinAttempts: 4,
        pinLockedUntil: '2026-11-20T12:00:01.000Z',
      }),
      loading: false,
    });

    const { result } = renderHook(() => usePin());

    expect(result.current.isTemporarilyLocked).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1_010);
    });
    expect(result.current.isTemporarilyLocked).toBe(false);
  });

  it('desbloquea la pantalla después de un PIN correcto', async () => {
    vi.mocked(useSettings).mockReturnValue({
      data: makeSettings(),
      loading: false,
    });
    vi.mocked(pinAccessService.unlock).mockResolvedValue({
      status: 'success',
      attempts: 0,
    });

    const { result } = renderHook(() => usePin());

    await act(async () => {
      await result.current.unlock('1234');
    });

    expect(result.current.locked).toBe(false);
    expect(pinAccessService.unlock).toHaveBeenCalledWith('1234');
  });
});
