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
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';

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
  const { session, loading } = useAuth();
  const isAuthPage = location.pathname === '/login';

  if (loading) return <p role="status">Verificando sesión...</p>;

  if (isAuthPage && session) return <Navigate to="/dashboard" replace />;
  if (!isAuthPage && !session) return <Navigate to="/login" replace />;

  return (
    <>
      {!isAuthPage && <Navbar />}
      <div style={{ padding: isAuthPage ? '0px' : '30px' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/donantes" element={<ProtectedRoute><DonantesListPage /></ProtectedRoute>} />
          <Route path="/donantes/nuevo" element={<ProtectedRoute><NuevoDonantePage /></ProtectedRoute>} />
          <Route path="/donantes/:id" element={<ProtectedRoute><DonanteFichaPage /></ProtectedRoute>} />
          <Route path="/solicitudes" element={<ProtectedRoute><SolicitudesListPage /></ProtectedRoute>} />
          <Route path="/solicitudes/nueva" element={<ProtectedRoute><NuevaSolicitudPage /></ProtectedRoute>} />
          <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetallePage /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><ConfiguracionPage /></ProtectedRoute>} />
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
