// Comentarios - Manejo de errores y excepciones
// Pantalla completa de error con título, mensaje y botones. La usan el ErrorBoundary y la carga del perfil.
import styles from './PantallaError.module.css';

export interface AccionPantallaError {
  texto: string;
  onClick: () => void;
  principal?: boolean;
}

interface PantallaErrorProps {
  titulo: string;
  mensaje: string;
  acciones: AccionPantallaError[];
}

export function PantallaError({ titulo, mensaje, acciones }: PantallaErrorProps) {
  return (
    <div className={styles.contenedor}>
      <div className={styles.tarjeta} role="alert">
        <h1 className={styles.titulo}>{titulo}</h1>
        <p className={styles.mensaje}>{mensaje}</p>
        <div className={styles.acciones}>
          {acciones.map((accion) => (
            <button
              key={accion.texto}
              type="button"
              className={accion.principal ? styles.botonPrincipal : styles.botonSecundario}
              onClick={accion.onClick}
            >
              {accion.texto}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
