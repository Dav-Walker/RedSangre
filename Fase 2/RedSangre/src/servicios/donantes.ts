// Comentarios - Servicio de donantes
// Consultas y escrituras de donantes, consentimientos, etiquetas y donaciones. Las páginas no llaman a Supabase
// directamente: usan estas funciones. Las escrituras devuelven un mensaje de error o null si todo salió bien.
import { supabase } from '../utils/supabase';
import { valorFiltro } from '../utils/filtrosPostgrest';
import { mensajeError } from '../utils/mensajesError';
import { MENSAJE_NOMBRE_LARGO, MENSAJE_TELEFONO_INVALIDO } from '../utils/validacionDonante';
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
  // Comentarios - Manejo de errores y excepciones
  // La página pedida ya no existe (por ejemplo, se borraron registros): la página vuelve a la primera
  fueraDeRango?: boolean;
}

const ERROR_LISTADO = 'No se pudieron cargar los donantes.';

// Comentarios - Manejo de errores y excepciones
// Mensajes para los datos del donante que rechazan las restricciones de la base, al registrar y al editar.
const ERRORES_DATOS_DONANTE: Record<string, string> = {
  donante_rut_key: 'Ya existe un donante registrado con ese RUT.',
  ck_donante_rut_formato: 'El RUT no tiene un formato válido. Ejemplo: 12345678-9.',
  ck_donante_telefono_formato: MENSAJE_TELEFONO_INVALIDO,
  ck_donante_correo_formato: 'El correo del donante no tiene un formato válido.',
  ck_donante_nombre_largo: MENSAJE_NOMBRE_LARGO,
  ck_donante_nombre_no_vacio: 'Ingresa el nombre y el apellido del donante.',
  ck_donante_raro_requiere_fenotipo: 'Un donante con fenotipo raro debe tener su fenotipo registrado.',
  donante_comuna_fkey: 'La comuna seleccionada no es válida.',
  donante_sexo_check: 'El sexo seleccionado no es válido.',
  ck_etiqueta_largo: 'Las etiquetas admiten hasta 50 caracteres.',
  uq_etiqueta_donante_unica: 'Una de las etiquetas está repetida.',
};

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
    if (errEtiqueta) return { donantes: [], total: 0, error: mensajeError(errEtiqueta, ERROR_LISTADO) };
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
  // Comentarios - Manejo de errores y excepciones
  // PGRST103: la página pedida quedó fuera del total. No es un error para el usuario: se vuelve a la primera.
  if (error?.code === 'PGRST103') return { donantes: [], total: 0, error: null, fueraDeRango: true };
  if (error) return { donantes: [], total: 0, error: mensajeError(error, ERROR_LISTADO) };

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
    // Comentarios - Manejo de errores y excepciones
    // El formulario ya valida formato de RUT, fecha y obligatorios; el RS007 que llegue igual suele ser el
    // dígito verificador (cuando la base lo exige) o un dato que cambió entre la validación y el guardado.
    return mensajeError(error, 'No se pudo guardar el donante. Inténtalo nuevamente.', {
      ...ERRORES_DATOS_DONANTE,
      RS001: 'Debe aceptar el tratamiento de datos y la autorización de contacto para registrar al donante.',
      RS007: 'Revisa el RUT (número y dígito verificador), la fecha de última donación y los datos obligatorios.',
      '42501': 'No tienes permiso para registrar donantes.',
    });
  }
  return null;
}

// Comentarios - Ficha de donante
// Datos que muestra la ficha: el donante, su consentimiento vigente (el más reciente) y sus etiquetas.
export interface Consentimiento {
  acepta_cookies: boolean;
  autoriza_contacto: boolean;
}

// Comentarios - Manejo de errores y excepciones
// consentimiento y etiquetas quedan en null si no se pudieron leer: la ficha avisa en vez de mostrar
// "no autoriza contacto" o "sin etiquetas" como si fueran datos reales.
export interface FichaDonante {
  donante: Donante;
  consentimiento: Consentimiento | null;
  etiquetas: string[] | null;
}

