import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/useAuth';
import styles from './NuevaSolicitudPage.module.css';

const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

interface CandidatoRow {
  id: string;
  codigo_donante: string;
  nombre: string;
  apellido: string;
  grupo_sanguineo: string;
  fenotipo: string | null;
  fecha_ultima_donacion: string | null;
  ubicacion: string | null;
  reaccion_adversa_previa: boolean;
}

function esDisponible(c: CandidatoRow): boolean {
  if (c.reaccion_adversa_previa) return false;
  if (!c.fecha_ultima_donacion) return true;
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
  return new Date(c.fecha_ultima_donacion) <= tresMesesAtras;
}

function formatearUltimaDonacion(fecha: string | null): string {
  if (!fecha) return 'sin donaciones previas';
  const hoy = new Date();
  const d = new Date(fecha);
  const meses = (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
  if (meses === 0) return 'donó este mes';
  if (meses === 1) return 'donó hace 1 mes';
  return `donó hace ${meses} meses`;
}

export function NuevaSolicitudPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [grupoSanguineo, setGrupoSanguineo] = useState('O-');
  const [fenotipoSearch, setFenotipoSearch] = useState('');
  const [urgencia, setUrgencia] = useState('Media');
  const [candidatos, setCandidatos] = useState<CandidatoRow[]>([]);
  const [cargandoCandidatos, setCargandoCandidatos] = useState(false);
  const [candidatoSeleccionado, setCandidatoSeleccionado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !grupoSanguineo) return;

    setCargandoCandidatos(true);
    setCandidatoSeleccionado(null);
    setError(null);

    supabase
      .from('donante')
      .select('id, codigo_donante, nombre, apellido, grupo_sanguineo, fenotipo, fecha_ultima_donacion, ubicacion, reaccion_adversa_previa')
      .eq('grupo_sanguineo', grupoSanguineo)
      .then(({ data, error: err }) => {
        setCargandoCandidatos(false);
        if (err) {
          setError('Error al cargar candidatos: ' + err.message);
          return;
        }
        setCandidatos(data ?? []);
      });
  }, [grupoSanguineo]);

  const candidatosFiltrados = fenotipoSearch.trim()
    ? candidatos.filter(c =>
        c.fenotipo?.toLowerCase().includes(fenotipoSearch.trim().toLowerCase())
      )
    : candidatos;

  const candidatosOrdenados = [...candidatosFiltrados].sort((a, b) => {
    const aDisp = esDisponible(a);
    const bDisp = esDisponible(b);
    if (aDisp && !bDisp) return -1;
    if (!aDisp && bDisp) return 1;
    return 0;
  });

  const handleCrearSolicitud = async () => {
    if (!candidatoSeleccionado || !supabase) return;

    setGuardando(true);
    setError(null);

    const payload: Record<string, unknown> = {
      grupo_sanguineo_requerido: grupoSanguineo,
      fenotipo_requerido: fenotipoSearch.trim() || null,
      urgencia,
      estado: 'Abierta',
      donante_asignado_id: candidatoSeleccionado,
    };

    if (user?.id) payload.registrado_por = user.id;

    const { error: err } = await supabase.from('solicitud').insert(payload);

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
                <option value="Baja">Baja (Programada)</option>
                <option value="Media">Media (24 a 48 hrs)</option>
                <option value="Alta">Alta (Menos de 24 hrs)</option>
                <option value="Emergencia vital">Emergencia vital (Inmediata)</option>
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
        ) : candidatosOrdenados.length === 0 ? (
          <div className={styles.mensajeVacio}>
            No se encontraron donantes con grupo {grupoSanguineo}
            {fenotipoSearch.trim() ? ` y fenotipo que contenga "${fenotipoSearch}"` : ''}.
          </div>
        ) : (
          candidatosOrdenados.map((candidato, index) => {
            const disponible = esDisponible(candidato);
            return (
              <div
                key={candidato.id}
                className={[
                  styles.tarjetaCandidato,
                  disponible ? styles.disponible : styles.noDisponible,
                  candidatoSeleccionado === candidato.id ? styles.seleccionado : '',
                ].join(' ')}
                onClick={() => {
                  if (disponible) setCandidatoSeleccionado(candidato.id);
                }}
              >
                <div className={styles.numeroRanking}>{index + 1}</div>

                <div className={styles.infoCandidato}>
                  <span className={styles.nombreCandidato}>
                    {candidato.nombre} {candidato.apellido}
                  </span>
                  <span className={styles.detallesCandidato}>
                    {candidato.grupo_sanguineo} · {formatearUltimaDonacion(candidato.fecha_ultima_donacion)}
                    {candidato.ubicacion ? ` · ${candidato.ubicacion}` : ''}
                    {candidato.fenotipo ? ` · ${candidato.fenotipo}` : ''}
                  </span>
                </div>

                <div>
                  {disponible ? (
                    <span className={styles.badgeDisponible}>Disponible</span>
                  ) : (
                    <span className={styles.badgeNoDisponible}>
                      {candidato.reaccion_adversa_previa ? 'Reacción adversa' : 'No disponible'}
                    </span>
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
