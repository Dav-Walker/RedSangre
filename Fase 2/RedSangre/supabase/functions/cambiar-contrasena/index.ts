import { createClient } from 'npm:@supabase/supabase-js@2';

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comentarios - Seguridad de contraseñas
// Misma política que crear-usuario y el frontend: mínimo 8 caracteres con letra, número y un carácter especial (el punto cuenta).
const MENSAJE_POLITICA = 'La contraseña debe tener al menos 8 caracteres, una letra, un número y un carácter especial (por ejemplo, un punto).';

function cumplePoliticaContrasena(contrasena: string): boolean {
  return contrasena.length >= 8
    && /[a-zA-Z]/.test(contrasena)
    && /\d/.test(contrasena)
    && /[^a-zA-Z0-9]/.test(contrasena);
}

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
  if (perfil.rol !== 'administrador') return responder({ error: 'Solo administradores pueden cambiar contraseñas' }, 403);

  // 2. Leer parámetros
  let usuarioId: string | undefined;
  let nuevaContrasena: string | undefined;
  try {
    ({ usuario_id: usuarioId, nueva_contrasena: nuevaContrasena } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  if (!usuarioId || !nuevaContrasena) return responder({ error: 'Faltan parámetros' }, 400);
  if (!cumplePoliticaContrasena(nuevaContrasena)) return responder({ error: MENSAJE_POLITICA }, 422);

  // 3. Cambiar la contraseña usando el cliente admin (service role)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: errCambio } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, {
    password: nuevaContrasena,
  });

  if (errCambio) {
    console.error('Error al cambiar contraseña:', errCambio);
    return responder({ error: 'No se pudo actualizar la contraseña' }, 500);
  }

  return responder({ ok: true });
});
