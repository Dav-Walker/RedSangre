// Comentarios - Servicio de donantes
// Consultas y escrituras de donantes, consentimientos, etiquetas y donaciones. Las páginas no llaman a Supabase
// directamente: usan estas funciones. Las escrituras devuelven un mensaje de error o null si todo salió bien.
import { supabase } from '../utils/supabase';
import { valorFiltro } from '../utils/filtrosPostgrest';
import { ETIQUETA_FENOTIPO_RARO, ETIQUETA_PLAQUETAS, ETIQUETAS_GENERICAS, esEtiquetaDeColumna } from '../utils/etiquetas';
import type { Database } from '../tipos/database.types';
import type { Donante, GrupoSanguineo, TipoDonacion } from '../tipos/dominio';

// Comentarios - Búsqueda de donantes
// Columnas que muestra el listado, filtros de una consulta y su resultado.
export type DonanteFila = Pick<Donante, 'id' | 'codigo_donante' | 'rut' | 'nombre' | 'apellido' | 'grupo_sanguineo'
  | 'fenotipo' | 'fenotipo_raro' | 'frecuente_plaquetas' | 'fecha_ultima_donacion' | 'observaciones'>;

export interface FiltrosDonantes {
  pagina: number;
  porPagina: number;
  grupo: GrupoSanguineo | '';
  fenotipo: string;
  etiqueta: string;
  busqueda: string;
}

export interface ResultadoDonantes {
  donantes: DonanteFila[];
  total: number;
  error: string | null;
}

const ERROR_LISTADO = 'No se pudieron cargar los donantes.';

// Comentarios - Búsqueda de donantes
// Consulta una página de donantes con los filtros indicados. "Fenotipo raro" y "Plaquetas" son columnas
// booleanas de donante; el resto de las etiquetas están en etiqueta_donante y se filtran por id.
export async function consultarDonantes(f: FiltrosDonantes): Promise<ResultadoDonantes> {
  let idsConEtiqueta: string[] | null = null;
  if (f.etiqueta && !esEtiquetaDeColumna(f.etiqueta)) {
    const { data: etiquetaData, error: errEtiqueta } = await supabase
      .from('etiqueta_donante')
      .select('donante_id')
      .ilike('etiqueta', `%${f.etiqueta}%`);
    if (errEtiqueta) return { donantes: [], total: 0, error: ERROR_LISTADO };
    idsConEtiqueta = (etiquetaData ?? []).map((e) => e.donante_id);
    if (idsConEtiqueta.length === 0) return { donantes: [], total: 0, error: null };
  }

  let query = supabase
    .from('donante')
    .select('id, codigo_donante, rut, nombre, apellido, grupo_sanguineo, fenotipo, fenotipo_raro, frecuente_plaquetas, fecha_ultima_donacion, observaciones', { count: 'exact' })
    .order('codigo_donante', { ascending: false });

  if (f.grupo) query = query.eq('grupo_sanguineo', f.grupo);
  if (f.fenotipo) query = query.ilike('fenotipo', `%${f.fenotipo}%`);
  if (f.busqueda) {
    // Comentarios - Búsqueda segura en filtros .or()
    // El texto va entre comillas para que comas o paréntesis escritos por el usuario no rompan el filtro.
    const patron = valorFiltro(`%${f.busqueda}%`);
    query = query.or(`nombre.ilike.${patron},apellido.ilike.${patron},rut.ilike.${patron}`);
  }
  if (f.etiqueta === ETIQUETA_FENOTIPO_RARO) query = query.eq('fenotipo_raro', true);
  else if (f.etiqueta === ETIQUETA_PLAQUETAS) query = query.eq('frecuente_plaquetas', true);
  else if (idsConEtiqueta !== null) query = query.in('id', idsConEtiqueta);

  const desde = (f.pagina - 1) * f.porPagina;
  const { data, error, count } = await query.range(desde, desde + f.porPagina - 1);
  if (error) return { donantes: [], total: 0, error: ERROR_LISTADO };
  return { donantes: data ?? [], total: count ?? 0, error: null };
}

// Comentarios - Registro atómico de donante
// Guarda donante, consentimiento y etiquetas en una sola transacción con fn_registrar_donante.
export type DatosRegistroDonante = Database['public']['Functions']['fn_registrar_donante']['Args'];

export async function registrarDonante(datos: DatosRegistroDonante): Promise<string | null> {
  const { error } = await supabase.rpc('fn_registrar_donante', datos);
  return error ? 'Error al guardar el donante: ' + error.message : null;
}

// Comentarios - Ficha de donante
// Datos que muestra la ficha: el donante, su consentimiento vigente (el más reciente) y sus etiquetas.
export interface Consentimiento {
  acepta_cookies: boolean;
  autoriza_contacto: boolean;
}

export interface FichaDonante {
  donante: Donante;
  consentimiento: Consentimiento;
  etiquetas: string[];
}

