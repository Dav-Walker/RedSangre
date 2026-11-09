// Comentarios - Roles de usuario
// Texto que se muestra en pantalla para cada valor del enum rol_usuario.
import type { RolUsuario } from '../tipos/dominio';

export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  administrador: 'Administrador',
  tecnologo: 'Tecnólogo',
};
