import { useTheme } from '../../context/ThemeContext';
import { useWorkspace, WORKSPACE_MODES } from '../../context/WorkspaceContext';

export default function TopBar({ title, searchPlaceholder = 'Buscar...' }) {
  const { theme, toggleTheme } = useTheme();
  const { mode, switchMode, isDiario, isPatrimonio } = useWorkspace();

  return (
    <header className="flex justify-between items-center px-4 sm:px-6 h-16 border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 md:ml-[260px] transition-colors">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            AG
          </div>
        </div>

        {/* Workspace Switcher Pill (Dual-Mode) */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <button
            type="button"
            onClick={() => switchMode(WORKSPACE_MODES.DIARIO)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isDiario
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
            title="Módulo de Gastos e Ingresos del día a día (HomeBudget)"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            <span className="whitespace-nowrap">Día a Día</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode(WORKSPACE_MODES.PATRIMONIO)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isPatrimonio
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
            title="Módulo de Patrimonio Neto, Inversiones, Jubilación e Hipotecas"
          >
            <span className="material-symbols-outlined text-[16px]">account_balance</span>
            <span className="whitespace-nowrap">Patrimonio</span>
          </button>
        </div>

        {title && (
          <h1 className="hidden xl:block font-headline-md text-sm font-semibold text-slate-500 dark:text-zinc-400 tracking-tight border-l border-slate-200 dark:border-zinc-800 pl-3">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Quick Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2 pl-1">
          <span className={`w-2 h-2 rounded-full ${isDiario ? 'bg-emerald-500' : 'bg-sky-500'}`} />
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 hidden sm:inline">
            {isDiario ? 'HomeBudget Activo' : 'Patrimonio Activo'}
          </span>
        </div>
      </div>
    </header>
  );
}
