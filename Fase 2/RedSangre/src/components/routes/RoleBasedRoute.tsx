import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../contexts/auth-context';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { session, user, loading } = useAuth();

  if (loading) return <p role="status">Verificando sesión...</p>;
  if (!session || !user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
