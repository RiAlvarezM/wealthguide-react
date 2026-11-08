import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const WorkspaceContext = createContext();

export const WORKSPACE_MODES = {
  DIARIO: 'diario',
  PATRIMONIO: 'patrimonio',
};

// Rutas asociadas a cada modo
const DIARIO_ROUTES = ['/presupuesto', '/gastos', '/ingresos', '/compromisos', '/calendario', '/presupuesto-detalle', '/tendencia', '/conciliacion', '/efectivo', '/homebudget'];
const PATRIMONIO_ROUTES = ['/resumen', '/patrimonio', '/inversiones', '/inmuebles', '/prestamos', '/jubilacion', '/lealtad', '/simuladores'];

export function WorkspaceProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('wealthguide_workspace_mode');
      if (saved && (saved === WORKSPACE_MODES.DIARIO || saved === WORKSPACE_MODES.PATRIMONIO)) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    // Default according to current path
    const path = window.location.pathname;
    if (DIARIO_ROUTES.some(r => path.startsWith(r))) return WORKSPACE_MODES.DIARIO;
    return WORKSPACE_MODES.PATRIMONIO;
  });

  // Mantener modo sincronizado al navegar directamente por URL
  useEffect(() => {
    const path = location.pathname;
    if (DIARIO_ROUTES.some(r => path.startsWith(r)) && mode !== WORKSPACE_MODES.DIARIO) {
      setMode(WORKSPACE_MODES.DIARIO);
      try { localStorage.setItem('wealthguide_workspace_mode', WORKSPACE_MODES.DIARIO); } catch (e) {}
    } else if (PATRIMONIO_ROUTES.some(r => path.startsWith(r)) && mode !== WORKSPACE_MODES.PATRIMONIO) {
      setMode(WORKSPACE_MODES.PATRIMONIO);
      try { localStorage.setItem('wealthguide_workspace_mode', WORKSPACE_MODES.PATRIMONIO); } catch (e) {}
    }
  }, [location.pathname]);

  const switchMode = (newMode, targetRoute = null) => {
    setMode(newMode);
    try {
      localStorage.setItem('wealthguide_workspace_mode', newMode);
    } catch (e) {}

    if (targetRoute) {
      navigate(targetRoute);
    } else {
      // Redirigir a la vista principal por defecto de cada modo
      if (newMode === WORKSPACE_MODES.DIARIO) {
        navigate('/presupuesto');
      } else {
        navigate('/patrimonio');
      }
    }
  };

  return (
    <WorkspaceContext.Provider value={{ mode, switchMode, isDiario: mode === WORKSPACE_MODES.DIARIO, isPatrimonio: mode === WORKSPACE_MODES.PATRIMONIO }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace debe usarse dentro de un WorkspaceProvider');
  }
  return context;
}
