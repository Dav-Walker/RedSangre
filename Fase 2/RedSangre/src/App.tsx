import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

function LayoutPrincipal() {
  const location = useLocation();
  const esLogin = location.pathname === '/login';

  return (
    <>
      {!esLogin && <Navbar />}
      <div style={{ padding: esLogin ? '0px' : '30px' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<DashboardPage />} />
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
      <LayoutPrincipal />
    </BrowserRouter>
  );
}