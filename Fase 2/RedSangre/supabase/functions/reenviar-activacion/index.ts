// Comentarios - Activación de cuenta por correo
// Edge Function que reenvía el correo de activación a un usuario que aún no define su contraseña.
// Solo la puede usar un administrador activo.
import { enviarCorreoActivacion, generarEnlace } from '../_shared/activacion.ts';
import { verificarAdministrador } from '../_shared/administrador.ts';
import { auditarAdmin } from '../_shared/auditoria.ts';
import { clienteAdmin } from '../_shared/clientes.ts';
import { conCors } from '../_shared/cors.ts';
import { leerCuerpo, MENSAJE_SOLICITUD_INVALIDA, responder, revisarMetodo } from '../_shared/respuesta.ts';
import { esUuid } from '../_shared/validaciones.ts';

Deno.serve(conCors(async (req) => {
  const respuestaMetodo = revisarMetodo(req);
  if (respuestaMetodo) return respuestaMetodo;

  // Comentarios - Activación de cuenta por correo
  // 1. Verifica que quien llama sea un administrador activo con la sesión en aal2.
  const verificacion = await verificarAdministrador(req, 'reenviar activaciones');
  if ('respuesta' in verificacion) return verificacion.respuesta;

  // Comentarios - Activación de cuenta por correo
  // 2. Lee el usuario al que se reenvía y comprueba que realmente esté pendiente y activo.
  // Comentarios - Manejo de errores y excepciones
  // Cuerpo mal formado o incompleto: mensaje para la persona, sin nombrar los parámetros.
  const cuerpo = await leerCuerpo(req);
  const usuarioId = cuerpo?.usuario_id;
  if (!usuarioId) return responder({ error: MENSAJE_SOLICITUD_INVALIDA }, 400);
  // Comentarios - Validación de entrada en las Edge Functions
  // El id debe ser un UUID antes de consultar la base o Auth
  if (!esUuid(usuarioId)) return responder({ error: 'El usuario no es válido.' }, 400);

  const supabaseAdmin = clienteAdmin();

  // Comentarios - Límite de reenvíos de activación
  // RS008 significa que ya se reenvió el máximo de activaciones a este usuario en la última hora
  const { error: errLimite } = await supabaseAdmin.rpc('fn_verificar_limite_reenvio', { p_usuario_id: usuarioId });
  // Comentarios - Manejo de errores y excepciones
  // El texto es fijo: no se reenvía el mensaje de la base al navegador.
  if (errLimite?.code === 'RS008') {
    return responder({ error: 'Ya se reenviaron varias activaciones a este usuario en la última hora. Inténtalo más tarde.' }, 429);
  }
  if (errLimite) return responder({ error: 'No se pudo verificar el límite de reenvíos. Inténtalo nuevamente.' }, 500);

  const { data: destino, error: errDestino } = await supabaseAdmin
    .from('usuario')
    .select('correo, nombre, activo, debe_cambiar_password')
    .eq('id', usuarioId)
    .maybeSingle();

  if (errDestino) {
    console.error('Error al buscar el usuario:', errDestino.message);
    return responder({ error: 'No se pudo verificar el usuario. Inténtalo nuevamente.' }, 500);
  }
  if (!destino) return responder({ error: 'El usuario no existe.' }, 404);
  if (!destino.activo) return responder({ error: 'El usuario está desactivado: reactívalo antes de reenviar la activación.' }, 409);
  if (!destino.debe_cambiar_password) return responder({ error: 'El usuario ya activó su cuenta.' }, 409);

  // Comentarios - Activación de cuenta por correo
  // 3. Si la persona nunca abrió el primer enlace, se genera una invitación nueva. Si ya confirmó su correo pero no
  //    llegó a definir la contraseña, se genera un enlace de recuperación.
  const { data: usuarioAuth, error: errAuthUsuario } = await supabaseAdmin.auth.admin.getUserById(usuarioId);
  if (errAuthUsuario || !usuarioAuth?.user) {
    console.error('No se encontró la cuenta de Auth de', usuarioId, errAuthUsuario?.message);
    return responder({ error: 'La cuenta de acceso de este usuario no está disponible. Contacta al soporte.' }, 404);
  }

  const tipo = usuarioAuth.user.email_confirmed_at ? 'recovery' : 'invite';
  const enlace = await generarEnlace(supabaseAdmin, destino.correo, tipo);
  if ('error' in enlace) {
    console.error('Error al generar el enlace de activación:', enlace.error);
    return responder({ error: 'No se pudo generar el enlace de activación. Inténtalo nuevamente.' }, 500);
  }

  try {
    await enviarCorreoActivacion(destino.correo, destino.nombre, enlace.enlace);
  } catch (errorEnvio) {
    console.error('No se pudo reenviar el correo de activación:', errorEnvio);
    return responder({ error: 'No se pudo enviar el correo. Inténtalo nuevamente.' }, 502);
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
