// Comentarios - Verificar administrador activo
// Comprueba que quien llama esté autenticado, haya completado el código TOTP (aal2) y sea un administrador activo.
// La usan crear-usuario, reenviar-activacion y cambiar-contrasena. Si no cumple, devuelve la respuesta de error lista.
import { clienteUsuario } from './clientes.ts';
import { MENSAJE_SIN_DOS_PASOS, tieneDosPasos } from './dosPasos.ts';
import { responder } from './respuesta.ts';

export async function verificarAdministrador(
  req: Request,
  accion: string,
): Promise<{ usuarioId: string } | { respuesta: Response }> {
  const supabaseUsuario = clienteUsuario(req);

  const { data: { user: usuarioActual }, error: errAuth } = await supabaseUsuario.auth.getUser();
  if (errAuth || !usuarioActual) return { respuesta: responder({ error: 'No autenticado' }, 401) };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Un administrador sin el código TOTP (sesión aal1) no puede hacer acciones de administración.
  if (!tieneDosPasos(req)) return { respuesta: responder({ error: MENSAJE_SIN_DOS_PASOS }, 403) };

  const { data: perfil, error: errPerfil } = await supabaseUsuario
    .from('usuario')
    .select('rol, activo')
    .eq('id', usuarioActual.id)
    .maybeSingle();

  if (errPerfil || !perfil) return { respuesta: responder({ error: 'No se pudo verificar el rol' }, 403) };
  if (perfil.rol !== 'administrador' || !perfil.activo) {
    return { respuesta: responder({ error: `Solo administradores activos pueden ${accion}` }, 403) };
  }

  return { usuarioId: usuarioActual.id };
}
