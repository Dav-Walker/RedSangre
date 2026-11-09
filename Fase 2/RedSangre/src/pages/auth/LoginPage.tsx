import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import styles from './LoginPage.module.css';
import { useAuth } from '../../contexts/useAuth';
// Importamos el nuevo logo que acabas de guardar
import logoIndisa from '../../assets/cl_nica_indisa_logo_2.jpg';

// Comentarios - Captcha en inicio de sesión
// Site key pública de Cloudflare Turnstile; si no está definida, el login se muestra sin captcha
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, configured, sesionExpirada } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Comentarios - Captcha en inicio de sesión
  // Guarda el token vigente del captcha y la referencia al widget para pedir uno nuevo
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(null);
  const faltaCaptcha = Boolean(turnstileSiteKey) && !captchaToken;

  // Comentarios - Captcha en inicio de sesión
  // Cada token sirve una sola vez: tras un intento fallido se descarta y el widget genera otro
  const reiniciarCaptcha = () => {
    setCaptchaToken(null);
    captchaRef.current?.reset();
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const error = await signIn(correo.trim(), password, captchaToken ?? undefined);

      if (error) {
        setErrorMessage(error);
        reiniciarCaptcha();
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
      reiniciarCaptcha();
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

          {/* Comentarios - Límite de sesión de 1 hora */}
          {/* Avisa que la sesión anterior se cerró por tiempo; se oculta si aparece otro error */}
          {sesionExpirada && !errorMessage && (
            <div className={styles.mensajeAviso} role="status">
              Tu sesión expiró después de 1 hora. Vuelve a iniciar sesión.
            </div>
          )}

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

            {/* Comentarios - Captcha en inicio de sesión */}
            {/* Widget de Cloudflare Turnstile; entrega el token que se envía junto con el correo y la contraseña */}
            {turnstileSiteKey && (
              <div className={styles.captcha}>
                <Turnstile
                  ref={captchaRef}
                  siteKey={turnstileSiteKey}
                  options={{ language: 'es', theme: 'light', size: 'flexible' }}
                  onSuccess={setCaptchaToken}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => {
                    setCaptchaToken(null);
                    setErrorMessage('No se pudo cargar la verificación de seguridad. Recarga la página.');
                  }}
                />
              </div>
            )}

            {errorMessage && (
              <div className={styles.mensajeError} role="alert">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className={`${styles.botonLogin} ${errorMessage ? styles.botonLoginError : ''}`}
              disabled={isSubmitting || !configured || faltaCaptcha}
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