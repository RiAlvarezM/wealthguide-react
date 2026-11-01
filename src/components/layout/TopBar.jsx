import { useTheme } from '../../context/ThemeContext';

export default function TopBar({ title, searchPlaceholder = 'Buscar...' }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex justify-between items-center px-6 h-16 border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 md:ml-[260px] transition-colors">
      <div className="flex items-center gap-4">
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
            AG
          </div>
          <span className="font-bold text-base text-slate-900 dark:text-zinc-100">
            Álvarez Gamboa
          </span>
        </div>
        {title && (
          <h1 className="hidden md:block font-headline-md text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            {title}
          </h1>
        )}
        <div className="relative hidden lg:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-[18px]">
            search
          </span>
          <input
            className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm w-64 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Quick Theme Toggle in TopBar */}
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
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 hidden sm:inline">
            Portafolio Familiar
          </span>
        </div>
      </div>
    </header>
  );
}
