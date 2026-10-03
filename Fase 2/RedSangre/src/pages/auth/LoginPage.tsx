import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';
import { useAuth } from '../../contexts/useAuth';
// Importamos el nuevo logo que acabas de guardar
import logoIndisa from '../../assets/cl_nica_indisa_logo_2.jpg';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, configured } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const error = await signIn(correo.trim(), password);

      if (error) {
        setErrorMessage(error);
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
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
              <label className={`${styles.label} ${errorMessage ? styles.labelError : ''}`} htmlFor="correo">
                Correo Institucional
              </label>
              <input 
                id="correo"
                type="email" 
                className={`${styles.input} ${errorMessage ? styles.inputError : ''}`}
                placeholder="nombre.apellido@indisa.cl"
                value={correo}
                onChange={(e) => { setCorreo(e.target.value); setErrorMessage(''); }}
                autoComplete="username"
                required
              />
            </div>

            <div className={styles.grupoInput}>
              <label className={`${styles.label} ${errorMessage ? styles.labelError : ''}`} htmlFor="password">
                Contraseña
              </label>
              <input 
                id="password"
                type="password" 
                className={`${styles.input} ${errorMessage ? styles.inputError : ''}`}
                placeholder="********"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMessage(''); }}
                autoComplete="current-password"
                required
              />
            </div>

            {errorMessage && (
              <div className={styles.mensajeError} role="alert">
                {errorMessage}
              </div>
            )}

            <button 
              type="submit" 
              className={`${styles.botonLogin} ${errorMessage ? styles.botonLoginError : ''}`}
              disabled={isSubmitting || !configured}
            >
              {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
            {!configured && (
              <div className={styles.mensajeError} role="alert">
                Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el archivo .env.
              </div>
            )}

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