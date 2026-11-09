// Comentarios - Segundo factor TOTP (RF-36)
// Pantalla que reemplaza a toda la aplicación mientras la sesión no tenga el segundo factor (aal2).
// Si el usuario ya vinculó su app autenticadora, pide el código de 6 dígitos; si no, lo guía para vincularla con un QR.
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import type { ConfiguracionDosPasos } from '../../contexts/auth-context';
import styles from './VerificacionDosPasosPage.module.css';

type Etapa = 'cargando' | 'verificar' | 'introduccion' | 'escanear' | 'errorCarga';

const LARGO_CODIGO = 6;

export function VerificacionDosPasosPage() {
  const { user, signOut, obtenerFactorDosPasos, configurarDosPasos, verificarDosPasos } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>('cargando');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDosPasos | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Comentarios - Segundo factor TOTP (RF-36)
  // Al abrir la pantalla consulta si el usuario ya tiene una app vinculada para decidir qué etapa mostrar
  useEffect(() => {
    let cancelado = false;

    obtenerFactorDosPasos().then((resultado) => {
      if (cancelado) return;
      if (resultado.error) {
        setError(resultado.error);
        setEtapa('errorCarga');
        return;
      }
      setFactorId(resultado.factorId);
      setEtapa(resultado.factorId ? 'verificar' : 'introduccion');
    });

    return () => {
      cancelado = true;
    };
  }, [obtenerFactorDosPasos]);

  // Comentarios - Segundo factor TOTP (RF-36)
  // Pide a Supabase un QR nuevo para vincular la app autenticadora
  const handleGenerarQr = async () => {
    if (procesando) return;

    setProcesando(true);
    setError(null);
    const resultado = await configurarDosPasos();
    setProcesando(false);

    if (resultado.error || !resultado.datos) {
      setError(resultado.error ?? 'No se pudo generar el código QR.');
      return;
    }
    setConfiguracion(resultado.datos);
    setEtapa('escanear');
  };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Valida el código. Si es correcto la aplicación se desbloquea sola; si no, se limpia el campo para reintentar.
  const handleVerificar = async (e: React.FormEvent) => {
    e.preventDefault();
    const idFactor = configuracion?.factorId ?? factorId;
    if (procesando || !idFactor || codigo.length !== LARGO_CODIGO) return;

    setProcesando(true);
    setError(null);
    const errorVerificacion = await verificarDosPasos(idFactor, codigo);

    if (errorVerificacion) {
      setError(errorVerificacion);
      setCodigo('');
      setProcesando(false);
    }
  };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Muestra la clave en grupos de 4 caracteres para que sea más fácil escribirla a mano en la app
  const secretoLegible = configuracion?.secreto.match(/.{1,4}/g)?.join(' ') ?? '';

  const campoCodigo = (
    <form className={styles.formCodigo} onSubmit={handleVerificar} noValidate>
      <label className={styles.label} htmlFor="codigo-dos-pasos">Código de 6 dígitos</label>
      <input
        id="codigo-dos-pasos"
        className={`${styles.inputCodigo} ${error ? styles.inputError : ''}`}
        value={codigo}
        onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, LARGO_CODIGO)); setError(null); }}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        autoFocus
      />

      {error && <p className={styles.mensajeError} role="alert">{error}</p>}

      <div className={styles.acciones}>
        <button type="button" className={styles.botonSecundario} onClick={() => signOut()} disabled={procesando}>
          Cerrar sesión
        </button>
        <button type="submit" className={styles.botonPrimario} disabled={procesando || codigo.length !== LARGO_CODIGO}>
          {procesando ? 'Verificando...' : 'Verificar'}
        </button>
      </div>
    </form>
  );

  return (
    <div className={styles.contenedor}>
      <div className={styles.tarjeta}>
        <h1 className={styles.titulo}>Verificación en dos pasos</h1>

        {etapa === 'cargando' && <p className={styles.texto} role="status">Revisando tu configuración...</p>}

        {etapa === 'errorCarga' && (
          <>
            {error && <p className={styles.mensajeError} role="alert">{error}</p>}
            <div className={styles.acciones}>
              <button type="button" className={styles.botonSecundario} onClick={() => signOut()}>
                Cerrar sesión
              </button>
            </div>
          </>
        )}

        {etapa === 'verificar' && (
          <>
            <p className={styles.texto}>
              {user?.nombre ? `${user.nombre}, abre` : 'Abre'} tu app autenticadora (por ejemplo, Microsoft Authenticator)
              e ingresa el código que aparece en <strong>RedSangre</strong>.
            </p>
            {campoCodigo}
          </>
        )}

        {etapa === 'introduccion' && (
          <>
            <p className={styles.texto}>
              Para proteger los datos de los donantes, RedSangre exige un segundo paso al iniciar sesión: un código
              de 6 dígitos que genera una app en tu celular.
            </p>
            <p className={styles.texto}>
              Instala <strong>Microsoft Authenticator</strong> o <strong>Google Authenticator</strong> y luego
              pulsa <strong>Configurar ahora</strong>. Solo se hace una vez.
            </p>
            {error && <p className={styles.mensajeError} role="alert">{error}</p>}
            <div className={styles.acciones}>
              <button type="button" className={styles.botonSecundario} onClick={() => signOut()} disabled={procesando}>
                Cerrar sesión
              </button>
              <button type="button" className={styles.botonPrimario} onClick={handleGenerarQr} disabled={procesando}>
                {procesando ? 'Generando...' : 'Configurar ahora'}
              </button>
            </div>
          </>
        )}

        {etapa === 'escanear' && configuracion && (
          <>
            <ol className={styles.pasos}>
              <li>Abre <strong>Microsoft Authenticator</strong> en tu celular.</li>
              <li>Toca <strong>+</strong> y elige <strong>Otra cuenta (Google, Facebook, etc.)</strong>.</li>
              <li>Escanea este código QR.</li>
              <li>Ingresa abajo el código de 6 dígitos que aparece en <strong>RedSangre</strong>.</li>
            </ol>

            <img className={styles.qr} src={configuracion.qr} alt="Código QR para vincular la app autenticadora" />

            <details className={styles.claveManual}>
              <summary>¿No puedes escanear el código?</summary>
              <p className={styles.textoPequeno}>En la app elige ingresar la clave manualmente y escribe:</p>
              <code className={styles.clave}>{secretoLegible}</code>
            </details>

            <p className={styles.textoPequeno}>
              Si antes escaneaste otro código de RedSangre que no llegaste a confirmar, bórralo de la app: ya no sirve.
            </p>

            {campoCodigo}
          </>
        )}
      </div>
    </div>
  );
}
