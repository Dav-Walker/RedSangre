// Comentarios - Inicio de sesión
// Pantalla de login con correo, contraseña y captcha. Tras validar, la app pide el código TOTP.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import styles from './LoginPage.module.css';
import { useAuth } from '../../contexts/useAuth';
import logoIndisa from '../../assets/cl_nica_indisa_logo_2.jpg';

// Comentarios - Captcha en inicio de sesión
// Site key pública de Cloudflare Turnstile; si no está definida, el login se muestra sin captcha
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, configured, sesionExpirada } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [enviando, setEnviando] = useState(false);
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

    setMensajeError('');
    setEnviando(true);
    try {
      const error = await signIn(correo.trim(), contrasena, captchaToken ?? undefined);

      if (error) {
        setMensajeError(error);
        reiniciarCaptcha();
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMensajeError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
      reiniciarCaptcha();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.contenedorLogin}>
      
      <div className={styles.panelIzquierdo}>
        <div className={styles.espaciador}></div>
        
        <div className={styles.logoContainer}>
          <img src={logoIndisa} alt="Logo Clinica Indisa" className={styles.logoImg} />
        </div>

        <div className={styles.textoInferior}>
          <div className={styles.textoInferiorAzul}>Acceso al sistema interno de gestión de donantes</div>
        </div>
      </div>

      <div className={styles.panelDerecho}>
        <div className={styles.formWrapper}>
          
          <h1 className={styles.tituloApp}>RedSangre</h1>
          <div className={styles.subtituloApp}>Iniciar sesión</div>

          {/* Comentarios - Límite de sesión de 1 hora */}
          {/* Avisa que la sesión anterior se cerró por tiempo; se oculta si aparece otro error */}
          {sesionExpirada && !mensajeError && (
            <div className={styles.mensajeAviso} role="status">
              Tu sesión expiró después de 1 hora. Vuelve a iniciar sesión.
            </div>
          )}

          <form onSubmit={handleLogin} className={styles.formulario}>
            
            <div className={styles.grupoInput}>
              <label className={`${styles.label} ${mensajeError ? styles.labelError : ''}`} htmlFor="correo">
                Correo Institucional
              </label>
              <input 
                id="correo"
                type="email" 
                className={`${styles.input} ${mensajeError ? styles.inputError : ''}`}
                placeholder="nombre.apellido@indisa.cl"
                value={correo}
                onChange={(e) => { setCorreo(e.target.value); setMensajeError(''); }}
                autoComplete="username"
                required
              />
            </div>

            <div className={styles.grupoInput}>
              <label className={`${styles.label} ${mensajeError ? styles.labelError : ''}`} htmlFor="contrasena">
                Contraseña
              </label>
              <input 
                id="contrasena"
                type="password" 
                className={`${styles.input} ${mensajeError ? styles.inputError : ''}`}
                placeholder="********"
                value={contrasena}
                onChange={(e) => { setContrasena(e.target.value); setMensajeError(''); }}
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
                    setMensajeError('No se pudo cargar la verificación de seguridad. Recarga la página.');
                  }}
                />
              </div>
            )}

            {mensajeError && (
              <div className={styles.mensajeError} role="alert">
                {mensajeError}
              </div>
            )}

            <button
              type="submit"
              className={`${styles.botonLogin} ${mensajeError ? styles.botonLoginError : ''}`}
              disabled={enviando || !configured || faltaCaptcha}
            >
              {enviando ? 'Ingresando...' : 'Iniciar sesión'}
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