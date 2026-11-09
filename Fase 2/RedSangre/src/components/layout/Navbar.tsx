// Comentarios - Barra de navegación
// Cabecera con el logo, el usuario conectado, el botón de cerrar sesión y el menú de módulos.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import styles from './Navbar.module.css';
import logoIndisa from '../../assets/logo-indisa.jpeg';
import { useAuth } from '../../contexts/useAuth';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, user, signOut } = useAuth();
  const [errorCierre, setErrorCierre] = useState('');
  const metadatos = session?.user.user_metadata;
  const nombreVisible = user ? `${user.nombre} ${user.apellido}` :
    (typeof metadatos?.full_name === 'string' && metadatos.full_name) ||
    (typeof metadatos?.name === 'string' && metadatos.name) ||
    session?.user.email ||
    'Usuario';
  const esAdmin = user?.rol === 'administrador';

  const handleCerrarSesion = async () => {
    setErrorCierre('');
    try {
      const error = await signOut();
      if (error) {
        setErrorCierre(error);
        return;
      }
      navigate('/', { replace: true });
    } catch (error) {
      setErrorCierre(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
    }
  };

  const claseEnlace = (path: string) => {
    if (location.pathname === path || location.pathname.startsWith(`${path}/`)) return styles.activeLink;
    return styles.navLink;
  };

  return (
    <header>
      <div className={styles.topHeader}>
        <div className={styles.logoContainer}>
          <img src={logoIndisa} alt="Logo Clínica Indisa" className={styles.logoImg} />
          <span className={styles.logoRedSangre}>RedSangre</span>
        </div>
        
        <div className={styles.userActions}>
          <div className={styles.userBadge}>
            {nombreVisible}
            {user && <span className={styles.rolUsuario}>({user.rol})</span>}
          </div>
          {errorCierre && <span role="alert">{errorCierre}</span>}
          <button className={styles.logoutBtn} onClick={handleCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <nav className={styles.navbar}>
        <ul className={styles.links}>
          <li>
            <Link to="/dashboard" className={claseEnlace('/dashboard')}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/donantes" className={claseEnlace('/donantes')}>
              Donantes
            </Link>
          </li>
          <li>
            <Link to="/solicitudes" className={claseEnlace('/solicitudes')}>
              Solicitudes
            </Link>
          </li>
          {esAdmin && (
            <li>
              <Link to="/configuracion" className={claseEnlace('/configuracion')}>
                Configuración
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}