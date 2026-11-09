// Comentarios - Paginación de tablas
// Barra bajo las tablas: selector de cuántas filas mostrar, "Página X de Y" y botones primera, anterior,
// siguiente y última. La usan Donantes, Solicitudes y Nueva solicitud para que las tres tablas se vean igual.
import styles from './Paginacion.module.css';

interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  opciones: number[];
  onCambiarPagina: (pagina: number) => void;
  // Al cambiar la cantidad por página, la página debe volver a 1 (lo hace quien usa el componente).
  onCambiarPorPagina: (cantidad: number) => void;
}

export function Paginacion({ pagina, totalPaginas, porPagina, opciones, onCambiarPagina, onCambiarPorPagina }: PaginacionProps) {
  const esPrimera = pagina <= 1;
  const esUltima = pagina >= totalPaginas;

  return (
    <div className={styles.paginacion}>
      <div className={styles.porPagina}>
        <span>Mostrar</span>
        <select
          value={porPagina}
          onChange={(e) => onCambiarPorPagina(Number(e.target.value))}
          className={styles.selectPorPagina}
          aria-label="Filas por página"
        >
          {opciones.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>por página</span>
      </div>

      <span className={styles.textoPagina}>
        Página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong>
      </span>

      <div className={styles.botonesPagina}>
        <button type="button" className={styles.botonPaginacion} onClick={() => onCambiarPagina(1)} disabled={esPrimera} aria-label="Primera página">«</button>
        <button type="button" className={styles.botonPaginacion} onClick={() => onCambiarPagina(pagina - 1)} disabled={esPrimera}>‹ Anterior</button>
        <button type="button" className={styles.botonPaginacion} onClick={() => onCambiarPagina(pagina + 1)} disabled={esUltima}>Siguiente ›</button>
        <button type="button" className={styles.botonPaginacion} onClick={() => onCambiarPagina(totalPaginas)} disabled={esUltima} aria-label="Última página">»</button>
      </div>
    </div>
  );
}
