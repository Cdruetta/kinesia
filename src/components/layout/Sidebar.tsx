import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import {
  ChevronLeft,
  Home,
  Calendar,
  Users,
  PawPrint,
  Mail,
  Database,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (_collapsed: boolean) => void;
  activeKey: string;
}

const NAV = [
  { key: 'home', label: 'Inicio', icon: Home, path: '/' },
  { key: 'agenda', label: 'Agenda', icon: Calendar, path: '/agenda' },
  { key: 'owners', label: 'Propietarios', icon: Users, path: '/propietarios' },
  { key: 'patients', label: 'Pacientes', icon: PawPrint, path: '/pacientes' },
  { key: 'communications', label: 'Comunicaciones', icon: Mail, path: '/comunicaciones' },
  { key: 'backups', label: 'Respaldos', icon: Database, path: '/respaldos' },
  { key: 'settings', label: 'Configuración', icon: Settings, path: '/configuracion' },
];

export function Sidebar({ collapsed, setCollapsed, activeKey }: SidebarProps) {
  const isCollapsible = collapsed;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] dark:border-violet-800/30 transition-width duration-200',
        !isCollapsible ? 'w-64' : 'w-16'
      )}
      aria-label="Menú principal"
    >
      <div className="flex h-14 items-center justify-between gap-1 px-3 border-b border-border dark:border-violet-800/30">
        <div className="flex items-center gap-2">
          {!isCollapsible && (
            <span className="font-serif font-bold text-lg text-ink-main dark:text-violet-50 tracking-tight">Kinesia</span>
          )}
          {isCollapsible && <span className="font-serif font-bold text-lg text-ink-main dark:text-violet-50">K</span>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!isCollapsible)}
          className="rounded-md p-1.5 text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label={isCollapsible ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsible ? <ChevronLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" aria-label="Secciones">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.key === 'home'}
              className={({ isActive }) => {
                if (!isCollapsible) {
                  return cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 shadow-sm'
                      : 'text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600'
                  );
                }
                return cn(
                  'flex flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 shadow-sm'
                    : 'text-ink-secondary dark:text-violet-200/70 hover:bg-violet-50 dark:bg-violet-900/20 hover:text-violet-600'
                );
              }}
              aria-current={isActive ? 'page' : undefined}
              title={!isCollapsible ? undefined : item.label}
            >
              <Icon className={cn('w-5 h-5 shrink-0', isCollapsible ? 'mx-auto' : '')} />
              {!isCollapsible && item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border dark:border-violet-800/30 text-center">
        {!isCollapsible && (
          <p className="text-xs text-ink-secondary dark:text-violet-200/70">Sistema de gestión clínica</p>
        )}
      </div>
    </aside>
  );
}
