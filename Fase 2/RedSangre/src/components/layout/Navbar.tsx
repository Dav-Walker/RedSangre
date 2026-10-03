import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import styles from './Navbar.module.css';
import logoIndisa from '../../assets/logo-indisa.jpeg';
import { useAuth } from '../../contexts/useAuth';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const userMetadata = session?.user.user_metadata;
  const displayName =
    (typeof userMetadata?.full_name === 'string' && userMetadata.full_name) ||
    (typeof userMetadata?.name === 'string' && userMetadata.name) ||
    session?.user.email ||
    'Usuario';

  const handleLogout = async () => {
    setLogoutError('');
    try {
      const error = await signOut();
      if (error) {
        setLogoutError(error);
        return;
      }
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
    }
  };

  const getLinkClass = (path: string) => {
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
          <div className={styles.userBadge}>{displayName}</div>
          {logoutError && <span role="alert">{logoutError}</span>}
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <nav className={styles.navbar}>
        <ul className={styles.links}>
          <li>
            <Link to="/dashboard" className={getLinkClass('/dashboard')}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/donantes" className={getLinkClass('/donantes')}>
              Donantes
            </Link>
          </li>
          <li>
            <Link to="/solicitudes" className={getLinkClass('/solicitudes')}>
              Solicitudes
            </Link>
          </li>
          <li>
            <Link to="/configuracion" className={getLinkClass('/configuracion')}>
              Configuración
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}