// Comentarios - Crear usuario desde Configuración
// Edge Function que crea una cuenta nueva (Auth + perfil). Solo la puede usar un administrador activo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLES_VALIDOS = ['administrador', 'tecnologo'];

// Comentarios - Validar correo duplicado y correo real (RF-07)
// Solo se aceptan correos de estos dominios; con eso quedan bloqueados los dominios inventados y los desechables.
const DOMINIOS_PERMITIDOS = ['gmail.com', 'duocuc.cl', 'indisa.cl'];
const MENSAJE_DOMINIO = 'Solo se permiten correos @gmail.com, @duocuc.cl o @indisa.cl.';
const MENSAJE_FORMATO = 'El correo no tiene un formato válido';
const FORMATO_LOCAL = /^[a-z0-9]+(?:[._+-][a-z0-9]+)*$/;

// Devuelve el mensaje de error si el correo (ya en minúsculas y sin espacios) no es válido, o null si está bien.
function validarCorreo(correo: string): string | null {
  if (correo.length > 254) return MENSAJE_FORMATO;
  const partes = correo.split('@');
  if (partes.length !== 2) return MENSAJE_FORMATO;
  const [local, dominio] = partes;
  if (local.length > 64 || !FORMATO_LOCAL.test(local)) return MENSAJE_FORMATO;
  if (!DOMINIOS_PERMITIDOS.includes(dominio)) return MENSAJE_DOMINIO;
  return null;
}

// Forma única de un correo para detectar duplicados. Gmail ignora los puntos y lo que va después de "+",
// así que j.perez+x@gmail.com y jperez@gmail.com son el mismo buzón.
function correoCanonico(correo: string): string {
  const [local, dominio] = correo.split('@');
  if (dominio !== 'gmail.com') return `${local}@${dominio}`;
  return `${local.split('+')[0].replace(/\./g, '')}@${dominio}`;
}

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
  const errorCorreo = validarCorreo(correo);
  if (errorCorreo) return responder({ error: errorCorreo }, 422);
  if (!ROLES_VALIDOS.includes(rol)) return responder({ error: 'El rol no es válido' }, 422);
  if (!cumplePoliticaContrasena(contrasena)) return responder({ error: MENSAJE_POLITICA }, 422);

  // Comentarios - Crear usuario
  // 3. Crea la cuenta con el cliente admin (service role). El rol va solo en app_metadata,
  //    que el propio usuario no puede editar. El trigger de la base genera el perfil y la auditoría.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Comentarios - Validar correo duplicado y correo real (RF-07)
  // Busca duplicados entre todos los usuarios del mismo dominio, activos o desactivados, con la forma canónica.
  const dominioCorreo = correo.split('@')[1];
  const { data: delDominio, error: errBusqueda } = await supabaseAdmin
    .from('usuario')
    .select('correo, activo')
    .ilike('correo', `%@${dominioCorreo}`);
  if (errBusqueda) {
    console.error('Error al buscar correos duplicados:', errBusqueda.message);
    return responder({ error: 'No se pudo verificar si el correo ya existe' }, 500);
  }

  const existente = delDominio?.find((u) => correoCanonico(u.correo) === correoCanonico(correo));
  if (existente) {
    const equivalente = existente.correo === correo ? '' : ` (equivale a ${existente.correo})`;
    const desactivado = existente.activo ? '' : ' El usuario está desactivado: reactívalo desde la lista de usuarios.';
    return responder({ error: `Ya existe un usuario con ese correo${equivalente}.${desactivado}` }, 409);
  }

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
