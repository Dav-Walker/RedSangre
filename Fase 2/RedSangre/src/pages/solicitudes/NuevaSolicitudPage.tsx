// Comentarios - Nueva solicitud
// Busca donantes compatibles priorizados por la base y crea la solicitud con el candidato elegido.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paginacion } from '../../components/common/Paginacion';
import { CampoFenotipo } from '../../components/donantes/CampoFenotipo';
import { textoMesesDesde } from '../../utils/fechas';
import { GRUPOS_SANGUINEOS } from '../../utils/gruposSanguineos';
import { textoFenotipo, type ValoresFenotipo } from '../../utils/fenotipo';
import { buscarCandidatos, crearSolicitud, MAXIMO_CANDIDATOS, type Candidato } from '../../servicios/solicitudes';
import type { GrupoSanguineo, Urgencia } from '../../tipos/dominio';
import styles from './NuevaSolicitudPage.module.css';

// Comentarios - Tabla de candidatos
// Cantidades por página que se pueden elegir: de 10 en 10 hasta 100 (el tope de candidatos de la base).
const OPCIONES_POR_PAGINA = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Comentarios - Regla de espera entre donaciones por sexo
// Motivo por el que un candidato no es apto. La espera (3 o 4 meses según sexo) la decide la base.
function motivoNoApto(c: Candidato): string {
  if (!c.disponible) return `En espera (donó hace ${c.meses_desde_ultima_donacion ?? 0} meses)`;
  if (c.asignado_activo) return 'Asignado a otra solicitud';
  if (!c.puede_contactarse) return 'Sin consentimiento de contacto';
  return 'No disponible';
}

// Comentarios - Tabla de candidatos
// Texto de la última donación del candidato, por ejemplo "hace 4 meses".
function formatearUltimaDonacion(fecha: string | null): string {
  return fecha ? textoMesesDesde(fecha) : 'Sin donaciones';
}

interface ResultadoCandidatos {
  clave: string;
  candidatos: Candidato[];
  error: string | null;
}

