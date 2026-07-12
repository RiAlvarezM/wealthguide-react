import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/resumen', icon: 'analytics', label: 'Resumen' },
  { to: '/patrimonio', icon: 'account_balance_wallet', label: 'Patrimonio Neto' },
  { to: '/efectivo', icon: 'payments', label: 'Efectivo Diario' },
  { to: '/presupuesto', icon: 'receipt_long', label: 'Presupuesto' },
  { to: '/prestamos', icon: 'handshake', label: 'Préstamos' },
  { to: '/lealtad', icon: 'loyalty', label: 'Lealtad' },
  { to: '/jubilacion', icon: 'psychology_alt', label: 'Jubilación' },
  { to: '/simuladores', icon: 'calculate', label: 'Simuladores' },
  { to: '/configuracion', icon: 'settings', label: 'Configuración' },
];

export default function Sidebar() {
  const { logout } = useAuthContext();

  return (
    <nav className="hidden md:flex flex-col fixed h-screen w-[280px] left-0 top-0 border-r border-outline-variant shadow-sm bg-primary-container py-lg z-50">
      <div className="px-gutter mb-lg flex items-center gap-sm">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-on-secondary font-headline-md">
          W
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-white tracking-tight">
            WealthGuide
          </h1>
          <p className="font-body-sm text-body-sm text-on-primary-container">Portafolio Familiar</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 px-xs">
        {NAV_ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                title="Próximamente disponible"
                className="flex items-center gap-xs px-sm py-[6px] text-on-primary-container/40 cursor-not-allowed font-body-sm text-body-sm rounded"
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
                <span className="text-[10px] bg-on-primary-fixed-variant/30 text-on-primary-container/60 px-1 rounded ml-auto">
                  Pronto
                </span>
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-xs px-sm py-[6px] transition-colors font-body-sm text-body-sm rounded',
                  isActive
                    ? 'bg-secondary-container/10 border-l-4 border-secondary text-secondary-fixed-dim font-bold'
                    : 'text-on-primary-container/70 hover:text-on-primary-container hover:bg-on-primary-fixed-variant/20',
                ].join(' ')
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="px-sm mt-auto pt-sm">
        <button
          type="button"
          className="w-full h-[40px] bg-secondary text-white font-label-md text-label-md rounded hover:bg-secondary/90 transition-colors flex items-center justify-center gap-xs mb-sm"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Exportar Reportes
        </button>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-xs px-sm py-xs text-on-primary-container/70 hover:text-on-primary-container hover:bg-on-primary-fixed-variant/20 transition-colors font-body-sm text-body-sm rounded"
        >
          <span className="material-symbols-outlined">logout</span> Cerrar Sesión
        </button>
      </div>
    </nav>
  );
}
