import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DonantesListPage } from './pages/donantes/DonantesListPage';
import { NuevoDonantePage } from './pages/donantes/NuevoDonantePage';
import { DonanteFichaPage } from './pages/donantes/DonanteFichaPage';
import { SolicitudesListPage } from './pages/solicitudes/SolicitudesListPage';
import { SolicitudDetallePage } from './pages/solicitudes/SolicitudDetallePage';
import { NuevaSolicitudPage } from './pages/solicitudes/NuevaSolicitudPage';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import { LoginPage } from './pages/auth/LoginPage';
import { CambiarContrasenaPage } from './pages/auth/CambiarContrasenaPage';
import { ActivarCuentaPage } from './pages/auth/ActivarCuentaPage';
import { VerificacionDosPasosPage } from './pages/auth/VerificacionDosPasosPage';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { RoleBasedRoute } from './components/routes/RoleBasedRoute';


interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) return <p role="status">Verificando sesión...</p>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function LayoutPrincipal() {
  const location = useLocation();
  const { session, user, loading, dosPasosCompleto } = useAuth();
  // Comentarios - Activación de cuenta por correo
  // /login y /activar son públicas: no llevan menú y se pueden abrir sin sesión.
  const isAuthPage = location.pathname === '/login' || location.pathname === '/activar';
  const esLogin = location.pathname === '/login';

  if (loading) return <p role="status">Verificando sesión...</p>;

  if (esLogin && session) return <Navigate to="/dashboard" replace />;
  if (!isAuthPage && !session) return <Navigate to="/login" replace />;

  // Comentarios - Segundo factor TOTP (RF-36)
  // Toda sesión debe completar el código TOTP (aal2) antes de ver el sistema. Va antes del cambio de contraseña
  // porque Supabase exige aal2 para cambiar la contraseña de un usuario que ya tiene el segundo factor.
  if (session && !dosPasosCompleto) return <VerificacionDosPasosPage />;

  // Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
  // Mientras el perfil tenga debe_cambiar_password, solo se muestra la pantalla de cambio, sin menú ni otras rutas.
  if (user?.debe_cambiar_password) return <CambiarContrasenaPage />;

  return (
    <>
      {!isAuthPage && <Navbar />}
      <div style={{ padding: isAuthPage ? '0px' : '30px' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activar" element={session ? <Navigate to="/dashboard" replace /> : <ActivarCuentaPage />} />
          <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/donantes" element={<ProtectedRoute><DonantesListPage /></ProtectedRoute>} />
          <Route path="/donantes/nuevo" element={<ProtectedRoute><NuevoDonantePage /></ProtectedRoute>} />
          <Route path="/donantes/:id" element={<ProtectedRoute><DonanteFichaPage /></ProtectedRoute>} />
          <Route path="/solicitudes" element={<ProtectedRoute><SolicitudesListPage /></ProtectedRoute>} />
          <Route path="/solicitudes/nueva" element={<ProtectedRoute><NuevaSolicitudPage /></ProtectedRoute>} />
          <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetallePage /></ProtectedRoute>} />
          <Route path="/configuracion" element={<RoleBasedRoute allowedRoles={['administrador']}><ConfiguracionPage /></RoleBasedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LayoutPrincipal />
      </AuthProvider>
    </BrowserRouter>
  );
}
