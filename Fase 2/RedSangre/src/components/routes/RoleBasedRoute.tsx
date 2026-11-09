// Comentarios - Rutas por rol
// Muestra la página solo a usuarios activos con alguno de los roles permitidos; al resto los envía al dashboard.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../contexts/auth-context';

interface RutaPorRolProps {
  children: React.ReactNode;
  rolesPermitidos: UserRole[];
}

export function RoleBasedRoute({ children, rolesPermitidos }: RutaPorRolProps) {
  const { session, user, loading } = useAuth();

  if (loading) return <p role="status">Verificando sesión...</p>;
  if (!session || !user) return <Navigate to="/login" replace />;

  if (!user.activo || !rolesPermitidos.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
