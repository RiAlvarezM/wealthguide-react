import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV_ITEMS = [
  { to: '/resumen', icon: 'analytics', label: 'Resumen' },
  { to: '/patrimonio', icon: 'account_balance_wallet', label: 'Patrimonio Neto' },
  { to: '/efectivo', icon: 'payments', label: 'Efectivo Diario' },
  { to: '/presupuesto', icon: 'receipt_long', label: 'Gastos & Presupuesto' },
  { to: '/prestamos', icon: 'handshake', label: 'Préstamos' },
  { to: '/lealtad', icon: 'loyalty', label: 'Lealtad' },
  { to: '/jubilacion', icon: 'psychology_alt', label: 'Jubilación' },
  { to: '/simuladores', icon: 'calculate', label: 'Simuladores' },
  { to: '/configuracion', icon: 'settings', label: 'Configuración' },
];

export default function Sidebar() {
  const { logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="hidden md:flex flex-col fixed h-screen w-[260px] left-0 top-0 border-r border-slate-200 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950 py-6 z-50 transition-colors">
      {/* Brand Header */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-base shadow-sm shadow-emerald-500/20">
          AG
        </div>
        <div>
          <h1 className="font-headline-md text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-tight">
            Álvarez Gamboa
          </h1>
          <p className="font-body-sm text-xs text-slate-500 dark:text-zinc-400 font-medium">Networth Familiar</p>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3.5 py-2.5 transition-all text-sm rounded-lg font-medium',
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900/60',
                ].join(' ')
              }
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Footer Actions: Dark Mode Toggle & Logout */}
      <div className="px-4 mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800/60 flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{theme === 'dark' ? 'Tema Claro' : 'Tema Oscuro'}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            {theme}
          </span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors rounded-lg"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </nav>
  );
}
