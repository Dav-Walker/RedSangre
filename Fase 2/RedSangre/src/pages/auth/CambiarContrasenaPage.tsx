// Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
// Pantalla que reemplaza a toda la aplicación mientras el usuario tenga una contraseña temporal.
import { useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { validarContrasena } from '../../utils/politicaContrasena';
import styles from './CambiarContrasenaPage.module.css';

export function CambiarContrasenaPage() {
  const { user, completarCambioContrasena, signOut } = useAuth();
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
  // Valida la política y que ambas contraseñas coincidan, y luego cambia la contraseña. Al terminar, la app se desbloquea sola.
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;

    const errorPolitica = validarContrasena(nueva);
    if (errorPolitica) return setError(errorPolitica);
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden.');

    setGuardando(true);
    const errorCambio = await completarCambioContrasena(nueva);
    setGuardando(false);

    if (errorCambio) setError(errorCambio);
  };

  return (
    <div className={styles.contenedor}>
      <form className={styles.tarjeta} onSubmit={handleGuardar} noValidate>
        <h1 className={styles.titulo}>Crea tu contraseña</h1>
        <p className={styles.texto}>
          {user?.nombre}, ingresaste con una contraseña temporal. Para continuar debes definir una contraseña personal.
        </p>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="nueva-contrasena">Nueva contraseña</label>
          <input
            id="nueva-contrasena"
            type="password"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={nueva}
            onChange={(e) => { setNueva(e.target.value); setError(null); }}
            placeholder="Mínimo 8, con número y símbolo (ej. un punto)"
            autoComplete="new-password"
          />
        </div>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="confirmar-nueva-contrasena">Confirmar contraseña</label>
          <input
            id="confirmar-nueva-contrasena"
            type="password"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={confirmar}
            onChange={(e) => { setConfirmar(e.target.value); setError(null); }}
            placeholder="Repite la nueva contraseña"
            autoComplete="new-password"
          />
        </div>

        {error && <p className={styles.mensajeError} role="alert">{error}</p>}

        <div className={styles.acciones}>
          <button type="button" className={styles.botonSecundario} onClick={() => signOut()} disabled={guardando}>
            Cerrar sesión
          </button>
          <button type="submit" className={styles.botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}
