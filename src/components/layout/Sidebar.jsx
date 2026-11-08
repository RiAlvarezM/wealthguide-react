import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace, WORKSPACE_MODES } from '../../context/WorkspaceContext';

const DIARIO_NAV_ITEMS = [
  { to: '/presupuesto', icon: 'home', label: 'Dashboard Home' },
  { to: '/compromisos', icon: 'calendar_month', label: 'Compromisos & Radar' },
  { to: '/gastos', icon: 'shopping_bag', label: 'Gastos por Categoría' },
  { to: '/ingresos', icon: 'payments', label: 'Ingresos por Fuente' },
  { to: '/presupuesto-detalle', icon: 'track_changes', label: 'Presupuesto vs Real' },
  { to: '/tendencia', icon: 'show_chart', label: 'Tendencia & Flujo' },
  { to: '/conciliacion', icon: 'sync_alt', label: 'Conciliación de Cierre' },
  { to: '/efectivo', icon: 'receipt_long', label: 'Efectivo Diario' },
  { to: '/configuracion', icon: 'settings', label: 'Configuración' },
];

const PATRIMONIO_NAV_ITEMS = [
  { to: '/resumen', icon: 'analytics', label: 'Resumen' },
  { to: '/patrimonio', icon: 'account_balance_wallet', label: 'Patrimonio Neto' },
  { to: '/inmuebles', icon: 'domain', label: 'Bienes Raíces & Hub' },
  { to: '/prestamos', icon: 'handshake', label: 'Préstamos' },
  { to: '/jubilacion', icon: 'psychology_alt', label: 'Jubilación' },
  { to: '/lealtad', icon: 'loyalty', label: 'Lealtad' },
  { to: '/simuladores', icon: 'calculate', label: 'Simuladores' },
  { to: '/configuracion', icon: 'settings', label: 'Configuración' },
];

export default function Sidebar() {
  const { logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const { mode, switchMode, isDiario, isPatrimonio } = useWorkspace();

  const navItems = isDiario ? DIARIO_NAV_ITEMS : PATRIMONIO_NAV_ITEMS;

  return (
    <nav className="hidden md:flex flex-col fixed h-screen w-[260px] left-0 top-0 border-r border-slate-200 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950 py-6 z-50 transition-colors">
      {/* Brand Header */}
      <div className="px-6 mb-6 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm ${
          isDiario 
            ? 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-500/20' 
            : 'bg-gradient-to-br from-slate-800 to-zinc-950 dark:from-zinc-700 dark:to-zinc-900 shadow-slate-900/20'
        }`}>
          {isDiario ? 'HB' : 'AG'}
        </div>
        <div>
          <h1 className="font-headline-md text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-tight">
            Álvarez Gamboa
          </h1>
          <p className="font-body-sm text-xs text-slate-500 dark:text-zinc-400 font-medium">
            {isDiario ? 'Control Día a Día' : 'Networth Familiar'}
          </p>
        </div>
      </div>

      {/* Switcher integrado en Sidebar */}
      <div className="px-4 mb-5">
        <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => switchMode(WORKSPACE_MODES.DIARIO)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isDiario
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">receipt_long</span>
            <span>Día a Día</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode(WORKSPACE_MODES.PATRIMONIO)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isPatrimonio
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">account_balance</span>
            <span>Patrimonio</span>
          </button>
        </div>
      </div>

      {/* Secciones de Navegación */}
      <div className="px-4 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          {isDiario ? 'Módulo HomeBudget' : 'Módulo de Patrimonio'}
        </span>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3.5 py-2.5 transition-all text-sm rounded-lg font-medium',
                isActive
                  ? isDiario
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900/60',
              ].join(' ')
            }
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Card para alternar rápidamente al otro módulo */}
      <div className="px-3 mb-3">
        <button
          type="button"
          onClick={() => switchMode(isDiario ? WORKSPACE_MODES.PATRIMONIO : WORKSPACE_MODES.DIARIO)}
          className="w-full p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/60 text-left transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-400 group-hover:text-emerald-500 transition-colors">
              {isDiario ? 'account_balance' : 'receipt_long'}
            </span>
            <div className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
              {isDiario ? 'Ir a Patrimonio' : 'Ir a Día a Día'}
            </div>
          </div>
          <span className="material-symbols-outlined text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>

      {/* Footer Actions: Dark Mode Toggle & Logout */}
      <div className="px-4 mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800/60 flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3.5 py-2 w-full text-left text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900/60 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 px-3.5 py-2 w-full text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </nav>
  );
}
