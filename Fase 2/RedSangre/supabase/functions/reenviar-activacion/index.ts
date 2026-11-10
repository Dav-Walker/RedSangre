// Comentarios - Activación de cuenta por correo
// Edge Function que reenvía el correo de activación a un usuario que aún no define su contraseña.
// Solo la puede usar un administrador activo.
import { enviarCorreoActivacion, generarEnlace } from '../_shared/activacion.ts';
import { verificarAdministrador } from '../_shared/administrador.ts';
import { auditarAdmin } from '../_shared/auditoria.ts';
import { clienteAdmin } from '../_shared/clientes.ts';
import { conCors } from '../_shared/cors.ts';
import { responder, revisarMetodo } from '../_shared/respuesta.ts';

Deno.serve(conCors(async (req) => {
  const respuestaMetodo = revisarMetodo(req);
  if (respuestaMetodo) return respuestaMetodo;

  // Comentarios - Activación de cuenta por correo
  // 1. Verifica que quien llama sea un administrador activo con la sesión en aal2.
  const verificacion = await verificarAdministrador(req, 'reenviar activaciones');
  if ('respuesta' in verificacion) return verificacion.respuesta;

  // Comentarios - Activación de cuenta por correo
  // 2. Lee el usuario al que se reenvía y comprueba que realmente esté pendiente y activo.
  let usuarioId: string | undefined;
  try {
    ({ usuario_id: usuarioId } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }
  if (!usuarioId) return responder({ error: 'Falta el parámetro usuario_id' }, 400);

  const supabaseAdmin = clienteAdmin();

  const { data: destino, error: errDestino } = await supabaseAdmin
    .from('usuario')
    .select('correo, nombre, activo, debe_cambiar_password')
    .eq('id', usuarioId)
    .maybeSingle();

  if (errDestino || !destino) return responder({ error: 'Usuario no encontrado' }, 404);
  if (!destino.activo) return responder({ error: 'El usuario está desactivado: reactívalo antes de reenviar la activación' }, 409);
  if (!destino.debe_cambiar_password) return responder({ error: 'El usuario ya activó su cuenta' }, 409);

  // Comentarios - Activación de cuenta por correo
  // 3. Si la persona nunca abrió el primer enlace, se genera una invitación nueva. Si ya confirmó su correo pero no
  //    llegó a definir la contraseña, se genera un enlace de recuperación.
  const { data: usuarioAuth, error: errAuthUsuario } = await supabaseAdmin.auth.admin.getUserById(usuarioId);
  if (errAuthUsuario || !usuarioAuth?.user) return responder({ error: 'No se encontró la cuenta de acceso' }, 404);

  const tipo = usuarioAuth.user.email_confirmed_at ? 'recovery' : 'invite';
  const enlace = await generarEnlace(supabaseAdmin, destino.correo, tipo);
  if ('error' in enlace) {
    console.error('Error al generar el enlace de activación:', enlace.error);
    return responder({ error: 'No se pudo generar el enlace de activación' }, 500);
  }

  try {
    await enviarCorreoActivacion(destino.correo, destino.nombre, enlace.enlace);
  } catch (errorEnvio) {
    console.error('No se pudo reenviar el correo de activación:', errorEnvio);
    return responder({ error: 'No se pudo enviar el correo' }, 502);
  }

  // Comentarios - Bitácora completa
  // Registra qué administrador reenvió la activación, a qué usuario y con qué tipo de enlace.
  await auditarAdmin(req, verificacion.usuarioId, 'REENVIAR_ACTIVACION', {
    tabla: 'usuario',
    registroId: usuarioId,
    detalle: { tipo },
  });

  return responder({ ok: true });
}));
