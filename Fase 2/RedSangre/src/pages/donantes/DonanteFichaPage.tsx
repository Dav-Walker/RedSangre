import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './DonanteFichaPage.module.css';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/useAuth';

interface DonanteDetalle {
  id: string;
  codigo_donante: string;
  nombre: string;
  apellido: string;
  rut: string;
  sexo?: string; // <--- Agregamos sexo para la regla médica
  correo: string | null;
  telefono: string | null;
  grupo_sanguineo: string;
  fenotipo: string | null;
  fenotipo_raro: boolean;
  frecuente_plaquetas: boolean;
  fecha_ultima_donacion: string | null;
  ubicacion: string | null;
  observaciones: string | null;
}

function calcularUltimaDonacion(fecha: string | null): string {
  if (!fecha) return '-';
  const hoy = new Date();
  const donacion = new Date(fecha);
  const meses = (hoy.getFullYear() - donacion.getFullYear()) * 12 + (hoy.getMonth() - donacion.getMonth());
  const fechaFormateada = donacion.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (meses === 0) return `${fechaFormateada} (este mes)`;
  if (meses === 1) return `${fechaFormateada} (hace 1 mes)`;
  return `${fechaFormateada} (hace ${meses} meses)`;
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

type ConsentState = { acepta_cookies: boolean; autoriza_contacto: boolean };

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
  const [isRegistrandoDonacion, setIsRegistrandoDonacion] = useState(false);
  const [fechaDonacion, setFechaDonacion] = useState(hoyISO());
  const [tipoDonacion, setTipoDonacion] = useState<'sangre_total' | 'plaquetas'>('sangre_total');
  const [huboReaccion, setHuboReaccion] = useState(false);
  const [detalleReaccion, setDetalleReaccion] = useState('');
  const [registrandoDonacion, setRegistrandoDonacion] = useState(false);

  useEffect(() => {
    async function cargarDonante() {
      setCargando(true);
      setError(null);

      const { data, error: err } = await supabase!
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

      const { data: consent } = await supabase!
        .from('consentimiento')
        .select('acepta_cookies, autoriza_contacto')
        .eq('donante_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setConsentimiento(consent ?? { acepta_cookies: false, autoriza_contacto: false });
      setCargando(false);
    }
    cargarDonante();
  }, [id]);

  const handleCancelar = () => {
    setDonante(donanteOriginal);
    setConsentimientoEdit(null);
    setIsEditing(false);
    setError(null);
  };

  const handleGuardar = async () => {
    if (!donante) return;

    setGuardando(true);
    setError(null);

    const ahora = new Date().toISOString();

    const { error: err } = await supabase!
      .from('donante')
      .update({
        nombre: donante.nombre,
        apellido: donante.apellido,
        correo: donante.correo || null,
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

      const { error: consentErr } = await supabase!
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

    setGuardando(false);
    setDonanteOriginal(donante);
    setConsentimientoEdit(null);
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
    if (!donante) return;
    setError(null);

    // ==========================================
    // REGLA MÉDICA DE INTERVALO DE DONACIÓN
    // ==========================================
    if (donante.fecha_ultima_donacion) {
      const ultimaDonacion = new Date(donante.fecha_ultima_donacion);
      const nuevaDonacion = new Date(fechaDonacion);
      
      // Hombres: cada 3 meses | Mujeres o No especifica: cada 4 meses
      const mesesRequeridos = donante.sexo === 'Masculino' ? 3 : 4;
      
      // Calculamos la fecha mínima permitida sumando los meses requeridos a la última donación
      const fechaPermitida = new Date(ultimaDonacion);
      fechaPermitida.setMonth(fechaPermitida.getMonth() + mesesRequeridos);

      if (nuevaDonacion < fechaPermitida) {
        setError(`No se puede registrar la donación. Según el sexo (${donante.sexo || 'No especifica'}), debe esperar un intervalo mínimo de ${mesesRequeridos} meses entre donaciones (Aún debe esperar hasta el ${fechaPermitida.toLocaleDateString('es-CL')}).`);
        return;
      }
    }

    setRegistrandoDonacion(true);

    const { error: donacionErr } = await supabase!
      .from('donacion')
      .insert({
        donante_id: donante.id,
        fecha_donacion: fechaDonacion,
        tipo: tipoDonacion,
        hubo_reaccion: huboReaccion,
        detalle_reaccion: huboReaccion && detalleReaccion.trim() ? detalleReaccion.trim() : null,
        registrado_por: user?.id ?? null,
      });

    if (donacionErr) {
      setRegistrandoDonacion(false);
      setError('Error al registrar donación: ' + donacionErr.message);
      return;
    }

    const actualizacionDonante: Record<string, unknown> = { fecha_ultima_donacion: fechaDonacion };
    if (huboReaccion) actualizacionDonante.reaccion_adversa_previa = true;

    const { error: donanteErr } = await supabase!
      .from('donante')
      .update(actualizacionDonante)
      .eq('id', donante.id);

    setRegistrandoDonacion(false);

    if (donanteErr) {
      setError('Donación registrada, pero error al actualizar el donante: ' + donanteErr.message);
      return;
    }

    const donanteActualizado = {
      ...donante,
      fecha_ultima_donacion: fechaDonacion,
      ...(huboReaccion ? { reaccion_adversa_previa: true } : {}),
    };
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

      <div className={styles.layoutColumnas}>

        {/* COLUMNA 1 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Datos clínicos</h3>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>RUT</span>
            <span className={styles.valorDato}>{donante.rut}</span>
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
              {!donante.fenotipo_raro && !donante.frecuente_plaquetas && !isEditing && (
                <span style={{ color: '#aaa' }}>-</span>
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
            <Button texto={guardando ? 'Guardando...' : 'Guardar cambios'} onClick={handleGuardar} />
          </div>
        ) : isRegistrandoDonacion ? (
          <div className={styles.panelDonacion}>
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
                  onClick={() => { setHuboReaccion(false); setDetalleReaccion(''); }}
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
        ) : (
          <div className={styles.botonesPie}>
            <button
              className={styles.botonDonacion}
              onClick={() => setIsRegistrandoDonacion(true)}
            >
              + Registrar donación
            </button>
            <Button texto="Editar donante" onClick={() => {
              setIsEditing(true);
              setConsentimientoEdit(consentimiento ?? { acepta_cookies: false, autoriza_contacto: false });
            }} />
          </div>
        )}
      </div>
    </div>
  );
}