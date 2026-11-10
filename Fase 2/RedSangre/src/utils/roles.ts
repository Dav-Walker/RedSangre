// Comentarios - Roles de usuario
// Texto que se muestra en pantalla para cada valor del enum rol_usuario.
import type { RolUsuario } from '../tipos/dominio';

export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  administrador: 'Administrador',
  tecnologo: 'Tecnólogo',
  tens: 'TENS',
};

// Comentarios - Perfil TENS solo lectura
// Indica si el rol puede crear o editar datos. Es la misma regla que fn_puede_escribir en la base.
export const ROLES_CON_ESCRITURA: RolUsuario[] = ['administrador', 'tecnologo'];

export function puedeEditar(rol: RolUsuario | undefined): boolean {
  return !!rol && ROLES_CON_ESCRITURA.includes(rol);
}
