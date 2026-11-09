// Comentarios - Ficha de donante
// Muestra y edita los datos del donante, su consentimiento y etiquetas, y registra donaciones.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import styles from './DonanteFichaPage.module.css';
import { useAuth } from '../../contexts/useAuth';
import { formatearFecha, hoyISO, textoMesesDesde } from '../../utils/fechas';
import { tieneFormatoCorreo } from '../../utils/validacionCorreo';
import { ETIQUETAS_GENERICAS, esEtiquetaDeColumna } from '../../utils/etiquetas';
import {
  actualizarDonante,
  fechaProximaDonacion,
  leerEstadoDonacion,
  obtenerFichaDonante,
  reemplazarEtiquetasGenericas,
  registrarConsentimiento,
  registrarDonacion,
  type Consentimiento,
} from '../../servicios/donantes';
import type { Donante, TipoDonacion } from '../../tipos/dominio';

// Comentarios - Regla de espera entre donaciones por sexo
// Valores permitidos por la columna donante.sexo. Define la espera entre donaciones (3 o 4 meses).
const OPCIONES_SEXO = ['Femenino', 'Masculino', 'No especifica'];

const SIN_CONSENTIMIENTO: Consentimiento = { acepta_cookies: false, autoriza_contacto: false };

// Comentarios - Ficha de donante
// Fecha de la última donación con el tiempo transcurrido, por ejemplo "05-03-2026 (hace 8 meses)".
function textoUltimaDonacion(fecha: string | null): string {
  return fecha ? `${formatearFecha(fecha)} (${textoMesesDesde(fecha)})` : '-';
}

