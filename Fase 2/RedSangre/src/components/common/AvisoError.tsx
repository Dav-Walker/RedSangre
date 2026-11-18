// Comentarios - Manejo de errores y excepciones
// Aviso de error de carga con botón "Reintentar". Lo usan las páginas cuando no pudieron leer sus datos.
import styles from './AvisoError.module.css';

interface AvisoErrorProps {
  mensaje: string;
  onReintentar?: () => void;
}

export function AvisoError({ mensaje, onReintentar }: AvisoErrorProps) {
  return (
    <div className={styles.aviso} role="alert">
      <p className={styles.texto}>{mensaje}</p>
      {onReintentar && (
        <button type="button" className={styles.boton} onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
