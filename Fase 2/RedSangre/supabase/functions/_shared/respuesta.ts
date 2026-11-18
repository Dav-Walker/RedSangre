// Comentarios - Respuestas de las Edge Functions
// Arma una respuesta JSON con las cabeceras CORS de la petición en curso. La usan todas las funciones.
import { cabeceras } from './cors.ts';

// Comentarios - Manejo de errores y excepciones
// Mensajes comunes para peticiones mal formadas o incompletas. Están escritos para la persona que usa la
// aplicación: no nombran parámetros ni detalles internos (eso queda solo en el código).
export const MENSAJE_SOLICITUD_INVALIDA = 'No se pudo procesar la solicitud. Recarga la página e inténtalo nuevamente.';
export const MENSAJE_DATOS_INVALIDOS = 'Los datos enviados no son válidos. Recarga la página e inténtalo nuevamente.';
export const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Vuelve a iniciar sesión.';

export function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cabeceras(), 'Content-Type': 'application/json' },
  });
}

// Comentarios - Respuestas de las Edge Functions
// Responde la consulta previa (OPTIONS) del navegador y rechaza los métodos que no sean POST.
// Devuelve null cuando la petición es un POST y la función debe continuar.
export function revisarMetodo(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras() });
  if (req.method !== 'POST') return responder({ error: 'Operación no permitida.' }, 405);
  return null;
}

// Comentarios - Manejo de errores y excepciones
// Lee el cuerpo JSON de la petición. Devuelve null si no es JSON o no es un objeto (por ejemplo "null" o una lista),
// para responder MENSAJE_SOLICITUD_INVALIDA en vez de fallar al leer sus campos.
export async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo = await req.json();
    return cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : null;
  } catch {
    return null;
  }
}