export function DonanteFichaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [editando, setEditando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentimiento, setConsentimiento] = useState<Consentimiento | null>(null);
  const [consentimientoEdit, setConsentimientoEdit] = useState<Consentimiento | null>(null);
  const [donante, setDonante] = useState<Donante | null>(null);
  const [donanteOriginal, setDonanteOriginal] = useState<Donante | null>(null);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [etiquetasEdit, setEtiquetasEdit] = useState<string[]>([]);
  const [panelDonacionAbierto, setPanelDonacionAbierto] = useState(false);
  const [fechaDonacion, setFechaDonacion] = useState(hoyISO());
  const [tipoDonacion, setTipoDonacion] = useState<TipoDonacion>('sangre_total');
  const [huboReaccion, setHuboReaccion] = useState(false);
  const [detalleReaccion, setDetalleReaccion] = useState('');
  const [registrandoDonacion, setRegistrandoDonacion] = useState(false);

  // Comentarios - Ficha de donante
  // Carga el donante de la ruta (/donantes/:codigo) con su consentimiento vigente y sus etiquetas.
  // "vigente" descarta la respuesta si el usuario navegó a otro donante mientras se esperaba.
  useEffect(() => {
    if (!id) return;
    let vigente = true;

    void obtenerFichaDonante(id).then((ficha) => {
      if (!vigente) return;
      if (ficha) {
        setDonante(ficha.donante);
        setDonanteOriginal(ficha.donante);
        setConsentimiento(ficha.consentimiento);
        setEtiquetas(ficha.etiquetas);
        setError(null);
      } else {
        setError('No se encontró el donante.');
      }
      setCargando(false);
    });

    return () => { vigente = false; };
  }, [id]);

  const handleCancelar = () => {
    setDonante(donanteOriginal);
    setConsentimientoEdit(null);
    setEtiquetasEdit([]);
    setEditando(false);
    setError(null);
  };

  const handleEditar = () => {
    setEditando(true);
    setConsentimientoEdit(consentimiento ?? SIN_CONSENTIMIENTO);
    setEtiquetasEdit(etiquetas.filter((e) => ETIQUETAS_GENERICAS.includes(e)));
  };

  // Comentarios - Ficha de donante
  // Guarda los datos del donante, el consentimiento (solo si cambió) y las etiquetas genéricas.
  // Si algo falla, se avisa y la ficha queda en modo edición para reintentar.
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

    const errorDonante = await actualizarDonante(donante);
    if (errorDonante) {
      setGuardando(false);
      setError(errorDonante);
      return;
    }

    const anterior = consentimiento ?? SIN_CONSENTIMIENTO;
    if (consentimientoEdit && (
      consentimientoEdit.acepta_cookies !== anterior.acepta_cookies ||
      consentimientoEdit.autoriza_contacto !== anterior.autoriza_contacto
    )) {
      const errorConsentimiento = await registrarConsentimiento(donante.id, consentimientoEdit, anterior, user?.id ?? null);
      if (errorConsentimiento) {
        setGuardando(false);
        setError(errorConsentimiento);
        return;
      }
      setConsentimiento(consentimientoEdit);
    }

    const errorEtiquetas = await reemplazarEtiquetasGenericas(donante.id, etiquetasEdit);
    if (errorEtiquetas) {
      setGuardando(false);
      setError('Los datos se guardaron, pero no se pudieron actualizar las etiquetas: ' + errorEtiquetas);
      return;
    }

    setEtiquetas([...etiquetas.filter((e) => !ETIQUETAS_GENERICAS.includes(e)), ...etiquetasEdit]);
    setGuardando(false);
    setDonanteOriginal(donante);
    setConsentimientoEdit(null);
    setEtiquetasEdit([]);
    setEditando(false);
  };

  const cerrarPanelDonacion = () => {
    setPanelDonacionAbierto(false);
    setFechaDonacion(hoyISO());
    setTipoDonacion('sangre_total');
    setHuboReaccion(false);
    setDetalleReaccion('');
  };

  // Comentarios - Registrar donación
  // Revisa la regla de espera según sexo, registra la donación y relee la ficha con lo que actualizó la base.
  // Las fechas 'AAAA-MM-DD' se comparan como texto, sin pasar por Date, para no desfasarlas por la zona horaria.
  const handleRegistrarDonacion = async () => {
    if (!donante || donante.reaccion_adversa_previa) return;
    setError(null);
    setRegistrandoDonacion(true);

    if (donante.fecha_ultima_donacion) {
      const fechaPermitida = await fechaProximaDonacion(donante.fecha_ultima_donacion, donante.sexo);
      if (!fechaPermitida) {
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

    const errorDonacion = await registrarDonacion({
      donanteId: donante.id,
      fecha: fechaDonacion,
      tipo: tipoDonacion,
      huboReaccion,
      detalleReaccion,
      registradoPor: user?.id ?? null,
    });
    if (errorDonacion) {
      setRegistrandoDonacion(false);
      setError(errorDonacion);
      return;
    }

    const actualizado = await leerEstadoDonacion(donante.id);
    setRegistrandoDonacion(false);
    if (!actualizado) {
      setError('Donación registrada, pero no se pudo actualizar la ficha. Recarga la página.');
      return;
    }

    const donanteActualizado = { ...donante, ...actualizado };
    setDonante(donanteActualizado);
    setDonanteOriginal(donanteActualizado);
    cerrarPanelDonacion();
  };

  if (cargando) return <p className={styles.mensajePagina}>Cargando donante...</p>;
  if (!donante) return <p className={`${styles.mensajePagina} ${styles.textoError}`} role="alert">{error ?? 'No se encontró el donante.'}</p>;

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabecera}>
        <button onClick={() => navigate('/donantes')} className={styles.botonVolver}>
          ← Volver a donantes
        </button>
        <h2 className={styles.tituloPagina}>Ficha de donante · {donante.codigo_donante}</h2>
      </div>

      {editando ? (
        <div className={styles.filaNombreEdit}>
          <input
            className={`${styles.inputEdit} ${styles.inputNombre}`}
            value={donante.nombre}
            onChange={(e) => setDonante({ ...donante, nombre: e.target.value })}
            placeholder="Nombre"
          />
          <input
            className={`${styles.inputEdit} ${styles.inputNombre}`}
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
            {editando ? (
              <select
                className={styles.selectEdit}
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
            <span className={styles.valorDato}>{textoUltimaDonacion(donante.fecha_ultima_donacion)}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Etiquetas</span>
            <div className={styles.contenedorEtiquetas}>
              {donante.fenotipo_raro && <Badge texto="Fenotipo raro" color="morado" />}
              {editando ? (
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
              {editando ? (
                <div className={styles.listaEtiquetasEdit}>
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
                    .filter(e => !esEtiquetaDeColumna(e))
                    .map(e => <Badge key={e} texto={e} color="azul" />)
                  }
                  {!donante.fenotipo_raro && !donante.frecuente_plaquetas &&
                    etiquetas.filter(e => !esEtiquetaDeColumna(e)).length === 0 && (
                    <span className={styles.sinDato}>-</span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Observaciones</span>
            {editando ? (
              <textarea
                className={`${styles.inputEdit} ${styles.textareaObservaciones}`}
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
            {editando ? (
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
            {editando ? (
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
            {editando ? (
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
              {editando && consentimientoEdit ? (
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
              {editando && consentimientoEdit ? (
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
        {editando ? (
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
              onClick={() => setPanelDonacionAbierto(true)}
            >
              + Registrar donación
            </button>
            {!donante.reaccion_adversa_previa && (
              <Button texto="Editar donante" onClick={handleEditar} />
            )}
          </div>
        )}
      </div>

      {panelDonacionAbierto && (
        <Modal
          className={styles.modalContenido}
          idTitulo="titulo-registrar-donacion"
          onCerrar={registrandoDonacion ? undefined : cerrarPanelDonacion}
        >
          <div className={styles.modalCabecera}>
            <h2 id="titulo-registrar-donacion">Registrar donación</h2>
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
            <button className={styles.botonCancelar} onClick={cerrarPanelDonacion} disabled={registrandoDonacion}>
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
        </Modal>
      )}
    </div>
  );
}