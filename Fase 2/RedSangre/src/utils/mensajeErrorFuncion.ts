// Comentarios - Mensajes de error de Edge Functions
// Cuando una función responde con error (4xx/5xx), supabase-js no entrega el cuerpo en data: hay que leerlo del error.
// Devuelve el mensaje que envió la función, o el mensaje por defecto si no hay uno.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import {
  avisarSesionExpirada,
  MENSAJE_SERVICIO_NO_DISPONIBLE,
  MENSAJE_SESION_EXPIRADA,
  MENSAJE_SIN_CONEXION,
} from './mensajesError';

export async function leerMensajeError(error: unknown, mensajePorDefecto: string): Promise<string> {
  // Comentarios - Manejo de errores y excepciones
  // Sin conexión: la petición no llegó a la función. Error del relay: la plataforma no pudo ejecutarla.
  if (error instanceof FunctionsFetchError) return MENSAJE_SIN_CONEXION;
  if (error instanceof FunctionsRelayError) return MENSAJE_SERVICIO_NO_DISPONIBLE;

  if (error instanceof FunctionsHttpError) {
    const cuerpo = await error.context.json().catch(() => null);
    // Comentarios - Manejo de errores y excepciones
    // Las funciones propias siempre responden { error: "mensaje en español" }. Las respuestas de la plataforma
    // (por ejemplo "Invalid JWT") traen otro formato: esas no se muestran y se decide por el estado HTTP.
    if (typeof cuerpo?.error === 'string' && error.context.status !== 401) return cuerpo.error;
    if (error.context.status === 401) {
      avisarSesionExpirada();
      return MENSAJE_SESION_EXPIRADA;
    }
    if (error.context.status >= 500) return MENSAJE_SERVICIO_NO_DISPONIBLE;
  }
  return mensajePorDefecto;
}
