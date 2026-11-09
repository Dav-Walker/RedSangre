import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { mesesDesde } from '../../utils/fechas';
import styles from './NuevaSolicitudPage.module.css';

// Comentarios - Búsqueda de candidatos
// Milisegundos que se espera después de la última tecla en el fenotipo antes de consultar la base.
const ESPERA_BUSQUEDA_MS = 350;

const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

interface CandidatoRow {
  prioridad: number;
  donante_id: string;
  codigo_donante: string;
  nombre_completo: string;
  grupo_sanguineo: string;
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

// Comentarios - Regla de espera entre donaciones por sexo
// Motivo por el que un candidato no es apto. La espera (3 o 4 meses según sexo) la decide la base.
function motivoNoApto(c: CandidatoRow): string {
  if (!c.disponible) return `En espera (donó hace ${c.meses_desde_ultima_donacion ?? 0} meses)`;
  if (c.asignado_activo) return 'Asignado a otra solicitud';
  if (!c.puede_contactarse) return 'Sin consentimiento de contacto';
  return 'No disponible';
}

function formatearUltimaDonacion(fecha: string | null): string {
  if (!fecha) return 'sin donaciones previas';
  const meses = mesesDesde(fecha);
  if (meses === 0) return 'donó este mes';
  if (meses === 1) return 'donó hace 1 mes';
  return `donó hace ${meses} meses`;
}

export function NuevaSolicitudPage() {
  const navigate = useNavigate();
  const [grupoSanguineo, setGrupoSanguineo] = useState('O-');
  const [fenotipoSearch, setFenotipoSearch] = useState('');
  const [urgencia, setUrgencia] = useState('media');
  const [candidatos, setCandidatos] = useState<CandidatoRow[]>([]);
  const [cargandoCandidatos, setCargandoCandidatos] = useState(false);
  const [candidatoSeleccionado, setCandidatoSeleccionado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comentarios - Búsqueda de candidatos
  // Consulta los candidatos compatibles tras una pausa al escribir el fenotipo. Si cambian los filtros antes de
  // que llegue la respuesta, "vigente" la descarta. fn_buscar_donantes_compatibles ya excluye a los donantes
  // bloqueados por reacción adversa.
  useEffect(() => {
    if (!supabase || !grupoSanguineo) return;
    let vigente = true;

    const temporizador = window.setTimeout(async () => {
      setCargandoCandidatos(true);
      setCandidatoSeleccionado(null);
      setError(null);

      const { data, error: err } = await supabase!.rpc('fn_buscar_donantes_compatibles', {
        p_grupo_requerido: grupoSanguineo,
        p_fenotipo_requerido: fenotipoSearch.trim() || null,
        p_limite: 20,
      });
      if (!vigente) return;

      setCargandoCandidatos(false);
      if (err) {
        setError('Error al buscar candidatos: ' + err.message);
        return;
      }
      setCandidatos((data as CandidatoRow[]) ?? []);
    }, ESPERA_BUSQUEDA_MS);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
    };
  }, [grupoSanguineo, fenotipoSearch]);

  const handleCrearSolicitud = async () => {
    if (!candidatoSeleccionado || !supabase) return;

    setGuardando(true);
    setError(null);

    const { error: err } = await supabase.from('solicitud').insert({
      grupo_sanguineo_requerido: grupoSanguineo,
      fenotipo_requerido: fenotipoSearch.trim() || null,
      urgencia,
      estado: 'abierta',
      donante_asignado_id: candidatoSeleccionado,
    });

    setGuardando(false);

    if (err) {
      setError('Error al crear la solicitud: ' + err.message);
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

      {error && <div className={styles.mensajeError}>{error}</div>}

      <div className={styles.panelBusqueda}>

        {/* FILA 1: GRUPO SANGUÍNEO Y FENOTIPO */}
        <div className={styles.filaFormulario}>
          <div className={styles.grupoInput}>
            <label className={styles.label}>Grupo sanguíneo</label>
            <div className={styles.selectContenedor}>
              <select
                className={styles.select}
                value={grupoSanguineo}
                onChange={(e) => setGrupoSanguineo(e.target.value)}
              >
                {GRUPOS_SANGUINEOS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <div className={styles.selectIcon}>▼</div>
            </div>
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Fenotipo (búsqueda)</label>
            <input
              className={styles.inputBusqueda}
              type="text"
              placeholder="Ej: K+, Fya-, C+"
              value={fenotipoSearch}
              onChange={(e) => setFenotipoSearch(e.target.value)}
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
                onChange={(e) => setUrgencia(e.target.value)}
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

        {/* LISTA DE CANDIDATOS */}
        {cargandoCandidatos ? (
          <div className={styles.mensajeCargando}>Cargando candidatos...</div>
        ) : candidatos.length === 0 ? (
          <div className={styles.mensajeVacio}>
            No se encontraron donantes con grupo {grupoSanguineo}
            {fenotipoSearch.trim() ? ` y fenotipo que contenga "${fenotipoSearch}"` : ''}.
          </div>
        ) : (
          candidatos.map((candidato, index) => {
            const disponible = candidato.apto;
            return (
              <div
                key={candidato.donante_id}
                className={[
                  styles.tarjetaCandidato,
                  disponible ? styles.disponible : styles.noDisponible,
                  candidatoSeleccionado === candidato.donante_id ? styles.seleccionado : '',
                ].join(' ')}
                onClick={() => {
                  if (disponible) setCandidatoSeleccionado(candidato.donante_id);
                }}
              >
                <div className={styles.numeroRanking}>{candidato.prioridad ?? index + 1}</div>

                <div className={styles.infoCandidato}>
                  <span className={styles.nombreCandidato}>
                    {candidato.nombre_completo}
                  </span>
                  <span className={styles.detallesCandidato}>
                    {candidato.grupo_sanguineo} ({candidato.compatibilidad}) · {formatearUltimaDonacion(candidato.fecha_ultima_donacion)}
                    {candidato.fenotipo ? ` · ${candidato.fenotipo}` : ''}
                    {candidato.distancia_km != null ? ` · ${candidato.distancia_km.toFixed(1)} km de la clínica` : ' · sin ubicación'}
                  </span>
                </div>

                <div>
                  {disponible ? (
                    <span className={styles.badgeDisponible}>Disponible</span>
                  ) : (
                    <span className={styles.badgeNoDisponible}>{motivoNoApto(candidato)}</span>
                  )}
                </div>
              </div>
            );
          })
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
