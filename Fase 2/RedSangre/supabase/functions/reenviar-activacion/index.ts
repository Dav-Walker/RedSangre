// Comentarios - Activación de cuenta por correo
// Edge Function que reenvía el correo de activación a un usuario que aún no define su contraseña.
// Solo la puede usar un administrador activo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { enviarCorreoActivacion, generarEnlace } from '../_shared/activacion.ts';
import { cabeceras, conCors } from '../_shared/cors.ts';
import { MENSAJE_SIN_DOS_PASOS, tieneDosPasos } from '../_shared/dosPasos.ts';


function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cabeceras(), 'Content-Type': 'application/json' },
  });
}

Deno.serve(conCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras() });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  // Comentarios - Activación de cuenta por correo
  // 1. Verifica con el token de la sesión que quien llama es un administrador autenticado y activo.
  const supabaseUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );

  const { data: { user: usuarioActual }, error: errAuth } = await supabaseUsuario.auth.getUser();
  if (errAuth || !usuarioActual) return responder({ error: 'No autenticado' }, 401);
  // Comentarios - Segundo factor TOTP (RF-36)
  // Un administrador sin el código TOTP (sesión aal1) no puede reenviar activaciones
  if (!tieneDosPasos(req)) return responder({ error: MENSAJE_SIN_DOS_PASOS }, 403);

  const { data: perfil, error: errPerfil } = await supabaseUsuario
    .from('usuario')
    .select('rol, activo')
    .eq('id', usuarioActual.id)
    .maybeSingle();

  if (errPerfil || !perfil) return responder({ error: 'No se pudo verificar el rol' }, 403);
  if (perfil.rol !== 'administrador' || !perfil.activo) {
    return responder({ error: 'Solo administradores activos pueden reenviar activaciones' }, 403);
  }

  // Comentarios - Activación de cuenta por correo
  // 2. Lee el usuario al que se reenvía y comprueba que realmente esté pendiente y activo.
  let usuarioId: string | undefined;
  try {
    ({ usuario_id: usuarioId } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }
  if (!usuarioId) return responder({ error: 'Falta el parámetro usuario_id' }, 400);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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

  return responder({ ok: true });
}));
