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

function LayoutPrincipal() {
  const location = useLocation();
  const { session, loading } = useAuth();
  const esLogin = location.pathname === '/' || location.pathname === '/login';

  if (loading) return <p role="status">Verificando sesión...</p>;
  if (esLogin && session) return <Navigate to="/dashboard" replace />;
  if (!esLogin && !session) return <Navigate to="/" replace state={{ from: location }} />;

  return (
    <>
      {!esLogin && <Navbar />}
      <div style={{ padding: esLogin ? '0px' : '30px' }}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/donantes" element={<DonantesListPage />} />
          <Route path="/donantes/nuevo" element={<NuevoDonantePage />} />
          <Route path="/donantes/:id" element={<DonanteFichaPage />} />
          <Route path="/solicitudes" element={<SolicitudesListPage />} />
          <Route path="/solicitudes/nueva" element={<NuevaSolicitudPage />} />
          <Route path="/solicitudes/:id" element={<SolicitudDetallePage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
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
