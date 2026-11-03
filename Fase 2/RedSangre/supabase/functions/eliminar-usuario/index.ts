import { createClient } from 'npm:@supabase/supabase-js@2';

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  // 1. Verificar que quien llama es un administrador autenticado
  const supabaseUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );

  const { data: { user: usuarioActual }, error: errAuth } = await supabaseUsuario.auth.getUser();
  if (errAuth || !usuarioActual) return responder({ error: 'No autenticado' }, 401);

  const { data: perfil, error: errPerfil } = await supabaseUsuario
    .from('usuario')
    .select('rol')
    .eq('id', usuarioActual.id)
    .maybeSingle();

  if (errPerfil || !perfil) return responder({ error: 'No se pudo verificar el rol' }, 403);
  if (perfil.rol !== 'administrador') return responder({ error: 'Solo administradores pueden eliminar usuarios' }, 403);

  // 2. Leer parámetros
  let usuarioId: string | undefined;
  try {
    ({ usuario_id: usuarioId } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  if (!usuarioId) return responder({ error: 'Falta el parámetro usuario_id' }, 400);

  // No permitir que el administrador se elimine a sí mismo
  if (usuarioId === usuarioActual.id) {
    return responder({ error: 'No puedes eliminar tu propio usuario' }, 403);
  }

  // 3. Eliminar usando el cliente admin (service role)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Primero eliminar de la tabla usuario (por si hay FK constraints)
  const { error: errTabla } = await supabaseAdmin
    .from('usuario')
    .delete()
    .eq('id', usuarioId);

  if (errTabla) {
    console.error('Error al eliminar de tabla usuario:', errTabla);
    return responder({ error: 'No se pudo eliminar el usuario' }, 500);
  }

  // Luego eliminar de auth.users
  const { error: errAuth2 } = await supabaseAdmin.auth.admin.deleteUser(usuarioId);

  if (errAuth2) {
    console.error('Error al eliminar de auth:', errAuth2);
    return responder({ error: 'No se pudo eliminar la cuenta de autenticación' }, 500);
  }

  return responder({ ok: true });
});
