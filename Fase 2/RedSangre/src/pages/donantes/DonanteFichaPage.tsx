import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './DonanteFichaPage.module.css';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/useAuth';
import { formatearFecha, hoyISO, mesesDesde } from '../../utils/fechas';
import { tieneFormatoCorreo } from '../../utils/validacionCorreo';
import type { Donante } from '../../tipos/dominio';

// Comentarios - Regla de espera entre donaciones por sexo
// Valores permitidos por la columna donante.sexo. Define la espera entre donaciones (3 o 4 meses).
const OPCIONES_SEXO = ['Femenino', 'Masculino', 'No especifica'];

// Comentarios - Tipos de la base de datos
// La ficha trabaja con la fila completa de la tabla donante, tal como la define el esquema.
type DonanteDetalle = Donante;

function calcularUltimaDonacion(fecha: string | null): string {
  if (!fecha) return '-';
  const meses = mesesDesde(fecha);
  const fechaFormateada = formatearFecha(fecha);
  if (meses === 0) return `${fechaFormateada} (este mes)`;
  if (meses === 1) return `${fechaFormateada} (hace 1 mes)`;
  return `${fechaFormateada} (hace ${meses} meses)`;
}

type ConsentState = { acepta_cookies: boolean; autoriza_contacto: boolean };

const ETIQUETAS_GENERICAS = [
  'Donación altruista',
  'Grupo sanguíneo de interés',
  'Donante derivado o referido',
  'Donante corporativo',
  'Donante de plasma',
];

