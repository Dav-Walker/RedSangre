// Comentarios - Activación de cuenta por correo
// Valida el token de un solo uso del enlace de activación. Si es correcto, Supabase abre la sesión y la
// aplicación continúa sola (pide definir la contraseña). Devuelve un mensaje de error o null.
import { supabase } from '../utils/supabase';

export async function activarCuenta(tokenHash: string, tipo: 'invite' | 'recovery'): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  return error ? 'El enlace no es válido o ya venció. Pide al administrador que te envíe uno nuevo.' : null;
}
