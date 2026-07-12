export default function TopBar({ title, searchPlaceholder = 'Buscar...' }) {
  return (
    <header className="flex justify-between items-center px-gutter h-16 border-b border-outline-variant bg-surface sticky top-0 z-40 md:ml-[280px]">
      <div className="flex items-center gap-sm">
        <div className="md:hidden font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">
          WealthGuide
        </div>
        {title && (
          <h1 className="hidden md:block font-headline-md text-headline-md font-bold text-on-surface">
            {title}
          </h1>
        )}
        <div className="relative hidden lg:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-sm w-64 focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container outline-none transition-colors"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-sm">
        <button
          type="button"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          type="button"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <div className="h-6 w-px bg-outline-variant mx-2 hidden sm:block" />
        <button
          type="button"
          className="hidden sm:block text-on-surface-variant hover:bg-surface-container-low transition-colors px-3 py-2 rounded font-label-md text-label-md"
        >
          Soporte
        </button>
      </div>
    </header>
  );
}
