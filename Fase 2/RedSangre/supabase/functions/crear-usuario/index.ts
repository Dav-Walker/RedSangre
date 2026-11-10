// Comentarios - Crear usuario desde Configuración
// Edge Function que crea una cuenta nueva (Auth + perfil) sin contraseña y envía un correo de activación.
// La persona define su propia contraseña desde el enlace. Solo la puede usar un administrador activo.
import { enviarCorreoActivacion, generarEnlace } from '../_shared/activacion.ts';
import { verificarAdministrador } from '../_shared/administrador.ts';
import { clienteAdmin, type ClienteSupabase } from '../_shared/clientes.ts';
import { conCors } from '../_shared/cors.ts';
import { responder, revisarMetodo } from '../_shared/respuesta.ts';
import { correoCanonico, validarCorreo } from '../_shared/validaciones.ts';

// Comentarios - Perfil TENS solo lectura
// Roles que el administrador puede asignar al crear una cuenta, incluido TENS
const ROLES_VALIDOS = ['administrador', 'tecnologo', 'tens'];

// Comentarios - Crear usuario
// Deshace una creación a medias: primero el perfil (la clave foránea lo exige) y luego la cuenta de Auth.
async function deshacerCreacion(supabaseAdmin: ClienteSupabase, id: string) {
  await supabaseAdmin.from('usuario').delete().eq('id', id);
  await supabaseAdmin.auth.admin.deleteUser(id);
}

Deno.serve(conCors(async (req) => {
  const respuestaMetodo = revisarMetodo(req);
  if (respuestaMetodo) return respuestaMetodo;

  // Comentarios - Crear usuario
  // 1. Verifica que quien llama sea un administrador activo con la sesión en aal2.
  const verificacion = await verificarAdministrador(req, 'crear usuarios');
  if ('respuesta' in verificacion) return verificacion.respuesta;

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

  if (!nombre || !apellido || !correo || !rol) {
    return responder({ error: 'Faltan parámetros' }, 400);
  }
  const errorCorreo = validarCorreo(correo);
  if (errorCorreo) return responder({ error: errorCorreo }, 422);
  if (!ROLES_VALIDOS.includes(rol)) return responder({ error: 'El rol no es válido' }, 422);

  // Comentarios - Validar correo duplicado y correo real (RF-07)
  // Busca duplicados entre todos los usuarios del mismo dominio, activos o desactivados, con la forma canónica.
  const supabaseAdmin = clienteAdmin();

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

  // Comentarios - Crear usuario
  // 3. Crea la cuenta sin contraseña y sin confirmar, y obtiene el enlace de activación.
  //    El trigger de la base genera el perfil.
  const enlace = await generarEnlace(supabaseAdmin, correo, 'invite', { nombre, apellido });
  if ('error' in enlace) {
    console.error('Error al crear usuario:', enlace.error);
    if (/already|registered|exists/i.test(enlace.error)) {
      return responder({ error: 'Ya existe un usuario con ese correo.' }, 409);
    }
    return responder({ error: 'No se pudo crear el usuario' }, 500);
  }

  // Comentarios - Crear usuario
  // 4. Confirma que el trigger creó el perfil. Si no, deshace la cuenta para no dejar usuarios huérfanos en Auth.
  const columnasUsuario = 'id, nombre, apellido, correo, rol, activo, debe_cambiar_password, created_at';
  const { data: perfilCreado, error: errUsuario } = await supabaseAdmin
    .from('usuario')
    .select(columnasUsuario)
    .eq('id', enlace.usuarioId)
    .maybeSingle();

  if (errUsuario || !perfilCreado) {
    console.error('El perfil no se creó para', enlace.usuarioId, errUsuario?.message);
    await deshacerCreacion(supabaseAdmin, enlace.usuarioId);
    return responder({ error: 'No se pudo crear el perfil del usuario' }, 500);
  }

  // Comentarios - Crear usuario
  // 5. El trigger deja el perfil como tecnólogo e inactivo (Auth no entrega el rol al insertar). Se fija aquí el rol
  //    pedido, se activa la cuenta y se marca que la persona aún debe definir su contraseña.
  //    Solo esta función activa cuentas nuevas: un registro hecho por fuera nace sin permisos.
  const { data: usuarioNuevo, error: errRol } = await supabaseAdmin
    .from('usuario')
    .update({ rol, activo: true, debe_cambiar_password: true })
    .eq('id', enlace.usuarioId)
    .select(columnasUsuario)
    .single();

  if (errRol || !usuarioNuevo) {
    console.error('No se pudo asignar el rol a', enlace.usuarioId, errRol?.message);
    await deshacerCreacion(supabaseAdmin, enlace.usuarioId);
    return responder({ error: 'No se pudo asignar el rol del usuario' }, 500);
  }

  // Comentarios - Crear usuario
  // 6. Envía el correo de activación. Si el envío falla, la cuenta queda creada y pendiente: el administrador
  //    puede reenviarlo desde Configuración.
  let correoEnviado = true;
  try {
    await enviarCorreoActivacion(correo, nombre, enlace.enlace);
  } catch (errorEnvio) {
    console.error('No se pudo enviar el correo de activación:', errorEnvio);
    correoEnviado = false;
  }

  return responder({ ok: true, usuario: usuarioNuevo, correo_enviado: correoEnviado }, 201);
}));
