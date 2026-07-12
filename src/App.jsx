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
import Simuladores from './pages/Simuladores';
import Jubilacion from './pages/Jubilacion';
import Prestamos from './pages/Prestamos';
import Lealtad from './pages/Lealtad';
import Configuracion from './pages/Configuracion';

export default function App() {
  return (
    <AuthProvider>
      <AccountsProvider>
        <PropertiesProvider>
          <VehiclesProvider>
            <LoyaltyProvider>
              <NetworthHistoryProvider>
                <BrowserRouter>
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
                </BrowserRouter>
              </NetworthHistoryProvider>
            </LoyaltyProvider>
          </VehiclesProvider>
        </PropertiesProvider>
      </AccountsProvider>
    </AuthProvider>
  );
}
