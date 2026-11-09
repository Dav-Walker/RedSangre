// Comentarios - Mensajes de Supabase Auth en español
// Supabase Auth responde en inglés. Traduce los códigos de error más comunes del login y del cambio de contraseña;
// si el código no se conoce, devuelve el mensaje por defecto en vez del texto original en inglés.
import { MENSAJE_POLITICA_CONTRASENA } from './politicaContrasena';

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
