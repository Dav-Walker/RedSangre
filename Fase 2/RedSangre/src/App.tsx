// Comentarios - Rutas de la aplicación
// Define las rutas y el orden de las pantallas de acceso: login, código TOTP, cambio de contraseña y sistema.
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { LoginPage } from './pages/auth/LoginPage';
import { CambiarContrasenaPage } from './pages/auth/CambiarContrasenaPage';
import { ActivarCuentaPage } from './pages/auth/ActivarCuentaPage';
import { VerificacionDosPasosPage } from './pages/auth/VerificacionDosPasosPage';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { RoleBasedRoute } from './components/routes/RoleBasedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PantallaError } from './components/common/PantallaError';
import { ROLES_CON_ESCRITURA } from './utils/roles';
import { cargarPagina } from './utils/cargaDiferida';
import { registrarEvento } from './servicios/auditoria';
import styles from './App.module.css';

// Comentarios - Carga diferida de páginas
// Las páginas internas se descargan recién al visitarlas: el login no carga Recharts ni los formularios.
// Las páginas de autenticación se importan normal porque son las primeras que se ven.
// Comentarios - Manejo de errores y excepciones
// cargarPagina recarga una vez si la página no se pudo descargar (versión nueva publicada) y, si sigue fallando,
// deja que el ErrorBoundary muestre el aviso en vez de una pantalla en blanco.
const DashboardPage = lazy(cargarPagina(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))));
const DonantesListPage = lazy(cargarPagina(() => import('./pages/donantes/DonantesListPage').then((m) => ({ default: m.DonantesListPage }))));
const NuevoDonantePage = lazy(cargarPagina(() => import('./pages/donantes/NuevoDonantePage').then((m) => ({ default: m.NuevoDonantePage }))));
const DonanteFichaPage = lazy(cargarPagina(() => import('./pages/donantes/DonanteFichaPage').then((m) => ({ default: m.DonanteFichaPage }))));
const SolicitudesListPage = lazy(cargarPagina(() => import('./pages/solicitudes/SolicitudesListPage').then((m) => ({ default: m.SolicitudesListPage }))));
const SolicitudDetallePage = lazy(cargarPagina(() => import('./pages/solicitudes/SolicitudDetallePage').then((m) => ({ default: m.SolicitudDetallePage }))));
const NuevaSolicitudPage = lazy(cargarPagina(() => import('./pages/solicitudes/NuevaSolicitudPage').then((m) => ({ default: m.NuevaSolicitudPage }))));
const ConfiguracionPage = lazy(cargarPagina(() => import('./pages/configuracion/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage }))));

function LayoutPrincipal() {
  const location = useLocation();
  const { session, user, loading, dosPasosCompleto, errorPerfil, reintentarPerfil, signOut } = useAuth();
  // Comentarios - Activación de cuenta por correo
  // /login y /activar son públicas: no llevan menú y se pueden abrir sin sesión.
  const esPaginaPublica = location.pathname === '/login' || location.pathname === '/activar';
  const esLogin = location.pathname === '/login';

  // Comentarios - Bitácora completa
  // Cada página interna que abre el usuario queda registrada, una vez que la sesión está completa
  // (con código TOTP y sin cambio de contraseña pendiente).
  const sesionCompleta = Boolean(session && user && dosPasosCompleto && !user.debe_cambiar_password);
  useEffect(() => {
    if (!sesionCompleta || esPaginaPublica) return;
    void registrarEvento('VER_PAGINA', { detalle: { ruta: location.pathname } });
  }, [sesionCompleta, esPaginaPublica, location.pathname]);

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

  // Comentarios - Manejo de errores y excepciones
  // Sin perfil no se sabe el rol ni el estado de la cuenta: en vez de entrar a ciegas, se avisa y se ofrece
  // reintentar (falla de lectura) o cerrar sesión (cuenta sin perfil asignado).
  if (session && errorPerfil) {
    const sinPerfil = errorPerfil === 'sin_perfil';
    return (
      <PantallaError
        titulo={sinPerfil ? 'Cuenta sin perfil' : 'No se pudo cargar tu perfil'}
        mensaje={sinPerfil
          ? 'Tu cuenta no tiene un perfil asignado. Contacta al administrador.'
          : 'Revisa tu conexión e inténtalo nuevamente.'}
        acciones={[
          ...(sinPerfil ? [] : [{ texto: 'Reintentar', onClick: reintentarPerfil, principal: true }]),
          { texto: 'Cerrar sesión', onClick: () => { void signOut(); } },
        ]}
      />
    );
  }

  // Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
  // Mientras el perfil tenga debe_cambiar_password, solo se muestra la pantalla de cambio, sin menú ni otras rutas.
  if (user?.debe_cambiar_password) return <CambiarContrasenaPage />;

  return (
    <>
      {!esPaginaPublica && <Navbar />}
      <div className={esPaginaPublica ? undefined : styles.contenidoInterno}>
        {/* Comentarios - Manejo de errores y excepciones */}
        {/* Un error en una página deja el menú visible; al cambiar de ruta el aviso se reinicia (key) */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<p role="status">Cargando...</p>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/activar" element={session ? <Navigate to="/dashboard" replace /> : <ActivarCuentaPage />} />
              <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/donantes" element={<DonantesListPage />} />
              {/* Comentarios - Perfil TENS solo lectura */}
              {/* Las pantallas de alta solo se abren con permiso de escritura; TENS vuelve al dashboard */}
              <Route path="/donantes/nuevo" element={<RoleBasedRoute rolesPermitidos={ROLES_CON_ESCRITURA}><NuevoDonantePage /></RoleBasedRoute>} />
              <Route path="/donantes/:id" element={<DonanteFichaPage />} />
              <Route path="/solicitudes" element={<SolicitudesListPage />} />
              <Route path="/solicitudes/nueva" element={<RoleBasedRoute rolesPermitidos={ROLES_CON_ESCRITURA}><NuevaSolicitudPage /></RoleBasedRoute>} />
              <Route path="/solicitudes/:id" element={<SolicitudDetallePage />} />
              <Route path="/configuracion" element={<RoleBasedRoute rolesPermitidos={['administrador']}><ConfiguracionPage /></RoleBasedRoute>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
}

export default function App() {
  // Comentarios - Manejo de errores y excepciones
  // ErrorBoundary externo: cubre errores del menú, del proveedor de sesión y de las pantallas de acceso.
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <LayoutPrincipal />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
