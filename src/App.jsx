import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AccountsProvider } from './context/AccountsContext';
import { PropertiesProvider } from './context/PropertiesContext';
import { VehiclesProvider } from './context/VehiclesContext';
import { LoyaltyProvider } from './context/LoyaltyContext';
import { NetworthHistoryProvider } from './context/NetworthHistoryContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import PatrimonioNeto from './pages/PatrimonioNeto';
import Resumen from './pages/Resumen';
import EfectivoDiario from './pages/EfectivoDiario';
import Presupuesto from './pages/Presupuesto';
import HomeBudgetDashboard from './pages/HomeBudgetDashboard';
import GastosList from './pages/GastosList';
import IngresosList from './pages/IngresosList';
import PresupuestoVsReal from './pages/PresupuestoVsReal';
import TendenciaFlujo from './pages/TendenciaFlujo';
import ConciliacionFinDeMes from './pages/ConciliacionFinDeMes';
import CalendarioCompromisos from './pages/CalendarioCompromisos';
import Simuladores from './pages/Simuladores';
import Jubilacion from './pages/Jubilacion';
import Prestamos from './pages/Prestamos';
import InmueblesHub from './pages/InmueblesHub';
import InversionesTracker from './pages/InversionesTracker';
import FireDashboard from './pages/FireDashboard';
import { AmortizacionProvider } from './context/AmortizacionContext';
import { ThemeProvider } from './context/ThemeContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { HomeBudgetProvider } from './context/HomeBudgetContext';
import Lealtad from './pages/Lealtad';
import Configuracion from './pages/Configuracion';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccountsProvider>
          <PropertiesProvider>
            <VehiclesProvider>
              <LoyaltyProvider>
                <NetworthHistoryProvider>
                  <AmortizacionProvider>
                  <BrowserRouter>
                    <WorkspaceProvider>
                      <HomeBudgetProvider>
                      <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route
                      path="/patrimonio"
                      element={
                        <ProtectedRoute>
                          <PatrimonioNeto />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/resumen"
                      element={
                        <ProtectedRoute>
                          <Resumen />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/efectivo"
                      element={
                        <ProtectedRoute>
                          <EfectivoDiario />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/presupuesto"
                      element={
                        <ProtectedRoute>
                          <HomeBudgetDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/homebudget"
                      element={<Navigate to="/presupuesto" replace />}
                    />
                    <Route
                      path="/gastos"
                      element={
                        <ProtectedRoute>
                          <GastosList />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ingresos"
                      element={
                        <ProtectedRoute>
                          <IngresosList />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/presupuesto-detalle"
                      element={
                        <ProtectedRoute>
                          <PresupuestoVsReal />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tendencia"
                      element={
                        <ProtectedRoute>
                          <TendenciaFlujo />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/conciliacion"
                      element={
                        <ProtectedRoute>
                          <ConciliacionFinDeMes />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/compromisos"
                      element={
                        <ProtectedRoute>
                          <CalendarioCompromisos />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/calendario"
                      element={<Navigate to="/compromisos" replace />}
                    />
                    <Route
                      path="/presupuesto-antiguo"
                      element={
                        <ProtectedRoute>
                          <Presupuesto />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/prestamos"
                      element={
                        <ProtectedRoute>
                          <Prestamos />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/inmuebles"
                      element={
                        <ProtectedRoute>
                          <InmueblesHub />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/inversiones"
                      element={
                        <ProtectedRoute>
                          <InversionesTracker />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/fire"
                      element={
                        <ProtectedRoute>
                          <FireDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/lealtad"
                      element={
                        <ProtectedRoute>
                          <Lealtad />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/jubilacion"
                      element={
                        <ProtectedRoute>
                          <Jubilacion />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/simuladores"
                      element={
                        <ProtectedRoute>
                          <Simuladores />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/configuracion"
                      element={
                        <ProtectedRoute>
                          <Configuracion />
                        </ProtectedRoute>
                      }
                    />

                    <Route path="/" element={<Navigate to="/efectivo" replace />} />
                    <Route path="*" element={<Navigate to="/efectivo" replace />} />
                    </Routes>
                      </HomeBudgetProvider>
                  </WorkspaceProvider>
                </BrowserRouter>
              </AmortizacionProvider>
              </NetworthHistoryProvider>
            </LoyaltyProvider>
          </VehiclesProvider>
        </PropertiesProvider>
      </AccountsProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
