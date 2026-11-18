// Comentarios - Manejo de errores y excepciones
// Envuelve la descarga de una página diferida (lazy). Después de un despliegue, quien tenga la aplicación abierta
// pide archivos que ya no existen: se recarga la página una vez para tomar la versión nueva. Si vuelve a fallar
// (por ejemplo, sin conexión), se lanza ErrorCargaPagina y el ErrorBoundary muestra el aviso.
const CLAVE_RECARGA = 'redsangre:recarga-por-version';
const VENTANA_RECARGA_MS = 10_000;

export class ErrorCargaPagina extends Error {
  constructor() {
    super('No se pudo cargar la página');
    this.name = 'ErrorCargaPagina';
  }
}

// Comentarios - Manejo de errores y excepciones
// Indica si ya se recargó hace poco por este motivo (evita recargar en bucle). El almacenamiento puede no estar
// disponible (modo privado o bloqueado): en ese caso no se recarga y se muestra el aviso.
function recargoHacePoco(): boolean {
  try {
    const marca = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
    return Date.now() - marca < VENTANA_RECARGA_MS;
  } catch {
    return true;
  }
}

function marcarRecarga(): void {
  try {
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    // Comentarios - Manejo de errores y excepciones
    // Sin almacenamiento no se puede marcar; recargoHacePoco ya devuelve true en ese caso
  }
}

export function cargarPagina<T>(importar: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await importar();
    } catch {
      if (!recargoHacePoco()) {
        marcarRecarga();
        window.location.reload();
        // Comentarios - Manejo de errores y excepciones
        // La promesa queda pendiente mientras el navegador recarga, así no se alcanza a mostrar el aviso
        return new Promise<T>(() => {});
      }
      throw new ErrorCargaPagina();
    }
  };
}
