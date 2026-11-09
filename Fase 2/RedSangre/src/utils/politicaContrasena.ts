// Comentarios - Seguridad de contraseñas
// La política de contraseña vive en una sola copia, compartida con las Edge Functions crear-usuario y cambiar-contrasena.
export { MENSAJE_POLITICA_CONTRASENA, validarContrasena } from '../../supabase/functions/_shared/validaciones.ts';