export function NuevaSolicitudPage() {
  const navigate = useNavigate();
  const [grupoSanguineo, setGrupoSanguineo] = useState<GrupoSanguineo>('O-');
  // Comentarios - Búsqueda por fenotipo
  // Antígenos elegidos en el popup de tipificación; se buscan y se guardan como "C+, K-".
  const [valoresFenotipo, setValoresFenotipo] = useState<ValoresFenotipo>({});
  const fenotipoRequerido = textoFenotipo(valoresFenotipo);
  const [urgencia, setUrgencia] = useState<Urgencia>('media');
  const [candidatoSeleccionado, setCandidatoSeleccionado] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [guardando, setGuardando] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState<string | null>(null);

  // Comentarios - Búsqueda de candidatos
  // La base devuelve hasta 100 candidatos ya priorizados; la tabla los pagina en pantalla.
  // El resultado guarda la búsqueda (grupo y fenotipo) con que se pidió: si no coincide, sigue cargando.
  const claveConsulta = JSON.stringify([grupoSanguineo, fenotipoRequerido]);
  const [resultado, setResultado] = useState<ResultadoCandidatos | null>(null);
  const cargandoCandidatos = resultado?.clave !== claveConsulta;
  const candidatos = cargandoCandidatos ? [] : resultado.candidatos;
  const error = errorCreacion ?? (cargandoCandidatos ? null : resultado.error);
  const totalPaginas = Math.max(1, Math.ceil(candidatos.length / porPagina));
  const candidatosPagina = candidatos.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  // Comentarios - Búsqueda de candidatos
  // "vigente" descarta la respuesta si el grupo o el fenotipo cambiaron mientras se esperaba.
  useEffect(() => {
    let vigente = true;
    const [grupo, fenotipo] = JSON.parse(claveConsulta) as [GrupoSanguineo, string];
    void buscarCandidatos(grupo, fenotipo).then((r) => {
      if (vigente) setResultado({ clave: claveConsulta, ...r });
    });
    return () => { vigente = false; };
  }, [claveConsulta]);

  // Comentarios - Búsqueda de candidatos
  // Al cambiar la búsqueda se vuelve a la primera página y se quita el candidato elegido.
  const reiniciarSeleccion = () => {
    setCandidatoSeleccionado(null);
    setPaginaActual(1);
    setErrorCreacion(null);
  };

  const handleCrearSolicitud = async () => {
    if (!candidatoSeleccionado) return;

    setGuardando(true);
    setErrorCreacion(null);

    const errorAlCrear = await crearSolicitud({
      grupo: grupoSanguineo,
      fenotipo: fenotipoRequerido,
      urgencia,
      donanteId: candidatoSeleccionado,
    });

    setGuardando(false);

    if (errorAlCrear) {
      setErrorCreacion(errorAlCrear);
      return;
    }

    navigate('/solicitudes');
  };

  return (
    <div className={styles.contenedor}>

      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/solicitudes')}>
          ← Volver a solicitudes
        </button>
        <h2 className={styles.tituloCentral}>Nueva solicitud</h2>
      </div>

      <h1 className={styles.tituloPrincipal}>Buscar donante compatible</h1>

      {error && <div className={styles.mensajeError} role="alert">{error}</div>}

      <div className={styles.panelBusqueda}>

        {/* FILA 1: GRUPO SANGUÍNEO Y FENOTIPO */}
        <div className={styles.filaFormulario}>
          <div className={styles.grupoInput}>
            <label className={styles.label}>Grupo sanguíneo</label>
            <div className={styles.selectContenedor}>
              <select
                className={styles.select}
                value={grupoSanguineo}
                onChange={(e) => { setGrupoSanguineo(e.target.value as GrupoSanguineo); reiniciarSeleccion(); }}
              >
                {GRUPOS_SANGUINEOS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <div className={styles.selectIcon}>▼</div>
            </div>
          </div>

          <div className={styles.grupoInput}>
            <span className={styles.label}>Fenotipo (búsqueda)</span>
            <CampoFenotipo
              valores={valoresFenotipo}
              onCambiar={(valores) => { setValoresFenotipo(valores); reiniciarSeleccion(); }}
            />
          </div>
        </div>

        {/* FILA 2: URGENCIA */}
        <div className={styles.filaFormulario}>
          <div className={styles.grupoInput}>
            <label className={styles.label}>Nivel de urgencia</label>
            <div className={styles.selectContenedor}>
              <select
                className={styles.select}
                value={urgencia}
                onChange={(e) => setUrgencia(e.target.value as Urgencia)}
              >
                <option value="baja">Baja (Programada)</option>
                <option value="media">Media (24 a 48 hrs)</option>
                <option value="alta">Alta (Menos de 24 hrs)</option>
              </select>
              <div className={styles.selectIcon}>▼</div>
            </div>
          </div>
          <div className={styles.grupoInput} />
        </div>

        <div className={styles.subtituloCandidatos}>
          Candidatos priorizados (Desde Clínica INDISA, Providencia)
        </div>

        {/* Comentarios - Tabla de candidatos */}
        {/* Clic en una fila apta para elegir al candidato. Las no aptas se ven atenuadas y muestran el motivo. */}
        <div className={styles.tablaContenedor}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>#</th>
                <th>Donante</th>
                <th>Grupo</th>
                <th>Fenotipo</th>
                <th>Última donación</th>
                <th>Distancia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargandoCandidatos ? (
                <tr><td colSpan={7} className={styles.celdaMensaje}>Cargando candidatos...</td></tr>
              ) : candidatos.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.celdaMensaje}>
                    No se encontraron donantes con grupo {grupoSanguineo}
                    {fenotipoRequerido ? ` y fenotipo ${fenotipoRequerido}` : ''}.
                  </td>
                </tr>
              ) : (
                candidatosPagina.map((candidato) => {
                  const seleccionado = candidatoSeleccionado === candidato.donante_id;
                  return (
                    <tr
                      key={candidato.donante_id}
                      className={[
                        styles.fila,
                        candidato.apto ? styles.filaApta : styles.filaNoApta,
                        seleccionado ? styles.filaSeleccionada : '',
                      ].join(' ')}
                      onClick={() => { if (candidato.apto) setCandidatoSeleccionado(candidato.donante_id); }}
                      aria-selected={seleccionado}
                    >
                      <td className={styles.celdaPrioridad}>{candidato.prioridad}</td>
                      <td>
                        <span className={styles.nombreCandidato}>{candidato.nombre_completo}</span>
                        <span className={styles.codigoCandidato}>{candidato.codigo_donante}</span>
                      </td>
                      <td>{candidato.grupo_sanguineo} ({candidato.compatibilidad})</td>
                      <td>{candidato.fenotipo || '-'}</td>
                      <td>{formatearUltimaDonacion(candidato.fecha_ultima_donacion)}</td>
                      <td>{candidato.distancia_km != null ? `${candidato.distancia_km.toFixed(1)} km` : 'Sin ubicación'}</td>
                      <td>
                        {candidato.apto ? (
                          <span className={styles.badgeDisponible}>{seleccionado ? '✓ Elegido' : 'Disponible'}</span>
                        ) : (
                          <span className={styles.badgeNoDisponible}>{motivoNoApto(candidato)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!cargandoCandidatos && candidatos.length > 0 && (
          <>
            {candidatos.length >= MAXIMO_CANDIDATOS && (
              <p className={styles.avisoTope}>Se muestran los {MAXIMO_CANDIDATOS} mejores candidatos según la prioridad de la base.</p>
            )}
            <Paginacion
              pagina={paginaActual}
              totalPaginas={totalPaginas}
              porPagina={porPagina}
              opciones={OPCIONES_POR_PAGINA}
              onCambiarPagina={setPaginaActual}
              onCambiarPorPagina={(cantidad) => { setPorPagina(cantidad); setPaginaActual(1); }}
            />
          </>
        )}

      </div>

      <button
        className={styles.botonGuardar}
        disabled={!candidatoSeleccionado || guardando}
        onClick={handleCrearSolicitud}
      >
        {guardando ? 'Creando solicitud...' : 'Crear solicitud con candidato'}
      </button>

    </div>
  );
}
