// Comentarios - Servicio de donantes
// Consultas y escrituras de donantes, consentimientos, etiquetas y donaciones. Las páginas no llaman a Supabase
// directamente: usan estas funciones. Las escrituras devuelven un mensaje de error o null si todo salió bien.
import { supabase } from '../utils/supabase';
import { valorFiltro } from '../utils/filtrosPostgrest';
import { registrarEvento, registrarRechazo } from './auditoria';
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
  antigenos: string[];
  etiqueta: string;
  busqueda: string;
}

export interface ResultadoDonantes {
  donantes: DonanteFila[];
  total: number;
  error: string | null;
}

const ERROR_LISTADO = 'No se pudieron cargar los donantes.';

// Comentarios - Búsqueda por fenotipo
// Condición para que el fenotipo del donante ("C+, E-, K+") incluya un antígeno exacto: como fenotipo
// completo, al inicio, al final o en medio de la lista. Se usa "like", que distingue mayúsculas,
// porque K (Kell) y k (Cellano) son antígenos distintos. Los fenotipos con otro formato no coinciden.
function condicionAntigeno(antigeno: string): string {
  return `or(fenotipo.eq.${valorFiltro(antigeno)},`
    + `fenotipo.like.${valorFiltro(`${antigeno}, %`)},`
    + `fenotipo.like.${valorFiltro(`%, ${antigeno}`)},`
    + `fenotipo.like.${valorFiltro(`%, ${antigeno}, %`)})`;
}

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

  // Comentarios - Búsqueda de donantes
  // La búsqueda por texto y el fenotipo se combinan en un solo filtro: todas las condiciones deben cumplirse.
  const condiciones: string[] = [];
  if (f.busqueda) {
    // Comentarios - Búsqueda segura en filtros .or()
    // El texto va entre comillas para que comas o paréntesis escritos por el usuario no rompan el filtro.
    const patron = valorFiltro(`%${f.busqueda}%`);
    condiciones.push(`or(nombre.ilike.${patron},apellido.ilike.${patron},rut.ilike.${patron})`);
  }
  f.antigenos.forEach((antigeno) => condiciones.push(condicionAntigeno(antigeno)));
  if (condiciones.length > 0) query = query.or(`and(${condiciones.join(',')})`);
  if (f.etiqueta === ETIQUETA_FENOTIPO_RARO) query = query.eq('fenotipo_raro', true);
  else if (f.etiqueta === ETIQUETA_PLAQUETAS) query = query.eq('frecuente_plaquetas', true);
  else if (idsConEtiqueta !== null) query = query.in('id', idsConEtiqueta);

  const desde = (f.pagina - 1) * f.porPagina;
  const { data, error, count } = await query.range(desde, desde + f.porPagina - 1);
  if (error) return { donantes: [], total: 0, error: ERROR_LISTADO };

  // Comentarios - Bitácora completa
  // Registra la consulta con sus filtros. El texto buscado no se guarda (puede ser un nombre o un RUT):
  // solo se anota si hubo búsqueda por texto.
  void registrarEvento('BUSCAR_DONANTES', {
    tabla: 'donante',
    detalle: {
      pagina: f.pagina,
      grupo: f.grupo || null,
      antigenos: f.antigenos,
      etiqueta: f.etiqueta || null,
      con_texto: Boolean(f.busqueda),
      resultados: count ?? 0,
    },
  });
  return { donantes: data ?? [], total: count ?? 0, error: null };
}

// Comentarios - Registro atómico de donante
// Guarda donante, consentimiento y etiquetas en una sola transacción con fn_registrar_donante.
export type DatosRegistroDonante = Database['public']['Functions']['fn_registrar_donante']['Args'];

export async function registrarDonante(datos: DatosRegistroDonante): Promise<string | null> {
  const { error } = await supabase.rpc('fn_registrar_donante', datos);
  if (error) {
    registrarRechazo('registrar_donante', error.code);
    return 'Error al guardar el donante: ' + error.message;
  }
  return null;
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

  // Comentarios - Bitácora completa
  // Abrir la ficha es un acceso a datos personales y de salud: queda registrado quién vio a qué donante
  void registrarEvento('VER_DONANTE', { tabla: 'donante', registroId: donante.id });

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
  if (error) {
    registrarRechazo('editar_donante', error.code, donante.id);
    return 'Error al guardar: ' + error.message;
  }
  return null;
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
  if (error) {
    registrarRechazo('registrar_consentimiento', error.code, donanteId);
    return 'Error al guardar consentimiento: ' + error.message;
  }
  return null;
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
  if (errBorrar) {
    registrarRechazo('quitar_etiquetas', errBorrar.code, donanteId);
    return errBorrar.message;
  }
  if (etiquetas.length === 0) return null;

  const { error: errInsertar } = await supabase
    .from('etiqueta_donante')
    .insert(etiquetas.map((etiqueta) => ({ donante_id: donanteId, etiqueta })));
  if (errInsertar) {
    registrarRechazo('agregar_etiquetas', errInsertar.code, donanteId);
    return errInsertar.message;
  }
  return null;
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
  if (error) {
    registrarRechazo('registrar_donacion', error.code, d.donanteId);
    return 'Error al registrar donación: ' + error.message;
  }
  return null;
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