export async function obtenerFichaDonante(
  codigo: string,
): Promise<{ ficha: FichaDonante; error: null } | { ficha: null; error: string }> {
  // Comentarios - Manejo de errores y excepciones
  // maybeSingle distingue "no existe" (sin error y sin datos) de una falla al leer (error).
  const { data: donante, error } = await supabase
    .from('donante')
    .select('*')
    .eq('codigo_donante', codigo)
    .maybeSingle();
  if (error) return { ficha: null, error: mensajeError(error, 'No se pudo cargar la ficha del donante.') };
  if (!donante) return { ficha: null, error: 'No se encontró el donante.' };

  // Comentarios - Bitácora completa
  // Abrir la ficha es un acceso a datos personales y de salud: queda registrado quién vio a qué donante
  void registrarEvento('VER_DONANTE', { tabla: 'donante', registroId: donante.id });

  const [lecturaConsentimiento, lecturaEtiquetas] = await Promise.all([
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

  // Comentarios - Manejo de errores y excepciones
  // Sin filas de consentimiento el donante no autorizó nada (false). Si la lectura falló, queda en null.
  return {
    ficha: {
      donante,
      consentimiento: lecturaConsentimiento.error
        ? null
        : lecturaConsentimiento.data ?? { acepta_cookies: false, autoriza_contacto: false },
      etiquetas: lecturaEtiquetas.error ? null : (lecturaEtiquetas.data ?? []).map((fila) => fila.etiqueta),
    },
    error: null,
  };
}

// Comentarios - Ficha de donante
// Guarda los datos editables del donante. Los datos clínicos (RUT, grupo, fenotipo) no se editan desde la ficha.
export async function actualizarDonante(donante: Donante): Promise<string | null> {
  const { data, error } = await supabase
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
    .eq('id', donante.id)
    .select('id');
  if (error) {
    registrarRechazo('editar_donante', error.code, donante.id);
    return mensajeError(error, 'No se pudieron guardar los datos del donante. Inténtalo nuevamente.', {
      ...ERRORES_DATOS_DONANTE,
      '42501': 'No tienes permiso para editar donantes.',
    });
  }
  // Comentarios - Manejo de errores y excepciones
  // Si RLS no deja editar, la base no da error: simplemente no actualiza filas. Se avisa en vez de dar por guardado.
  if (!data || data.length === 0) return 'No se pudieron guardar los datos: no tienes permiso o el donante ya no existe.';
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
    return mensajeError(error, 'No se pudo registrar el cambio de consentimiento. Inténtalo nuevamente.', {
      RS006: 'El historial de consentimientos no se puede modificar: se registra un consentimiento nuevo.',
      '42501': 'No tienes permiso para cambiar el consentimiento.',
    });
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
    return mensajeError(errBorrar, ERROR_ETIQUETAS, { ...ERRORES_DATOS_DONANTE, '42501': 'No tienes permiso para cambiar etiquetas.' });
  }
  if (etiquetas.length === 0) return null;

  const { error: errInsertar } = await supabase
    .from('etiqueta_donante')
    .insert(etiquetas.map((etiqueta) => ({ donante_id: donanteId, etiqueta })));
  if (errInsertar) {
    registrarRechazo('agregar_etiquetas', errInsertar.code, donanteId);
    return mensajeError(errInsertar, ERROR_ETIQUETAS, { ...ERRORES_DATOS_DONANTE, '42501': 'No tienes permiso para cambiar etiquetas.' });
  }
  return null;
}

// Comentarios - Manejo de errores y excepciones
// Mensaje por defecto cuando falla el cambio de etiquetas (al quitar o al agregar)
const ERROR_ETIQUETAS = 'No se pudieron actualizar las etiquetas. Inténtalo nuevamente.';

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
    // Comentarios - Manejo de errores y excepciones
    // La fecha futura ya la frena el formulario; el RS007 restante es un donante o solicitud que no corresponde.
    return mensajeError(error, 'No se pudo registrar la donación. Inténtalo nuevamente.', {
      uq_donacion_solicitud_donante: 'Esta donación ya fue registrada.',
      ck_donacion_reaccion: 'El detalle de la reacción solo se registra si hubo reacción.',
      RS006: 'Las donaciones registradas no se pueden modificar.',
      RS007: 'No se pudo registrar la donación: revisa la fecha (no puede ser futura) y los datos del donante.',
      '42501': 'No tienes permiso para registrar donaciones.',
    });
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