export function DonanteFichaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentimiento, setConsentimiento] = useState<ConsentState | null>(null);
  const [consentimientoEdit, setConsentimientoEdit] = useState<ConsentState | null>(null);
  const [donante, setDonante] = useState<DonanteDetalle | null>(null);
  const [donanteOriginal, setDonanteOriginal] = useState<DonanteDetalle | null>(null);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [etiquetasEdit, setEtiquetasEdit] = useState<string[]>([]);
  const [isRegistrandoDonacion, setIsRegistrandoDonacion] = useState(false);
  const [fechaDonacion, setFechaDonacion] = useState(hoyISO());
  const [tipoDonacion, setTipoDonacion] = useState<'sangre_total' | 'plaquetas'>('sangre_total');
  const [huboReaccion, setHuboReaccion] = useState(false);
  const [detalleReaccion, setDetalleReaccion] = useState('');
  const [registrandoDonacion, setRegistrandoDonacion] = useState(false);

  useEffect(() => {
    async function cargarDonante() {
      if (!id) return;
      setCargando(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('donante')
        .select('*')
        .eq('codigo_donante', id)
        .single();

      if (err || !data) {
        setError('No se encontró el donante.');
        setCargando(false);
        return;
      }

      setDonante(data);
      setDonanteOriginal(data);

      const { data: consent } = await supabase
        .from('consentimiento')
        .select('acepta_cookies, autoriza_contacto')
        .eq('donante_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setConsentimiento(consent ?? { acepta_cookies: false, autoriza_contacto: false });

      const { data: etiquetasData } = await supabase
        .from('etiqueta_donante')
        .select('etiqueta')
        .eq('donante_id', data.id);

      setEtiquetas((etiquetasData ?? []).map((r: { etiqueta: string }) => r.etiqueta));
      setCargando(false);
    }
    cargarDonante();
  }, [id]);

  const handleCancelar = () => {
    setDonante(donanteOriginal);
    setConsentimientoEdit(null);
    setEtiquetasEdit([]);
    setIsEditing(false);
    setError(null);
  };

  const handleGuardar = async () => {
    if (!donante) return;

    // Comentarios - Validar correo de donante
    // El correo es opcional, pero si se escribe debe tener formato válido para poder enviarle avisos.
    if (donante.correo?.trim() && !tieneFormatoCorreo(donante.correo)) {
      setError('El correo del donante no tiene un formato válido.');
      return;
    }

    setGuardando(true);
    setError(null);

    const ahora = new Date().toISOString();

    const { error: err } = await supabase
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
        updated_at: ahora,
      })
      .eq('id', donante.id);

    if (err) {
      setGuardando(false);
      setError('Error al guardar: ' + err.message);
      return;
    }

    if (consentimientoEdit && (
      consentimientoEdit.acepta_cookies !== consentimiento?.acepta_cookies ||
      consentimientoEdit.autoriza_contacto !== consentimiento?.autoriza_contacto
    )) {
      const cookiesCambio = consentimientoEdit.acepta_cookies !== consentimiento?.acepta_cookies;
      const contactoCambio = consentimientoEdit.autoriza_contacto !== consentimiento?.autoriza_contacto;

      const { error: consentErr } = await supabase
        .from('consentimiento')
        .insert({
          donante_id: donante.id,
          acepta_cookies: consentimientoEdit.acepta_cookies,
          fecha_cookies: cookiesCambio ? ahora : null,
          autoriza_contacto: consentimientoEdit.autoriza_contacto,
          fecha_autoriza_contacto: contactoCambio ? ahora : null,
          registrado_por: user?.id ?? null,
          updated_at: ahora,
        });

      if (consentErr) {
        setGuardando(false);
        setError('Error al guardar consentimiento: ' + consentErr.message);
        return;
      }

      setConsentimiento(consentimientoEdit);
    }

    // Comentarios - Guardar etiquetas del donante
    // Sincroniza las etiquetas genéricas: borra las existentes y reinserta las seleccionadas.
    // Si alguna operación falla, se avisa y la ficha queda en modo edición para reintentar.
    const { error: errBorrar } = await supabase
      .from('etiqueta_donante')
      .delete()
      .eq('donante_id', donante.id)
      .in('etiqueta', ETIQUETAS_GENERICAS);

    const { error: errInsertar } = !errBorrar && etiquetasEdit.length > 0
      ? await supabase
        .from('etiqueta_donante')
        .insert(etiquetasEdit.map(e => ({ donante_id: donante.id, etiqueta: e })))
      : { error: null };

    if (errBorrar || errInsertar) {
      setGuardando(false);
      setError('Los datos se guardaron, pero no se pudieron actualizar las etiquetas: ' + (errBorrar ?? errInsertar)!.message);
      return;
    }

    const etiquetasNoGenericas = etiquetas.filter(e => !ETIQUETAS_GENERICAS.includes(e));
    setEtiquetas([...etiquetasNoGenericas, ...etiquetasEdit]);

    setGuardando(false);
    setDonanteOriginal(donante);
    setConsentimientoEdit(null);
    setEtiquetasEdit([]);
    setIsEditing(false);
  };

  const resetPanelDonacion = () => {
    setIsRegistrandoDonacion(false);
    setFechaDonacion(hoyISO());
    setTipoDonacion('sangre_total');
    setHuboReaccion(false);
    setDetalleReaccion('');
  };

  const handleRegistrarDonacion = async () => {
    if (!donante || donante.reaccion_adversa_previa) return;
    setError(null);

    setRegistrandoDonacion(true);

    // Comentarios - Regla de espera entre donaciones por sexo
    // La base calcula desde qué fecha puede volver a donar (3 meses hombres o sin dato, 4 mujeres y "No especifica").
    // Las fechas 'AAAA-MM-DD' se comparan como texto, sin pasar por Date, para no desfasarlas por la zona horaria.
    if (donante.fecha_ultima_donacion) {
      // Sin sexo registrado se usa la versión de un parámetro, que aplica la regla general.
      const { data: fechaPermitida, error: errFecha } = await supabase.rpc(
        'fn_fecha_proxima_donacion',
        donante.sexo
          ? { p_ultima: donante.fecha_ultima_donacion, p_sexo: donante.sexo }
          : { p_ultima: donante.fecha_ultima_donacion },
      );

      if (errFecha || typeof fechaPermitida !== 'string') {
        setRegistrandoDonacion(false);
        setError('No se pudo verificar la regla de espera entre donaciones. Intenta nuevamente.');
        return;
      }
      if (fechaDonacion < fechaPermitida) {
        setRegistrandoDonacion(false);
        setError(`No se puede registrar la donación. Según la regla de espera (${donante.sexo ?? 'sexo no registrado'}), el donante puede volver a donar desde el ${formatearFecha(fechaPermitida)}.`);
        return;
      }
    }

    // Comentarios - Registrar donación
    // El detalle solo se envía si hubo reacción: la base marca hubo_reaccion cuando recibe un detalle,
    // y eso bloquea al donante. El trigger fn_aplicar_donacion actualiza la fecha de última donación
    // (sin retroceder si se carga una donación antigua) y la marca de reacción adversa.
    const { error: donacionErr } = await supabase
      .from('donacion')
      .insert({
        donante_id: donante.id,
        fecha_donacion: fechaDonacion,
        tipo: tipoDonacion,
        hubo_reaccion: huboReaccion,
        detalle_reaccion: huboReaccion ? detalleReaccion.trim() || null : null,
        registrado_por: user?.id ?? null,
      });

    if (donacionErr) {
      setRegistrandoDonacion(false);
      setError('Error al registrar donación: ' + donacionErr.message);
      return;
    }

    // Comentarios - Registrar donación
    // Relee los campos que actualizó el trigger para mostrar los valores reales de la base.
    const { data: actualizado, error: errReleer } = await supabase
      .from('donante')
      .select('fecha_ultima_donacion, reaccion_adversa_previa')
      .eq('id', donante.id)
      .single();

    setRegistrandoDonacion(false);

    if (errReleer || !actualizado) {
      setError('Donación registrada, pero no se pudo actualizar la ficha. Recarga la página.');
      return;
    }

    const donanteActualizado = { ...donante, ...actualizado };
    setDonante(donanteActualizado);
    setDonanteOriginal(donanteActualizado);
    resetPanelDonacion();
  };

  if (cargando) return <p style={{ textAlign: 'center', padding: '40px' }}>Cargando donante...</p>;
  if (!donante) return <p style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error ?? 'No se encontró el donante.'}</p>;

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabecera}>
        <button onClick={() => navigate('/donantes')} className={styles.botonVolver}>
          ← Volver a donantes
        </button>
        <h2 className={styles.tituloPagina}>Ficha de donante · {donante.codigo_donante}</h2>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <input
            className={styles.inputEdit}
            style={{ fontSize: '24px', fontWeight: 'bold', flex: 1 }}
            value={donante.nombre}
            onChange={(e) => setDonante({ ...donante, nombre: e.target.value })}
            placeholder="Nombre"
          />
          <input
            className={styles.inputEdit}
            style={{ fontSize: '24px', fontWeight: 'bold', flex: 1 }}
            value={donante.apellido}
            onChange={(e) => setDonante({ ...donante, apellido: e.target.value })}
            placeholder="Apellido"
          />
        </div>
      ) : (
        <h1 className={styles.nombreDonante}>{donante.nombre} {donante.apellido}</h1>
      )}

      {error && <div className={styles.mensajeError}>{error}</div>}

      {donante.reaccion_adversa_previa && (
        <div className={styles.mensajeError}>
          ⚠ Este donante tuvo una reacción adversa: está bloqueado y no puede donar, ser contactado ni editarse.
        </div>
      )}

      <div className={styles.layoutColumnas}>

        {/* COLUMNA 1 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Datos clínicos</h3>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>RUT</span>
            <span className={styles.valorDato}>{donante.rut}</span>
          </div>

          {/* Comentarios - Regla de espera entre donaciones por sexo */}
          {/* Sexo del donante: define si espera 3 o 4 meses entre donaciones. Editable para completar donantes antiguos. */}
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Sexo</span>
            {isEditing ? (
              <select
                className={styles.inputEdit}
                value={donante.sexo ?? ''}
                onChange={(e) => setDonante({ ...donante, sexo: e.target.value || null })}
              >
                <option value="">Sin registrar</option>
                {OPCIONES_SEXO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <span className={styles.valorDato}>{donante.sexo ?? 'Sin registrar'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Grupo sanguíneo</span>
            <span className={styles.valorDato}>{donante.grupo_sanguineo}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fenotipo</span>
            <span className={styles.valorDato}>{donante.fenotipo || '-'}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Última donación</span>
            <span className={styles.valorDato}>{calcularUltimaDonacion(donante.fecha_ultima_donacion)}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Etiquetas</span>
            <div className={styles.contenedorEtiquetas}>
              {donante.fenotipo_raro && <Badge texto="Fenotipo raro" color="morado" />}
              {isEditing ? (
                <label className={styles.checkboxEdit}>
                  <input
                    type="checkbox"
                    checked={donante.frecuente_plaquetas}
                    onChange={e => setDonante({ ...donante, frecuente_plaquetas: e.target.checked })}
                  />
                  Donante frecuente de plaquetas
                </label>
              ) : (
                donante.frecuente_plaquetas && <Badge texto="Plaquetas" color="azul" />
              )}
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ETIQUETAS_GENERICAS.map(e => (
                    <label key={e} className={styles.checkboxEdit}>
                      <input
                        type="checkbox"
                        checked={etiquetasEdit.includes(e)}
                        onChange={() => setEtiquetasEdit(prev =>
                          prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
                        )}
                      />
                      {e}
                    </label>
                  ))}
                </div>
              ) : (
                <>
                  {etiquetas
                    .filter(e => !['Fenotipo sanguíneo raro', 'Donante de plaquetas'].includes(e))
                    .map(e => <Badge key={e} texto={e} color="azul" />)
                  }
                  {!donante.fenotipo_raro && !donante.frecuente_plaquetas &&
                    etiquetas.filter(e => !['Fenotipo sanguíneo raro', 'Donante de plaquetas'].includes(e)).length === 0 && (
                    <span style={{ color: '#aaa' }}>-</span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Observaciones</span>
            {isEditing ? (
              <textarea
                className={styles.inputEdit}
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={donante.observaciones || ''}
                onChange={(e) => setDonante({ ...donante, observaciones: e.target.value })}
              />
            ) : (
              <span className={styles.valorDato}>{donante.observaciones || '-'}</span>
            )}
          </div>
        </div>

        {/* COLUMNA 2 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Contacto y consentimiento</h3>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Correo</span>
            {isEditing ? (
              <input
                type="email"
                className={styles.inputEdit}
                value={donante.correo || ''}
                onChange={(e) => setDonante({ ...donante, correo: e.target.value })}
              />
            ) : (
              <span className={styles.valorDato}>{donante.correo || '-'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Teléfono</span>
            {isEditing ? (
              <input
                type="text"
                className={styles.inputEdit}
                value={donante.telefono || ''}
                onChange={(e) => setDonante({ ...donante, telefono: e.target.value })}
              />
            ) : (
              <span className={styles.valorDato}>{donante.telefono || '-'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Ubicación</span>
            {isEditing ? (
              <input
                type="text"
                className={styles.inputEdit}
                value={donante.ubicacion || ''}
                onChange={(e) => setDonante({ ...donante, ubicacion: e.target.value })}
              />
            ) : (
              <span className={styles.valorDato}>{donante.ubicacion || '-'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Cookies aceptadas</span>
            <div className={styles.contenedorEtiquetas}>
              {isEditing && consentimientoEdit ? (
                <label className={styles.checkboxEdit}>
                  <input
                    type="checkbox"
                    checked={consentimientoEdit.acepta_cookies}
                    onChange={e => setConsentimientoEdit({ ...consentimientoEdit, acepta_cookies: e.target.checked })}
                  />
                  {consentimientoEdit.acepta_cookies ? 'Sí' : 'No'}
                </label>
              ) : (
                <Badge texto={consentimiento?.acepta_cookies ? 'Sí' : 'No'} color={consentimiento?.acepta_cookies ? 'verde' : 'gris'} />
              )}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Autoriza contacto</span>
            <div className={styles.contenedorEtiquetas}>
              {isEditing && consentimientoEdit ? (
                <label className={styles.checkboxEdit}>
                  <input
                    type="checkbox"
                    checked={consentimientoEdit.autoriza_contacto}
                    onChange={e => setConsentimientoEdit({ ...consentimientoEdit, autoriza_contacto: e.target.checked })}
                  />
                  {consentimientoEdit.autoriza_contacto ? 'Sí' : 'No'}
                </label>
              ) : (
                <Badge texto={consentimiento?.autoriza_contacto ? 'Sí' : 'No'} color={consentimiento?.autoriza_contacto ? 'verde' : 'gris'} />
              )}
            </div>
          </div>
        </div>

      </div>

      <div className={styles.pieFicha}>
        {isEditing ? (
          <div className={styles.botonesPie}>
            <button className={styles.botonCancelar} onClick={handleCancelar} disabled={guardando}>
              Cancelar
            </button>
            <Button texto={guardando ? 'Guardando...' : 'Guardar cambios'} onClick={handleGuardar} disabled={guardando} />
          </div>
        ) : (
          <div className={styles.botonesPie}>
            <button
              className={styles.botonDonacion}
              disabled={!!donante.reaccion_adversa_previa}
              style={donante.reaccion_adversa_previa ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              onClick={() => setIsRegistrandoDonacion(true)}
            >
              + Registrar donación
            </button>
            {!donante.reaccion_adversa_previa && (
              <Button texto="Editar donante" onClick={() => {
                setIsEditing(true);
                setConsentimientoEdit(consentimiento ?? { acepta_cookies: false, autoriza_contacto: false });
                setEtiquetasEdit(etiquetas.filter(e => ETIQUETAS_GENERICAS.includes(e)));
              }} />
            )}
          </div>
        )}
      </div>

      {isRegistrandoDonacion && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContenido}>
            <div className={styles.modalCabecera}>
              <h2>Registrar donación</h2>
            </div>

            <div className={styles.filaPanelDonacion}>
              <span className={styles.labelDonacion}>Fecha de donación</span>
              <input
                type="date"
                className={styles.inputFecha}
                value={fechaDonacion}
                max={hoyISO()}
                onChange={e => setFechaDonacion(e.target.value)}
              />
            </div>

            <div className={styles.filaPanelDonacion}>
              <span className={styles.labelDonacion}>Tipo</span>
              <div className={styles.toggleGrupo}>
                <button
                  className={tipoDonacion === 'sangre_total' ? styles.toggleActivo : styles.toggleInactivo}
                  onClick={() => setTipoDonacion('sangre_total')}
                >
                  Sangre total
                </button>
                <button
                  className={tipoDonacion === 'plaquetas' ? styles.toggleActivo : styles.toggleInactivo}
                  onClick={() => setTipoDonacion('plaquetas')}
                >
                  Plaquetas
                </button>
              </div>
            </div>

            <div className={styles.filaPanelDonacion}>
              <span className={styles.labelDonacion}>¿Hubo reacción adversa?</span>
              <div className={styles.toggleGrupo}>
                <button
                  className={!huboReaccion ? styles.toggleActivo : styles.toggleInactivo}
                  onClick={() => setHuboReaccion(false)}
                >
                  No
                </button>
                <button
                  className={huboReaccion ? styles.toggleActivoRojo : styles.toggleInactivo}
                  onClick={() => setHuboReaccion(true)}
                >
                  Sí
                </button>
              </div>
            </div>

            {huboReaccion && (
              <p className={styles.avisoReaccionAdversa}>
                ⚠ Esto bloqueará a este donante para futuras donaciones.
              </p>
            )}

            {/* Comentarios - Registrar donación */}
            {/* El detalle solo se pide si hubo reacción: cualquier detalle guardado marca la reacción y bloquea al donante. */}
            {huboReaccion && (
              <div className={styles.filaPanelDonacion}>
                <span className={styles.labelDonacion}>Detalle de la reacción</span>
                <textarea
                  className={styles.textareaReaccion}
                  placeholder="Describe brevemente lo ocurrido..."
                  rows={3}
                  value={detalleReaccion}
                  onChange={e => setDetalleReaccion(e.target.value)}
                />
              </div>
            )}

            <div className={styles.botonesPanel}>
              <button className={styles.botonCancelar} onClick={resetPanelDonacion} disabled={registrandoDonacion}>
                Cancelar
              </button>
              <button
                className={styles.botonConfirmarDonacion}
                onClick={handleRegistrarDonacion}
                disabled={registrandoDonacion || !fechaDonacion}
              >
                {registrandoDonacion ? 'Registrando...' : 'Confirmar donación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}