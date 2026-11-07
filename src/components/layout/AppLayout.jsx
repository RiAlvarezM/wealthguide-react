import { NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useWorkspace, WORKSPACE_MODES } from '../../context/WorkspaceContext';

export default function AppLayout({ title, searchPlaceholder, children }) {
  const { isDiario, switchMode } = useWorkspace();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 antialiased transition-colors pb-16 md:pb-0">
      <Sidebar />
      <div className="flex flex-col md:ml-[260px]">
        <TopBar title={title} searchPlaceholder={searchPlaceholder} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {isDiario ? (
          <>
            <NavLink
              to="/presupuesto"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[10px] font-bold rounded-xl transition-colors ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">home</span>
              <span>Inicio</span>
            </NavLink>

            <NavLink
              to="/gastos"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[10px] font-bold rounded-xl transition-colors ${
                  isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              <span>Gastos</span>
            </NavLink>

            <NavLink
              to="/ingresos"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[10px] font-bold rounded-xl transition-colors ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">payments</span>
              <span>Ingresos</span>
            </NavLink>

            <NavLink
              to="/tendencia"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[10px] font-bold rounded-xl transition-colors ${
                  isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">show_chart</span>
              <span>Tendencia</span>
            </NavLink>

            <button
              type="button"
              onClick={() => switchMode(WORKSPACE_MODES.PATRIMONIO)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-zinc-300 rounded-xl"
            >
              <span className="material-symbols-outlined text-[20px] text-sky-500">account_balance</span>
              <span>Patrimonio ➔</span>
            </button>
          </>
        ) : (
          <>
            <NavLink
              to="/patrimonio"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold rounded-xl transition-colors ${
                  isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              <span>Patrimonio</span>
            </NavLink>

            <NavLink
              to="/prestamos"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold rounded-xl transition-colors ${
                  isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">handshake</span>
              <span>Préstamos</span>
            </NavLink>

            <NavLink
              to="/jubilacion"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold rounded-xl transition-colors ${
                  isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">psychology_alt</span>
              <span>Jubilación</span>
            </NavLink>

            <button
              type="button"
              onClick={() => switchMode(WORKSPACE_MODES.DIARIO)}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 rounded-xl"
            >
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              <span>Día a Día ➔</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
