// Comentarios - Validar correo duplicado y correo real (RF-07)
// Las reglas de correo de usuarios viven en una sola copia, compartida con la Edge Function crear-usuario.
export {
  DOMINIOS_PERMITIDOS,
  MENSAJE_DOMINIO,
  correoCanonico,
  validarCorreo,
} from '../../supabase/functions/_shared/validaciones.ts';

// Comentarios - Validar correo de donante
// Formato básico de correo (algo@dominio.ext) para los donantes, que pueden usar cualquier dominio.
export function tieneFormatoCorreo(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}
