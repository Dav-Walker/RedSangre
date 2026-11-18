// Comentarios - Mensajes de Supabase Auth en español
// Supabase Auth responde en inglés. Traduce los códigos de error más comunes del login y del cambio de contraseña;
// si el código no se conoce, devuelve el mensaje por defecto en vez del texto original en inglés.
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { MENSAJE_POLITICA_CONTRASENA } from './politicaContrasena';
import { MENSAJE_SIN_CONEXION } from './mensajesError';

const MENSAJES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Tu cuenta aún no está activada. Usa el enlace del correo de activación.',
  user_banned: 'Tu cuenta está bloqueada. Contacta al administrador.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  captcha_failed: 'No se pudo verificar el captcha. Inténtalo nuevamente.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  weak_password: MENSAJE_POLITICA_CONTRASENA,
};

export function traducirErrorAuth(codigo: string | undefined, mensajePorDefecto: string): string {
  return (codigo && MENSAJES[codigo]) || mensajePorDefecto;
}

// Comentarios - Manejo de errores y excepciones
// Igual que traducirErrorAuth, pero recibe el error completo para reconocer también la falta de conexión
// (Auth la informa como AuthRetryableFetchError, sin código).
export function mensajeErrorAuth(error: unknown, mensajePorDefecto: string): string {
  if (isAuthRetryableFetchError(error)) return MENSAJE_SIN_CONEXION;
  const codigo = (error as { code?: string } | null)?.code;
  return traducirErrorAuth(codigo, mensajePorDefecto);
}
