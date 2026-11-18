// Comentarios - Servicio de usuarios
// Consultas de usuarios, presencia en línea y llamadas a las Edge Functions de administración (crear usuario,
// cambiar contraseña, reenviar activación). Las escrituras devuelven un mensaje de error o null si todo salió bien.
import { supabase } from '../utils/supabase';
import { leerMensajeError } from '../utils/mensajeErrorFuncion';
import { avisarSesionExpirada, MENSAJE_SESION_EXPIRADA, mensajeError } from '../utils/mensajesError';
import { registrarEvento, registrarRechazo } from './auditoria';
import type { RolUsuario, Usuario } from '../tipos/dominio';

// Comentarios - Lista de usuarios
// Columnas de usuario que muestran la tabla de Configuración y sus modales.
export type UsuarioFila = Pick<Usuario, 'id' | 'nombre' | 'apellido' | 'correo' | 'rol' | 'activo'
  | 'debe_cambiar_password' | 'created_at'>;

export async function listarUsuarios(): Promise<UsuarioFila[] | null> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre, apellido, correo, rol, activo, debe_cambiar_password, created_at')
    .order('nombre');
  return error ? null : data;
}

// Comentarios - Última conexión
// Fecha del último inicio de sesión registrado en auditoría, o null si nunca ingresó.
// Se consulta por usuario: una sola consulta para todos podría dejar fuera a quien no ingresa hace tiempo,
// porque la API limita la cantidad de filas que devuelve.
// Comentarios - Manejo de errores y excepciones
// Si la consulta falla devuelve 'no_disponible', para no mostrar "Sin conexiones registradas" como dato real.
export async function consultarUltimaConexion(usuarioId: string): Promise<string | null | 'no_disponible'> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('fecha')
    .eq('usuario_id', usuarioId)
    .eq('accion', 'LOGIN')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return 'no_disponible';
  return data?.fecha ?? null;
}

// Comentarios - Presencia en línea
// Se une al canal privado de presencia de un usuario y avisa cada vez que cambia si está conectado.
// Devuelve la función que cierra el canal (para el cleanup del useEffect).
// Comentarios - Manejo de errores y excepciones
// Si el canal falla o no responde avisa null (estado desconocido), para no mostrar al usuario como desconectado.
export function escucharPresencia(usuarioId: string, alCambiar: (conectado: boolean | null) => void): () => void {
  const canal = supabase.channel(`presencia:${usuarioId}`, { config: { private: true } });
  canal
    .on('presence', { event: 'sync' }, () => {
      alCambiar(Object.keys(canal.presenceState()).length > 0);
    })
    .subscribe((estado) => {
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') alCambiar(null);
    });
  return () => { void supabase.removeChannel(canal); };
}

// Comentarios - Desactivar usuario
// Marca al usuario como activo o inactivo. La base impide dejar el sistema sin administradores activos.
export async function cambiarEstadoUsuario(usuarioId: string, activo: boolean): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuario')
    .update({ activo })
    .eq('id', usuarioId)
    .select('id');
  if (error) {
    registrarRechazo(activo ? 'activar_usuario' : 'desactivar_usuario', error.code, usuarioId);
    // Comentarios - Manejo de errores y excepciones
    // RS006 al desactivar es la regla de "al menos un administrador activo"; al activar, que solo un administrador
    // puede modificar a otros usuarios.
    return mensajeError(error, 'No se pudo cambiar el estado del usuario. Inténtalo nuevamente.', {
      RS006: activo
        ? 'Solo un administrador puede cambiar el estado de otros usuarios.'
        : 'No puedes desactivar al último administrador activo.',
      '42501': 'No tienes permiso para cambiar el estado de usuarios.',
    });
  }
  // Comentarios - Manejo de errores y excepciones
  // Si RLS no deja modificar, la base no da error: no actualiza filas. Se avisa en vez de dar el cambio por hecho.
  if (!data || data.length === 0) return 'No se pudo cambiar el estado del usuario: no tienes permiso o ya no existe.';
  return null;
}

// Comentarios - Bitácora completa
// Abrir el detalle de un usuario en Configuración queda registrado (muestra su correo y su estado)
export function registrarVistaUsuario(usuarioId: string): void {
  void registrarEvento('VER_USUARIO', { tabla: 'usuario', registroId: usuarioId });
}

// Comentarios - Edge Functions de administración
// Llama a una Edge Function con el token de la sesión actual. Si la función responde con error,
// devuelve el mensaje que envió; si no, el mensaje por defecto.
async function invocarFuncionAdmin<T>(
  nombre: string,
  cuerpo: Record<string, unknown>,
  mensajePorDefecto: string,
): Promise<{ datos: T | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  // Comentarios - Manejo de errores y excepciones
  // Sin sesión no se llama a la función (iría "Bearer undefined"): se avisa que la sesión expiró.
  if (!session) {
    avisarSesionExpirada();
    return { datos: null, error: MENSAJE_SESION_EXPIRADA };
  }
  const { data, error } = await supabase.functions.invoke(nombre, {
    body: cuerpo,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error || !data?.ok) return { datos: null, error: await leerMensajeError(error, mensajePorDefecto) };
  return { datos: data as T, error: null };
}

// Comentarios - Crear usuario desde Configuración
// Crea la cuenta y envía el correo de activación. correoEnviado es false si la cuenta quedó creada pero el correo falló.
export async function crearUsuario(datos: {
  nombre: string;
  apellido: string;
  correo: string;
  rol: RolUsuario;
}): Promise<{ usuario: UsuarioFila; correoEnviado: boolean } | { error: string }> {
  const { datos: respuesta, error } = await invocarFuncionAdmin<{ usuario: UsuarioFila; correo_enviado?: boolean }>(
    'crear-usuario',
    datos,
    'No se pudo crear el usuario. Intenta nuevamente.',
  );
  if (error || !respuesta) return { error: error ?? 'No se pudo crear el usuario. Intenta nuevamente.' };
  return { usuario: respuesta.usuario, correoEnviado: respuesta.correo_enviado !== false };
}

// Comentarios - Cambiar contraseña desde Configuración
export async function cambiarContrasenaUsuario(usuarioId: string, nuevaContrasena: string): Promise<string | null> {
  const { error } = await invocarFuncionAdmin(
    'cambiar-contrasena',
    { usuario_id: usuarioId, nueva_contrasena: nuevaContrasena },
    'No se pudo actualizar la contraseña. Intenta nuevamente.',
  );
  return error;
}

// Comentarios - Activación de cuenta por correo
// Pide a la Edge Function reenviar-activacion que envíe un enlace nuevo al correo del usuario pendiente.
export async function reenviarActivacion(usuarioId: string): Promise<string | null> {
  const { error } = await invocarFuncionAdmin(
    'reenviar-activacion',
    { usuario_id: usuarioId },
    'No se pudo reenviar el correo. Intenta nuevamente.',
  );
  return error;
}
