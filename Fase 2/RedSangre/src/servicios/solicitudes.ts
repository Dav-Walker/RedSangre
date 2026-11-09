// Comentarios - Servicio de solicitudes
// Consultas y escrituras de solicitudes, búsqueda de candidatos y bitácora de contacto. Las páginas no llaman a
// Supabase directamente. Las escrituras devuelven un mensaje de error o null si todo salió bien.
import { supabase } from '../utils/supabase';
import { leerMensajeError } from '../utils/mensajeErrorFuncion';
import type { Donante, EstadoSolicitudBase, GrupoSanguineo, ResultadoContacto, Solicitud, Urgencia } from '../tipos/dominio';

// Comentarios - Listado de solicitudes
// Solicitud con el donante asignado (relación donante_asignado_id).
export type SolicitudFila = Solicitud & {
  donante: Pick<Donante, 'codigo_donante' | 'nombre' | 'apellido'> | null;
};

// Comentarios - Listado de solicitudes
// Ordena en la base: primero por estado y luego por urgencia, en el orden de sus enums
// (abierta, en proceso, cerrada / alta, media, baja), y dentro de eso las más recientes primero.
export async function listarSolicitudes(): Promise<{ solicitudes: SolicitudFila[]; error: string | null }> {
  const { data, error } = await supabase
    .from('solicitud')
    .select('*, donante:donante_asignado_id (codigo_donante, nombre, apellido)')
    .order('estado')
    .order('urgencia')
    .order('created_at', { ascending: false });
  if (error) return { solicitudes: [], error: 'Error al cargar las solicitudes: ' + error.message };
  return { solicitudes: data ?? [], error: null };
}

// Comentarios - Búsqueda de candidatos
// Fila que devuelve fn_buscar_donantes_compatibles. Los tipos generados no marcan los campos que pueden
// venir vacíos (donante sin fenotipo, sin donaciones o sin ubicación), así que se declaran aquí.
export interface Candidato {
  prioridad: number;
  donante_id: string;
  codigo_donante: string;
  nombre_completo: string;
  grupo_sanguineo: GrupoSanguineo;
  fenotipo: string | null;
  fecha_ultima_donacion: string | null;
  meses_desde_ultima_donacion: number | null;
  disponible: boolean;
  puede_contactarse: boolean;
  asignado_activo: boolean;
  apto: boolean;
  distancia_km: number | null;
  compatibilidad: 'exacta' | 'compatible';
}

// Comentarios - Búsqueda de candidatos
// Candidatos compatibles ya priorizados por la base. La función excluye a los donantes bloqueados por reacción adversa.
export async function buscarCandidatos(
  grupo: GrupoSanguineo,
  fenotipo: string,
): Promise<{ candidatos: Candidato[]; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_buscar_donantes_compatibles', {
    p_grupo_requerido: grupo,
    p_fenotipo_requerido: fenotipo.trim() || undefined,
    p_limite: 20,
  });
  if (error) return { candidatos: [], error: 'Error al buscar candidatos: ' + error.message };
  return { candidatos: (data ?? []) as Candidato[], error: null };
}

// Comentarios - Crear solicitud
// Crea la solicitud con el candidato elegido. El trigger fn_validar_solicitud vuelve a revisar compatibilidad y disponibilidad.
export async function crearSolicitud(datos: {
  grupo: GrupoSanguineo;
  fenotipo: string;
  urgencia: Urgencia;
  donanteId: string;
}): Promise<string | null> {
  const { error } = await supabase.from('solicitud').insert({
    grupo_sanguineo_requerido: datos.grupo,
    fenotipo_requerido: datos.fenotipo.trim() || null,
    urgencia: datos.urgencia,
    estado: 'abierta',
    donante_asignado_id: datos.donanteId,
  });
  return error ? 'Error al crear la solicitud: ' + error.message : null;
}

// Comentarios - Detalle de solicitud
// Solicitud con los datos de contacto del donante asignado.
export type SolicitudConDonante = Solicitud & {
  donante: Pick<Donante, 'id' | 'rut' | 'nombre' | 'apellido' | 'correo' | 'telefono'> | null;
};

const COLUMNAS_DETALLE = '*, donante:donante_asignado_id (id, rut, nombre, apellido, correo, telefono)';

// Comentarios - Detalle de solicitud
// La ruta usa el código de la solicitud (S2026002); si no se encuentra, se intenta con el id (solicitudes sin código).
export async function obtenerSolicitud(idOCodigo: string): Promise<SolicitudConDonante | null> {
  const porCodigo = await supabase
    .from('solicitud')
    .select(COLUMNAS_DETALLE)
    .eq('codigo_solicitud', idOCodigo)
    .maybeSingle();
  if (porCodigo.data) return porCodigo.data;
  if (porCodigo.error) return null;

  const porId = await supabase
    .from('solicitud')
    .select(COLUMNAS_DETALLE)
    .eq('id', idOCodigo)
    .maybeSingle();
  return porId.data ?? null;
}

// Comentarios - Cambiar estado de solicitud
// Cambia el estado si la solicitud no está cerrada. yaCerrada indica que otra persona la cerró antes.
// Al cerrar, la fecha de cierre la completa la base (fn_validar_solicitud).
export async function cambiarEstadoSolicitud(
  solicitudId: string,
  estado: EstadoSolicitudBase,
): Promise<{ error: string | null; yaCerrada: boolean }> {
  const { data, error } = await supabase
    .from('solicitud')
    .update({ estado })
    .eq('id', solicitudId)
    .neq('estado', 'cerrada')
    .select('id');
  if (error) return { error: 'No se pudo cambiar el estado: ' + error.message, yaCerrada: false };
  if (!data || data.length === 0) return { error: 'La solicitud ya está cerrada y no puede modificarse.', yaCerrada: true };
  return { error: null, yaCerrada: false };
}

// Comentarios - Bitácora de contacto
// Resultado del último contacto registrado por un canal, o null si aún no hay ninguno.
export async function consultarUltimoContacto(
  solicitudId: string,
  canal: 'correo' | 'whatsapp',
): Promise<ResultadoContacto | null> {
  const { data } = await supabase
    .from('seguimiento_contacto')
    .select('resultado')
    .eq('solicitud_id', solicitudId)
    .eq('canal', canal)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.resultado ?? null;
}

// Comentarios - Contactar donante por correo
// La Edge Function envía el correo y lo registra en la bitácora.
export async function enviarCorreoContacto(solicitudId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('enviar-correo-contacto', {
    body: { solicitud_id: solicitudId },
  });
  if (error) return leerMensajeError(error, 'No se pudo enviar el correo.');
  return data?.error ?? null;
}

// Comentarios - Contactar donante por WhatsApp
// Registra en la bitácora que se abrió WhatsApp con el mensaje para el donante. Los triggers aplican las
// mismas reglas que al correo: la solicitud no puede estar cerrada (RS005) y el donante debe autorizar contacto (RS002).
export async function registrarContactoWhatsapp(solicitudId: string, donanteId: string): Promise<string | null> {
  const { error } = await supabase.from('seguimiento_contacto').insert({
    solicitud_id: solicitudId,
    donante_id: donanteId,
    canal: 'whatsapp',
    resultado: 'enviado',
  });
  return error ? error.message : null;
}
