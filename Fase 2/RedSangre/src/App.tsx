// Comentarios - Rutas de la aplicación
// Define las rutas y el orden de las pantallas de acceso: login, código TOTP, cambio de contraseña y sistema.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { LoginPage } from './pages/auth/LoginPage';
import { CambiarContrasenaPage } from './pages/auth/CambiarContrasenaPage';
import { ActivarCuentaPage } from './pages/auth/ActivarCuentaPage';
import { VerificacionDosPasosPage } from './pages/auth/VerificacionDosPasosPage';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { RoleBasedRoute } from './components/routes/RoleBasedRoute';
import styles from './App.module.css';

// Comentarios - Carga diferida de páginas
// Las páginas internas se descargan recién al visitarlas: el login no carga Recharts ni los formularios.
// Las páginas de autenticación se importan normal porque son las primeras que se ven.
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const DonantesListPage = lazy(() => import('./pages/donantes/DonantesListPage').then((m) => ({ default: m.DonantesListPage })));
const NuevoDonantePage = lazy(() => import('./pages/donantes/NuevoDonantePage').then((m) => ({ default: m.NuevoDonantePage })));
const DonanteFichaPage = lazy(() => import('./pages/donantes/DonanteFichaPage').then((m) => ({ default: m.DonanteFichaPage })));
const SolicitudesListPage = lazy(() => import('./pages/solicitudes/SolicitudesListPage').then((m) => ({ default: m.SolicitudesListPage })));
const SolicitudDetallePage = lazy(() => import('./pages/solicitudes/SolicitudDetallePage').then((m) => ({ default: m.SolicitudDetallePage })));
const NuevaSolicitudPage = lazy(() => import('./pages/solicitudes/NuevaSolicitudPage').then((m) => ({ default: m.NuevaSolicitudPage })));
const ConfiguracionPage = lazy(() => import('./pages/configuracion/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })));

function LayoutPrincipal() {
  const location = useLocation();
  const { session, user, loading, dosPasosCompleto } = useAuth();
  // Comentarios - Activación de cuenta por correo
  // /login y /activar son públicas: no llevan menú y se pueden abrir sin sesión.
  const esPaginaPublica = location.pathname === '/login' || location.pathname === '/activar';
  const esLogin = location.pathname === '/login';

  if (loading) return <p role="status">Verificando sesión...</p>;

  // Comentarios - Rutas protegidas
  // Toda ruta que no sea /login ni /activar exige sesión: sin sesión se redirige al login desde aquí,
  // así que las rutas internas no necesitan su propia revisión.
  if (esLogin && session) return <Navigate to="/dashboard" replace />;
  if (!esPaginaPublica && !session) return <Navigate to="/login" replace />;

  // Comentarios - Segundo factor TOTP (RF-36)
  // Toda sesión debe completar el código TOTP (aal2) antes de ver el sistema. Va antes del cambio de contraseña
  // porque Supabase exige aal2 para cambiar la contraseña de un usuario que ya tiene el segundo factor.
  if (session && !dosPasosCompleto) return <VerificacionDosPasosPage />;

  // Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
  // Mientras el perfil tenga debe_cambiar_password, solo se muestra la pantalla de cambio, sin menú ni otras rutas.
  if (user?.debe_cambiar_password) return <CambiarContrasenaPage />;

  return (
    <>
      {!esPaginaPublica && <Navbar />}
      <div className={esPaginaPublica ? undefined : styles.contenidoInterno}>
        <Suspense fallback={<p role="status">Cargando...</p>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/activar" element={session ? <Navigate to="/dashboard" replace /> : <ActivarCuentaPage />} />
            <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/donantes" element={<DonantesListPage />} />
            <Route path="/donantes/nuevo" element={<NuevoDonantePage />} />
            <Route path="/donantes/:id" element={<DonanteFichaPage />} />
            <Route path="/solicitudes" element={<SolicitudesListPage />} />
            <Route path="/solicitudes/nueva" element={<NuevaSolicitudPage />} />
            <Route path="/solicitudes/:id" element={<SolicitudDetallePage />} />
            <Route path="/configuracion" element={<RoleBasedRoute rolesPermitidos={['administrador']}><ConfiguracionPage /></RoleBasedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
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
