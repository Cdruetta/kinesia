import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { Menu, X, Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

const SECTION_LABELS: Record<string, string> = {
  '/': 'Inicio',
  '/agenda': 'Agenda',
  '/propietarios': 'Propietarios',
  '/pacientes': 'Pacientes',
  '/comunicaciones': 'Comunicaciones',
  '/respaldos': 'Respaldos',
  '/configuracion': 'Configuración',
};

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatch(media.matches);
    const handler = () => setMatch(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return match;
}

const KEYS_BY_PATH: Record<string, string> = {
  '/': 'home',
  '/agenda': 'agenda',
  '/propietarios': 'owners',
  '/pacientes': 'patients',
  '/comunicaciones': 'communications',
  '/respaldos': 'backups',
  '/configuracion': 'settings',
};

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { theme, setTheme } = useTheme(); // aplica el tema (dark/light/system) al <html>
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const activeKey = KEYS_BY_PATH[location.pathname] ?? 'home';

  useEffect(() => {
    void (async () => {
      const { ensureStorage } = await import('@/db/instance');
      await ensureStorage();
      const { messageTemplatesService } = await import('@/services/messageTemplatesService');
      await messageTemplatesService.seedDefaults();
    })();
  }, []);

  return (
    <div className="flex min-h-screen bg-background dark:bg-[#1a1625] text-ink-main dark:text-violet-50">
      {/* Menú lateral (tablet y escritorio). En móvil se oculta y se usa el cajón. */}
      {!isMobile && (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          activeKey={activeKey}
        />
      )}

      <div className={cn('flex-1 flex flex-col min-w-0', isMobile ? '' : 'md:ml-64')}>
        <header className="h-16 border-b border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-2 text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            {!isMobile && collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="ml-2 rounded-md p-1.5 text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Expandir menú"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="font-serif text-base font-bold text-ink-main dark:text-violet-50 hidden sm:block">
              {SECTION_LABELS[location.pathname]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-md p-2 text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <NavLink
              to="/configuracion"
              end
              className="rounded-md p-2 text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-label="Configuración de la clínica"
            >
              <SettingsIcon className="w-4 h-4" />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Cajón lateral en móvil. */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#251f33] border-r border-border dark:border-violet-800/30"
          aria-label="Menú"
          role="navigation"
        >
          <div className="h-14 border-b border-border dark:border-violet-800/30 flex items-center justify-between px-4">
            <span className="font-serif font-bold text-lg text-ink-main dark:text-violet-50">Kinesia</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {[
              { key: 'home', label: 'Inicio', path: '/' },
              { key: 'agenda', label: 'Agenda', path: '/agenda' },
              { key: 'owners', label: 'Propietarios', path: '/propietarios' },
              { key: 'patients', label: 'Pacientes', path: '/pacientes' },
              { key: 'communications', label: 'Comunicaciones', path: '/comunicaciones' },
              { key: 'backups', label: 'Respaldos', path: '/respaldos' },
              { key: 'settings', label: 'Configuración', path: '/configuracion' },
            ].map((item) => {
              const isActive = activeKey === item.key;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end={item.key === 'home'}
                  onClick={() => setSidebarOpen(false)}
                  className={() =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium block',
                      isActive
                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600'
                        : 'text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600'
                    )
                  }
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
