// src/context/AuthContext.jsx
//
// Provee el estado de autenticación (user, login, register, logout) a
// toda la aplicación, para que cualquier componente pueda saber si hay
// un usuario autenticado sin tener que pasar props manualmente.

import { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de un <AuthProvider>');
  }
  return context;
}

export default AuthContext;
