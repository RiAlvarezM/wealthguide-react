import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading, approved } = useAuthContext();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-body-md">
        Cargando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Sesión válida pero todavía no sabemos si el admin ya la aprobó
  // (users/{uid} aún no llega del listener de Firestore).
  if (approved === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-body-md">
        Cargando...
      </div>
    );
  }

  if (approved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-body-md text-center px-6">
        <div className="max-w-sm">
          <p className="font-title-md text-title-md text-on-surface mb-2">
            Cuenta pendiente de aprobación
          </p>
          <p>
            Tu cuenta se creó correctamente, pero un administrador todavía debe
            aprobarla desde la consola de Firebase antes de que puedas ver el
            dashboard. Avísale para que la active.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
