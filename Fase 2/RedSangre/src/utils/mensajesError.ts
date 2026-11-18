// Comentarios - Manejo de errores y excepciones
// Traduce los errores de la base (PostgreSQL y PostgREST) a mensajes en español para la pantalla.
// Regla: nunca se muestra el texto original del error, porque puede incluir nombres de tablas, restricciones,
// funciones o datos. El mensaje se elige por el código del error (o por el nombre de la restricción).

export const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu conexión e inténtalo nuevamente.';
export const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Vuelve a iniciar sesión.';
export const MENSAJE_SIN_PERMISO = 'No tienes permiso para realizar esta acción.';
export const MENSAJE_SERVICIO_NO_DISPONIBLE = 'El servicio no está disponible en este momento. Inténtalo en unos minutos.';
export const MENSAJE_ERROR_INESPERADO = 'Ocurrió un error inesperado. Inténtalo nuevamente.';

// Comentarios - Manejo de errores y excepciones
// Evento que avisa al proveedor de sesión que la base rechazó el token: la sesión se cierra y se vuelve al login.
export const EVENTO_SESION_EXPIRADA = 'redsangre:sesion-expirada';

// Comentarios - Manejo de errores y excepciones
// Forma mínima de un error de Supabase (PostgrestError y similares). Solo se leen el código y el mensaje,
// y el mensaje se usa únicamente para reconocer el nombre de la restricción, nunca para mostrarlo.
export interface ErrorSupabase {
  code?: string | null;
  message?: string | null;
}

// Comentarios - Manejo de errores y excepciones
// Mensajes por código de error. Los RS00x son las reglas de negocio de la base (ver esquema.sql).
const MENSAJES_POR_CODIGO: Record<string, string> = {
  RS001: 'Debe registrar el consentimiento de tratamiento de datos y la autorización de contacto.',
  RS002: 'El donante no autorizó ser contactado.',
  RS003: 'El donante no está disponible: donó recientemente o tiene otra solicitud activa.',
  RS004: 'El donante no es compatible con el grupo o fenotipo requerido.',
  RS005: 'La solicitud está cerrada y no admite cambios.',
  RS006: 'Esta operación no está permitida.',
  RS007: 'Revisa los datos ingresados: hay datos inválidos o incompletos.',
  RS008: 'Se alcanzó el límite de envíos. Inténtalo más tarde.',
  '42501': MENSAJE_SIN_PERMISO,
  '57014': 'La operación tardó demasiado. Inténtalo nuevamente.',
  '23505': 'Ya existe un registro con esos datos.',
  '23514': 'Uno de los datos no tiene el formato correcto.',
  '23503': 'Uno de los datos relacionados no existe.',
  '23502': 'Faltan datos obligatorios.',
  '22001': 'Uno de los datos es demasiado largo.',
  '22P02': 'Uno de los datos no tiene el formato correcto.',
  '22007': 'Una de las fechas no es válida.',
  '22008': 'Una de las fechas no es válida.',
  PGRST103: 'La página solicitada ya no existe.',
};

// Comentarios - Manejo de errores y excepciones
// Códigos de PostgREST que indican que el token ya no es válido (vencido o revocado).
const CODIGOS_SESION = ['PGRST301', 'PGRST302', 'PGRST303'];

// Comentarios - Manejo de errores y excepciones
// Indica si el error es una falla de red: la petición no llegó al servidor (sin internet, servidor caído o cancelada).
// supabase-js deja esos errores sin código y con un mensaje como "TypeError: Failed to fetch".
export function esErrorDeRed(error: ErrorSupabase | null | undefined): boolean {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return !error.code && /^(TypeError|FetchError|AbortError)\b/.test(error.message ?? '');
}

// Comentarios - Manejo de errores y excepciones
// Indica si la base rechazó la petición porque la sesión ya no es válida.
export function esSesionExpirada(error: ErrorSupabase | null | undefined): boolean {
  if (!error) return false;
  return CODIGOS_SESION.includes(error.code ?? '') || /\bJWT\b/i.test(error.message ?? '');
}

// Comentarios - Manejo de errores y excepciones
// Avisa a la aplicación que la sesión expiró. El proveedor de sesión la cierra y muestra el aviso en el login.
export function avisarSesionExpirada(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
}

// Comentarios - Manejo de errores y excepciones
// Nombre de la restricción que rechazó el dato (único, check o clave foránea), o null si el error no la trae.
export function restriccionDelError(error: ErrorSupabase | null | undefined): string | null {
  const coincidencia = /constraint "([^"]+)"/.exec(error?.message ?? '');
  return coincidencia ? coincidencia[1] : null;
}

// Comentarios - Manejo de errores y excepciones
// Devuelve el mensaje para mostrar. Orden: mensaje propio de la operación para la restricción o el código,
// luego sin conexión y sesión expirada, luego el mensaje general del código y, al final, el mensaje por defecto.
// "especificos" usa como clave el nombre de la restricción (por ejemplo "donante_rut_key") o el código ("RS007").
export function mensajeError(
  error: ErrorSupabase | null | undefined,
  porDefecto: string,
  especificos: Record<string, string> = {},
): string {
  if (!error) return porDefecto;

  const restriccion = restriccionDelError(error);
  if (restriccion && especificos[restriccion]) return especificos[restriccion];

  if (esErrorDeRed(error)) return MENSAJE_SIN_CONEXION;
  if (esSesionExpirada(error)) {
    avisarSesionExpirada();
    return MENSAJE_SESION_EXPIRADA;
  }

  const codigo = error.code ?? '';
  if (especificos[codigo]) return especificos[codigo];
  if (MENSAJES_POR_CODIGO[codigo]) return MENSAJES_POR_CODIGO[codigo];
  if (codigo.startsWith('PGRST0') || codigo.startsWith('08') || codigo.startsWith('53')) return MENSAJE_SERVICIO_NO_DISPONIBLE;
  return porDefecto;
}