export async function obtenerFichaDonante(codigo: string): Promise<FichaDonante | null> {
  const { data: donante, error } = await supabase
    .from('donante')
    .select('*')
    .eq('codigo_donante', codigo)
    .single();
  if (error || !donante) return null;

  const [{ data: consentimiento }, { data: etiquetas }] = await Promise.all([
    supabase
      .from('consentimiento')
      .select('acepta_cookies, autoriza_contacto')
      .eq('donante_id', donante.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('etiqueta_donante')
      .select('etiqueta')
      .eq('donante_id', donante.id),
  ]);

  return {
    donante,
    consentimiento: consentimiento ?? { acepta_cookies: false, autoriza_contacto: false },
    etiquetas: (etiquetas ?? []).map((fila) => fila.etiqueta),
  };
}

// Comentarios - Ficha de donante
// Guarda los datos editables del donante. Los datos clínicos (RUT, grupo, fenotipo) no se editan desde la ficha.
export async function actualizarDonante(donante: Donante): Promise<string | null> {
  const { error } = await supabase
    .from('donante')
    .update({
      nombre: donante.nombre,
      apellido: donante.apellido,
      sexo: donante.sexo || null,
      correo: donante.correo?.trim() || null,
      telefono: donante.telefono || null,
      ubicacion: donante.ubicacion || null,
      observaciones: donante.observaciones || null,
      frecuente_plaquetas: donante.frecuente_plaquetas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', donante.id);
  return error ? 'Error al guardar: ' + error.message : null;
}

// Comentarios - Ficha de donante
// El historial de consentimientos no se edita: cada cambio agrega una fila nueva (la vigente es la última).
// Solo se informa la fecha de la decisión que cambió; la base completa las demás.
export async function registrarConsentimiento(
  donanteId: string,
  nuevo: Consentimiento,
  anterior: Consentimiento,
  registradoPor: string | null,
): Promise<string | null> {
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from('consentimiento')
    .insert({
      donante_id: donanteId,
      acepta_cookies: nuevo.acepta_cookies,
      fecha_cookies: nuevo.acepta_cookies !== anterior.acepta_cookies ? ahora : null,
      autoriza_contacto: nuevo.autoriza_contacto,
      fecha_autoriza_contacto: nuevo.autoriza_contacto !== anterior.autoriza_contacto ? ahora : null,
      registrado_por: registradoPor,
      updated_at: ahora,
    });
  return error ? 'Error al guardar consentimiento: ' + error.message : null;
}

// Comentarios - Guardar etiquetas del donante
// Reemplaza las etiquetas genéricas del donante: borra las existentes e inserta las seleccionadas.
// Las etiquetas de columna (fenotipo raro, plaquetas) no se tocan.
export async function reemplazarEtiquetasGenericas(donanteId: string, etiquetas: string[]): Promise<string | null> {
  const { error: errBorrar } = await supabase
    .from('etiqueta_donante')
    .delete()
    .eq('donante_id', donanteId)
    .in('etiqueta', ETIQUETAS_GENERICAS);
  if (errBorrar) return errBorrar.message;
  if (etiquetas.length === 0) return null;

  const { error: errInsertar } = await supabase
    .from('etiqueta_donante')
    .insert(etiquetas.map((etiqueta) => ({ donante_id: donanteId, etiqueta })));
  return errInsertar ? errInsertar.message : null;
}

// Comentarios - Regla de espera entre donaciones por sexo
// Fecha 'AAAA-MM-DD' desde la que el donante puede volver a donar, calculada por la base según su sexo.
// Sin sexo registrado se usa la versión de un parámetro, que aplica la regla general. Devuelve null si falla.
export async function fechaProximaDonacion(ultima: string, sexo: string | null): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    'fn_fecha_proxima_donacion',
    sexo ? { p_ultima: ultima, p_sexo: sexo } : { p_ultima: ultima },
  );
  return error || typeof data !== 'string' ? null : data;
}

// Comentarios - Registrar donación
// El detalle solo se envía si hubo reacción: la base marca hubo_reaccion cuando recibe un detalle, y eso
// bloquea al donante. El trigger fn_aplicar_donacion actualiza la fecha de última donación (sin retroceder si
// se carga una donación antigua) y la marca de reacción adversa.
export interface NuevaDonacion {
  donanteId: string;
  fecha: string;
  tipo: TipoDonacion;
  huboReaccion: boolean;
  detalleReaccion: string;
  registradoPor: string | null;
}

export async function registrarDonacion(d: NuevaDonacion): Promise<string | null> {
  const { error } = await supabase
    .from('donacion')
    .insert({
      donante_id: d.donanteId,
      fecha_donacion: d.fecha,
      tipo: d.tipo,
      hubo_reaccion: d.huboReaccion,
      detalle_reaccion: d.huboReaccion ? d.detalleReaccion.trim() || null : null,
      registrado_por: d.registradoPor,
    });
  return error ? 'Error al registrar donación: ' + error.message : null;
}

// Comentarios - Registrar donación
// Relee los campos que actualiza el trigger tras una donación, para mostrar los valores reales de la base.
export async function leerEstadoDonacion(
  donanteId: string,
): Promise<Pick<Donante, 'fecha_ultima_donacion' | 'reaccion_adversa_previa'> | null> {
  const { data, error } = await supabase
    .from('donante')
    .select('fecha_ultima_donacion, reaccion_adversa_previa')
    .eq('id', donanteId)
    .single();
  return error ? null : data;
}
