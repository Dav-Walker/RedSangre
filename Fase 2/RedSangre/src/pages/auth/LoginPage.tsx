import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';
// Importamos el nuevo logo que acabas de guardar
import logoIndisa from '../../assets/cl_nica_indisa_logo_2.jpg';

export function LoginPage() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (correo === 'error@indisa.cl' || correo === '') {
      setHasError(true);
    } else {
      setHasError(false);
      navigate('/'); 
    }
  };

  return (
    <div className={styles.contenedorLogin}>
      
      <div className={styles.panelIzquierdo}>
        <div style={{ width: '100%' }}></div>
        
        <div className={styles.logoContainer}>
          {/* Aquí se carga automáticamente el nuevo logo */}
          <img src={logoIndisa} alt="Logo Clinica Indisa" className={styles.logoImg} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className={styles.textoInferiorAzul}>Acceso al sistema interno de gestión de donantes</div>
          <div className={styles.certificaciones}>HIPAA Certification • OWASP Compliant</div>
        </div>
      </div>

      <div className={styles.panelDerecho}>
        <div className={styles.formWrapper}>
          
          <h1 className={styles.tituloApp}>RedSangre</h1>
          <div className={styles.subtituloApp}>Iniciar sesión</div>

          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            
            <div className={styles.grupoInput}>
              <label className={`${styles.label} ${hasError ? styles.labelError : ''}`}>
                Correo Institucional
              </label>
              <input 
                type="email" 
                className={`${styles.input} ${hasError ? styles.inputError : ''}`}
                placeholder="nombre.apellido@indisa.cl"
                value={correo}
                onChange={(e) => { setCorreo(e.target.value); setHasError(false); }}
              />
            </div>

            <div className={styles.grupoInput}>
              <label className={`${styles.label} ${hasError ? styles.labelError : ''}`}>
                Contraseña
              </label>
              <input 
                type="password" 
                className={`${styles.input} ${hasError ? styles.inputError : ''}`}
                placeholder="********"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setHasError(false); }}
              />
            </div>

            {hasError && (
              <div className={styles.mensajeError}>
                ¡Incorrecta vuelva a intentar!
              </div>
            )}

            <button 
              type="submit" 
              className={`${styles.botonLogin} ${hasError ? styles.botonLoginError : ''}`}
            >
              Iniciar sesión
            </button>

          </form>

          <div className={styles.textosAyuda}>
            <span className={styles.ayudaTextoPrincipal}>Acceso exclusivo para personal autorizado del área de banco de sangre</span>
            <span className={styles.ayudaTextoSecundario}>Recuerde cambiar sus contraseñas de acceso</span>
          </div>

        </div>
      </div>

    </div>
  );
}