// Comentarios - Crear usuario desde Configuración
// Edge Function que crea una cuenta nueva (Auth + perfil). Solo la puede usar un administrador activo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLES_VALIDOS = ['administrador', 'tecnologo'];
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Comentarios - Seguridad de contraseñas
// Política de contraseña: mínimo 8 caracteres con letra, número y un carácter especial (el punto cuenta).
// Es la misma que valida el frontend; se repite aquí porque el formulario no es de confianza.
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

// Comentarios - Crear usuario
// Deshace una creación a medias: primero el perfil (la clave foránea lo exige) y luego la cuenta de Auth.
async function deshacerCreacion(supabaseAdmin: ReturnType<typeof createClient>, id: string) {
  await supabaseAdmin.from('usuario').delete().eq('id', id);
  await supabaseAdmin.auth.admin.deleteUser(id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  // Comentarios - Crear usuario
  // 1. Verifica con el token de la sesión que quien llama es un administrador autenticado y activo.
  const supabaseUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );

  const { data: { user: usuarioActual }, error: errAuth } = await supabaseUsuario.auth.getUser();
  if (errAuth || !usuarioActual) return responder({ error: 'No autenticado' }, 401);

  const { data: perfil, error: errPerfil } = await supabaseUsuario
    .from('usuario')
    .select('rol, activo')
    .eq('id', usuarioActual.id)
    .maybeSingle();

  if (errPerfil || !perfil) return responder({ error: 'No se pudo verificar el rol' }, 403);
  if (perfil.rol !== 'administrador' || !perfil.activo) {
    return responder({ error: 'Solo administradores activos pueden crear usuarios' }, 403);
  }

  // Comentarios - Crear usuario
  // 2. Lee y valida los datos recibidos. La validación del formulario no se confía: se repite aquí.
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
  const apellido = typeof cuerpo.apellido === 'string' ? cuerpo.apellido.trim() : '';
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : '';
  const rol = typeof cuerpo.rol === 'string' ? cuerpo.rol : '';
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';

  if (!nombre || !apellido || !correo || !rol || !contrasena) {
    return responder({ error: 'Faltan parámetros' }, 400);
  }
  if (!FORMATO_CORREO.test(correo)) return responder({ error: 'El correo no tiene un formato válido' }, 422);
  if (!ROLES_VALIDOS.includes(rol)) return responder({ error: 'El rol no es válido' }, 422);
  if (!cumplePoliticaContrasena(contrasena)) return responder({ error: MENSAJE_POLITICA }, 422);

  // Comentarios - Crear usuario
  // 3. Crea la cuenta con el cliente admin (service role). El rol va solo en app_metadata,
  //    que el propio usuario no puede editar. El trigger de la base genera el perfil y la auditoría.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: existente } = await supabaseAdmin
    .from('usuario')
    .select('id')
    .eq('correo', correo)
    .maybeSingle();
  if (existente) return responder({ error: 'Ya existe un usuario con ese correo' }, 409);

  const { data: creado, error: errCrear } = await supabaseAdmin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    app_metadata: { rol, debe_cambiar_password: true, creado_por: usuarioActual.id },
    user_metadata: { nombre, apellido },
  });

  if (errCrear || !creado.user) {
    if (errCrear?.code === 'email_exists') return responder({ error: 'Ya existe un usuario con ese correo' }, 409);
    console.error('Error al crear usuario:', errCrear?.message);
    return responder({ error: 'No se pudo crear el usuario' }, 500);
  }

  // Comentarios - Crear usuario
  // 4. Confirma que el trigger creó el perfil. Si no, deshace la cuenta para no dejar usuarios huérfanos en Auth.
  const columnasUsuario = 'id, nombre, apellido, correo, rol, activo, created_at';
  const { data: perfilCreado, error: errUsuario } = await supabaseAdmin
    .from('usuario')
    .select(columnasUsuario)
    .eq('id', creado.user.id)
    .maybeSingle();

  if (errUsuario || !perfilCreado) {
    console.error('El perfil no se creó para', creado.user.id, errUsuario?.message);
    await deshacerCreacion(supabaseAdmin, creado.user.id);
    return responder({ error: 'No se pudo crear el perfil del usuario' }, 500);
  }

  // Comentarios - Crear usuario
  // 5. Auth guarda app_metadata después de insertar la cuenta, así que el trigger no alcanza a ver el rol
  //    y deja el perfil como tecnólogo. Se fija aquí el rol pedido y se obliga a cambiar la contraseña.
  const { data: usuarioNuevo, error: errRol } = await supabaseAdmin
    .from('usuario')
    .update({ rol, debe_cambiar_password: true })
    .eq('id', creado.user.id)
    .select(columnasUsuario)
    .single();

  if (errRol || !usuarioNuevo) {
    console.error('No se pudo asignar el rol a', creado.user.id, errRol?.message);
    await deshacerCreacion(supabaseAdmin, creado.user.id);
    return responder({ error: 'No se pudo asignar el rol del usuario' }, 500);
  }

  return responder({ ok: true, usuario: usuarioNuevo }, 201);
});
