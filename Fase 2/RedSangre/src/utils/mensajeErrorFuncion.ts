// Comentarios - Mensajes de error de Edge Functions
// Cuando una función responde con error (4xx/5xx), supabase-js no entrega el cuerpo en data: hay que leerlo del error.
// Devuelve el mensaje que envió la función, o el mensaje por defecto si no hay uno.
import { FunctionsHttpError } from '@supabase/supabase-js';

export async function leerMensajeError(error: unknown, mensajePorDefecto: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const cuerpo = await error.context.json().catch(() => null);
    if (cuerpo?.error) return cuerpo.error;
  }
  return mensajePorDefecto;
}
