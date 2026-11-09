// Comentarios - Activación de cuenta por correo
// Pantalla pública a la que llega la persona desde el enlace del correo. Al pulsar el botón se valida el token y se abre
// la sesión; después la aplicación le pide definir su contraseña (CambiarContrasenaPage).
// La activación se hace con un botón y no al cargar la página, porque algunos correos abren los enlaces por su cuenta
// y gastarían el token de un solo uso.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import styles from './ActivarCuentaPage.module.css';

export function ActivarCuentaPage() {
  const [parametros] = useSearchParams();
  const tokenHash = parametros.get('token_hash');
  const tipo = parametros.get('type') === 'recovery' ? 'recovery' : 'invite';
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comentarios - Activación de cuenta por correo
  // Valida el token con Auth. Si es correcto, la sesión queda abierta y la aplicación continúa sola.
  const handleActivar = async () => {
    if (!tokenHash || activando) return;

    setActivando(true);
    setError(null);
    const { error: errorToken } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (errorToken) {
      setError('El enlace no es válido o ya venció. Pide al administrador que te envíe uno nuevo.');
      setActivando(false);
    }
  };

  return (
    <div className={styles.contenedor}>
      <div className={styles.tarjeta}>
        <h1 className={styles.titulo}>Activa tu cuenta</h1>

        {tokenHash ? (
          <>
            <p className={styles.texto}>
              Confirma que este correo es tuyo para activar tu cuenta en RedSangre. Después definirás tu contraseña.
            </p>
            {error && <p className={styles.mensajeError} role="alert">{error}</p>}
            <button className={styles.boton} onClick={handleActivar} disabled={activando}>
              {activando ? 'Activando...' : 'Activar mi cuenta'}
            </button>
          </>
        ) : (
          <p className={styles.mensajeError} role="alert">
            El enlace está incompleto. Abre el enlace completo del correo o pide al administrador que te envíe uno nuevo.
          </p>
        )}
      </div>
    </div>
  );
}
