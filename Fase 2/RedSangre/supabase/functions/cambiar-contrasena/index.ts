// Comentarios - Cambiar contraseña desde Configuración
// Edge Function con la que un administrador activo (con código TOTP) fija una contraseña nueva a otro usuario,
// que deberá cambiarla en su próximo ingreso.
// Usa la service role porque Auth solo permite cambiar contraseñas ajenas con la API de administración.
import { verificarAdministrador } from '../_shared/administrador.ts';
import { auditarAdmin } from '../_shared/auditoria.ts';
import { clienteAdmin, clienteUsuario } from '../_shared/clientes.ts';
import { conCors } from '../_shared/cors.ts';
import { responder, revisarMetodo } from '../_shared/respuesta.ts';
import { esUuid, validarContrasena } from '../_shared/validaciones.ts';

Deno.serve(conCors(async (req) => {
  const respuestaMetodo = revisarMetodo(req);
  if (respuestaMetodo) return respuestaMetodo;

  // Comentarios - Cambiar contraseña desde Configuración
  // 1. Verifica que quien llama sea un administrador activo con la sesión en aal2.
  const verificacion = await verificarAdministrador(req, 'cambiar contraseñas');
  if ('respuesta' in verificacion) return verificacion.respuesta;

  // Comentarios - Cambiar contraseña desde Configuración
  // 2. Lee los parámetros y repite la política de contraseña del formulario.
  let usuarioId: unknown;
  let nuevaContrasena: unknown;
  try {
    ({ usuario_id: usuarioId, nueva_contrasena: nuevaContrasena } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  if (!usuarioId || !nuevaContrasena) return responder({ error: 'Faltan parámetros' }, 400);
  // Comentarios - Validación de entrada en las Edge Functions
  // El id debe ser un UUID y la contraseña un texto, antes de consultar la base o Auth
  if (!esUuid(usuarioId) || typeof nuevaContrasena !== 'string') {
    return responder({ error: 'Parámetros inválidos' }, 400);
  }
  const errorPolitica = validarContrasena(nuevaContrasena);
  if (errorPolitica) return responder({ error: errorPolitica }, 422);

  // Comentarios - Cambiar contraseña desde Configuración
  // 3. Comprueba que el usuario exista en el sistema: no se cambian contraseñas de cuentas de Auth sin perfil.
  const supabaseAdmin = clienteAdmin();
  const { data: destino, error: errDestino } = await supabaseAdmin
    .from('usuario')
    .select('id')
    .eq('id', usuarioId)
    .maybeSingle();
  if (errDestino || !destino) return responder({ error: 'Usuario no encontrado' }, 404);

  // Comentarios - Cambiar contraseña desde Configuración
  // 4. Cambia la contraseña con el cliente de administración.
  const { error: errCambio } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, {
    password: nuevaContrasena,
  });

  if (errCambio) {
    console.error('Error al cambiar contraseña:', errCambio);
    return responder({ error: 'No se pudo actualizar la contraseña' }, 500);
  }

  // Comentarios - Contraseña fijada por el administrador
  // 5. Si la contraseña es de otra persona, el administrador la conoce: se obliga a cambiarla en el próximo ingreso
  //    y se cierran sus sesiones abiertas (por si el cambio fue por una cuenta comprometida). El flag se marca con la
  //    sesión del administrador, así el trigger de auditoría registra quién lo hizo. Si es su propia contraseña, no aplica.
  const esPropia = usuarioId === verificacion.usuarioId;
  let sesionesRevocadas: number | null = null;
  if (!esPropia) {
    const { error: errFlag } = await clienteUsuario(req)
      .from('usuario')
      .update({ debe_cambiar_password: true })
      .eq('id', usuarioId);
    if (errFlag) {
      console.error('No se pudo marcar debe_cambiar_password:', errFlag.message);
      return responder({ error: 'La contraseña se cambió, pero no se pudo exigir que el usuario la cambie al ingresar. Inténtalo nuevamente.' }, 500);
    }

    const { data: revocadas, error: errRevocar } = await supabaseAdmin.rpc('fn_revocar_sesiones', { p_usuario_id: usuarioId });
    if (errRevocar) console.error('No se pudieron cerrar las sesiones del usuario:', errRevocar.message);
    else sesionesRevocadas = revocadas as number;
  }

  // Comentarios - Bitácora completa
  // Registra qué administrador cambió la contraseña y de qué usuario (la contraseña nunca se guarda),
  // y si se exigió el cambio y cuántas sesiones se cerraron.
  await auditarAdmin(req, verificacion.usuarioId, 'CAMBIAR_CONTRASENA', {
    tabla: 'usuario',
    registroId: usuarioId,
    detalle: { propia: esPropia, sesiones_revocadas: sesionesRevocadas },
  });

  return responder({ ok: true, debe_cambiar_password: !esPropia });
}));
