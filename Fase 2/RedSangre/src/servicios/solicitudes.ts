// Comentarios - Servicio de solicitudes
// Consultas y escrituras de solicitudes, búsqueda de candidatos y bitácora de contacto. Las páginas no llaman a
// Supabase directamente. Las escrituras devuelven un mensaje de error o null si todo salió bien.
import { supabase } from '../utils/supabase';
import { leerMensajeError } from '../utils/mensajeErrorFuncion';
import { valorFiltro } from '../utils/filtrosPostgrest';
import { fechaLocal } from '../utils/fechas';
import { registrarEvento, registrarRechazo } from './auditoria';
import type { Donante, EstadoSolicitudBase, GrupoSanguineo, ResultadoContacto, Solicitud, Urgencia } from '../tipos/dominio';

// Comentarios - Listado de solicitudes
// Solicitud con el donante asignado (relación donante_asignado_id).
export type SolicitudFila = Solicitud & {
  donante: Pick<Donante, 'codigo_donante' | 'nombre' | 'apellido'> | null;
};

// Comentarios - Listado de solicitudes
// Filtros de una consulta del listado y su resultado. La fecha va como 'AAAA-MM-DD' (día local de creación).
export interface FiltrosSolicitudes {
  pagina: number;
  porPagina: number;
  busqueda: string;
  grupo: GrupoSanguineo | '';
  estado: EstadoSolicitudBase | '';
  fecha: string;
}

export interface ResultadoSolicitudes {
  solicitudes: SolicitudFila[];
  total: number;
  error: string | null;
}

// Comentarios - Listado de solicitudes
// Consulta una página de solicitudes con los filtros indicados. Ordena en la base: primero por estado y luego
// por urgencia, en el orden de sus enums (abierta, en proceso, cerrada / alta, media, baja), y dentro de eso
// las más recientes primero. El buscador cubre código y fenotipo; el grupo tiene su propio filtro porque la
// base no permite buscar texto dentro de un enum.
export async function listarSolicitudes(f: FiltrosSolicitudes): Promise<ResultadoSolicitudes> {
  let query = supabase
    .from('solicitud')
    .select('*, donante:donante_asignado_id (codigo_donante, nombre, apellido)', { count: 'exact' })
    .order('estado')
    .order('urgencia')
    .order('created_at', { ascending: false });

  if (f.busqueda) {
    // Comentarios - Búsqueda segura en filtros .or()
    // El texto va entre comillas para que comas o paréntesis escritos por el usuario no rompan el filtro.
    const patron = valorFiltro(`%${f.busqueda}%`);
    query = query.or(`codigo_solicitud.ilike.${patron},fenotipo_requerido.ilike.${patron}`);
  }
  if (f.grupo) query = query.eq('grupo_sanguineo_requerido', f.grupo);
  if (f.estado) query = query.eq('estado', f.estado);
  if (f.fecha) {
    // El día elegido se toma en hora local: desde las 00:00 de ese día hasta las 00:00 del siguiente.
    const desde = fechaLocal(f.fecha);
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 1);
    query = query.gte('created_at', desde.toISOString()).lt('created_at', hasta.toISOString());
  }

  const inicio = (f.pagina - 1) * f.porPagina;
  const { data, error, count } = await query.range(inicio, inicio + f.porPagina - 1);
  if (error) return { solicitudes: [], total: 0, error: 'Error al cargar las solicitudes: ' + error.message };

  // Comentarios - Bitácora completa
  // Registra la consulta con sus filtros; el texto buscado no se guarda, solo si hubo búsqueda por texto
  void registrarEvento('BUSCAR_SOLICITUDES', {
    tabla: 'solicitud',
    detalle: {
      pagina: f.pagina,
      grupo: f.grupo || null,
      estado: f.estado || null,
      fecha: f.fecha || null,
      con_texto: Boolean(f.busqueda),
      resultados: count ?? 0,
    },
  });
  return { solicitudes: data ?? [], total: count ?? 0, error: null };
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
// Candidatos compatibles ya priorizados por la base (como máximo 100, el tope de la función).
// La función excluye a los donantes bloqueados por reacción adversa.
export const MAXIMO_CANDIDATOS = 100;

export async function buscarCandidatos(
  grupo: GrupoSanguineo,
  fenotipo: string,
): Promise<{ candidatos: Candidato[]; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_buscar_donantes_compatibles', {
    p_grupo_requerido: grupo,
    p_fenotipo_requerido: fenotipo.trim() || undefined,
    p_limite: MAXIMO_CANDIDATOS,
  });
  if (error) return { candidatos: [], error: 'Error al buscar candidatos: ' + error.message };

  // Comentarios - Bitácora completa
  // Registra la búsqueda de candidatos: grupo, fenotipo pedido y cuántos donantes devolvió
  void registrarEvento('BUSCAR_CANDIDATOS', {
    tabla: 'donante',
    detalle: { grupo, fenotipo: fenotipo.trim() || null, resultados: data?.length ?? 0 },
  });
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
  if (error) {
    registrarRechazo('crear_solicitud', error.code, datos.donanteId);
    return 'Error al crear la solicitud: ' + error.message;
  }
  return null;
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
  if (porCodigo.data) return conRegistroDeAcceso(porCodigo.data);
  if (porCodigo.error) return null;

  const porId = await supabase
    .from('solicitud')
    .select(COLUMNAS_DETALLE)
    .eq('id', idOCodigo)
    .maybeSingle();
  return porId.data ? conRegistroDeAcceso(porId.data) : null;
}

// Comentarios - Bitácora completa
// Abrir el detalle de una solicitud muestra los datos de contacto del donante: queda registrado quién la vio
function conRegistroDeAcceso(solicitud: SolicitudConDonante): SolicitudConDonante {
  void registrarEvento('VER_SOLICITUD', { tabla: 'solicitud', registroId: solicitud.id });
  return solicitud;
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
  if (error) {
    registrarRechazo('cambiar_estado_solicitud', error.code, solicitudId);
    return { error: 'No se pudo cambiar el estado: ' + error.message, yaCerrada: false };
  }
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
  if (error) {
    registrarRechazo('contactar_whatsapp', error.code, solicitudId);
    return error.message;
  }
  return null;
}
