import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import logoIndisa from '../../assets/logo-indisa.jpeg';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate(); // Activamos el "GPS" de React

  const getLinkClass = (path: string) => {
    if (path === '/' && location.pathname === '/') return styles.activeLink;
    if (path !== '/' && location.pathname.startsWith(path)) return styles.activeLink;
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
          <div className={styles.userBadge}>Lilith Juarez</div>
          {/* ¡Aquí está la magia del cierre de sesión! */}
          <button className={styles.logoutBtn} onClick={() => navigate('/login')}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <nav className={styles.navbar}>
        <ul className={styles.links}>
          <li>
            <Link to="/" className={getLinkClass('/')}>
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