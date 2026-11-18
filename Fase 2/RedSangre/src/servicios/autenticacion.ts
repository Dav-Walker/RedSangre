// Comentarios - Activación de cuenta por correo
// Valida el token de un solo uso del enlace de activación. Si es correcto, Supabase abre la sesión y la
// aplicación continúa sola (pide definir la contraseña). Devuelve un mensaje de error o null.
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { MENSAJE_SIN_CONEXION } from '../utils/mensajesError';

export async function activarCuenta(tokenHash: string, tipo: 'invite' | 'recovery'): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  if (!error) return null;
  // Comentarios - Manejo de errores y excepciones
  // Sin conexión el enlace sigue sirviendo: se pide reintentar en vez de decir que venció.
  if (isAuthRetryableFetchError(error)) return MENSAJE_SIN_CONEXION;
  return 'El enlace no es válido o ya venció. Pide al administrador que te envíe uno nuevo.';
}
