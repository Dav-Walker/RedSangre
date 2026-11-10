// Comentarios - Verificar administrador activo
// Comprueba que quien llama esté autenticado, haya completado el código TOTP (aal2) y sea un administrador activo.
// La usan crear-usuario, reenviar-activacion y cambiar-contrasena. Si no cumple, devuelve la respuesta de error lista.
import { auditarAdmin } from './auditoria.ts';
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

  // Comentarios - Bitácora completa
  // Un usuario autenticado que intenta una acción de administración sin cumplir los requisitos queda
  // registrado como ACCESO_DENEGADO, con el motivo (sin TOTP, sin perfil o sin rol de administrador).
  const denegar = async (motivo: string, respuesta: Response) => {
    // auth_id identifica a quien lo intentó aunque no tenga perfil en la tabla usuario
    await auditarAdmin(req, usuarioActual.id, 'ACCESO_DENEGADO', { detalle: { accion, motivo, auth_id: usuarioActual.id } });
    return { respuesta };
  };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Un administrador sin el código TOTP (sesión aal1) no puede hacer acciones de administración.
  if (!tieneDosPasos(req)) return denegar('sin_totp', responder({ error: MENSAJE_SIN_DOS_PASOS }, 403));

  const { data: perfil, error: errPerfil } = await supabaseUsuario
    .from('usuario')
    .select('rol, activo')
    .eq('id', usuarioActual.id)
    .maybeSingle();

  if (errPerfil || !perfil) return denegar('sin_perfil', responder({ error: 'No se pudo verificar el rol' }, 403));
  if (perfil.rol !== 'administrador' || !perfil.activo) {
    return denegar('no_es_administrador', responder({ error: `Solo administradores activos pueden ${accion}` }, 403));
  }

  return { usuarioId: usuarioActual.id };
}
