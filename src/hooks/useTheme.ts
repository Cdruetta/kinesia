import { useEffect, useState, useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { settingsService } from '@/services/settingsService';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const { data: settings } = useSettings();
  const [theme, setThemeState] = useState<Theme>('system');

  // Cargar tema de settings
  useEffect(() => {
    if (settings?.theme) {
      setThemeState(settings.theme as Theme);
    }
  }, [settings?.theme]);

  // Aplicar clase dark al html
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Escuchar cambios del sistema si está en modo system
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (mq.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      await settingsService.update({ theme: newTheme } as any);
    } catch {
      // silencioso
    }
  }, []);

  return { theme, setTheme };
}
