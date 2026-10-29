import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { supabase } from '../../utils/supabase';
import { ESTADOS_SOLICITUD, obtenerEstadoSolicitud } from '../../utils/estadosSolicitud';
import styles from './SolicitudesListPage.module.css';

const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

interface Solicitud {
  id: string | number;
  codigo_solicitud?: string;
  grupo_sanguineo_requerido?: string;
  fenotipo_requerido?: string;
  urgencia?: string;
  estado?: string;
  donante_asignado_id?: string | null;
  [key: string]: any;
}

export function SolicitudesListPage() {
  const navigate = useNavigate();

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fechaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function cargarSolicitudes() {
      setCargando(true);
      setError(null);

      const { data, error: err } = await supabase!
        .from('solicitud')
        .select('*, donante:donante_asignado_id (codigo_donante, nombre, apellido)');

      if (err) {
        setError('Error al cargar las solicitudes: ' + err.message);
        setCargando(false);
        return;
      }

      const lista = data ?? [];

      const ORDEN_ESTADO: Record<string, number> = { abierta: 0, en_proceso: 1, cerrada: 2 };
      const ORDEN_URGENCIA: Record<string, number> = { emergencia_vital: 0, alta: 1, media: 2, baja: 3 };

      lista.sort((a, b) => {
        const estA = ORDEN_ESTADO[obtenerEstadoSolicitud(a.estado)] ?? 1;
        const estB = ORDEN_ESTADO[obtenerEstadoSolicitud(b.estado)] ?? 1;
        if (estA !== estB) return estA - estB;

        const urgA = ORDEN_URGENCIA[a.urgencia ?? ''] ?? 4;
        const urgB = ORDEN_URGENCIA[b.urgencia ?? ''] ?? 4;
        return urgA - urgB;
      });

      setSolicitudes(lista);
      setCargando(false);
    }

    cargarSolicitudes();
  }, []);

  const solicitudesFiltradas = useMemo(() => {
    const busqueda = textoBusqueda.trim().toLowerCase();
    return solicitudes.filter((sol) => {
      if (busqueda) {
        const coincide =
          String(sol.codigo_solicitud ?? '').toLowerCase().includes(busqueda) ||
          String(sol.grupo_sanguineo_requerido ?? '').toLowerCase().includes(busqueda) ||
          String(sol.fenotipo_requerido ?? '').toLowerCase().includes(busqueda);
        if (!coincide) return false;
      }
      if (grupoFiltro && sol.grupo_sanguineo_requerido !== grupoFiltro) return false;
      if (estadoFiltro && sol.estado !== estadoFiltro) return false;
      if (fechaFiltro) {
        if (!sol.created_at) return false;
        const f = new Date(sol.created_at);
        const fechaLocal = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
        if (fechaLocal !== fechaFiltro) return false;
      }
      return true;
    });
  }, [solicitudes, textoBusqueda, grupoFiltro, estadoFiltro, fechaFiltro]);

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabecera}>
        <div className={styles.buscadorContenedor}>
          <input
            type="text"
            placeholder="Buscar por código, grupo o fenotipo..."
            className={styles.inputBuscador}
            value={textoBusqueda}
            onChange={(e) => setTextoBusqueda(e.target.value)}
          />
          <svg
            className={styles.iconoLupa}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <Button texto="+ Nueva solicitud" onClick={() => navigate('/solicitudes/nueva')} />
      </div>

      <div className={styles.filtros}>
        <select
          className={styles.controlFiltro}
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          className={styles.controlFiltro}
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_SOLICITUD).map(([valor, { texto }]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>

        <div className={styles.grupoFecha}>
          <button
            type="button"
            className={`${styles.controlFiltro} ${styles.botonFecha} ${fechaFiltro ? '' : styles.botonFechaVacio}`}
            onClick={() => fechaRef.current?.showPicker()}
          >
            <span>{fechaFiltro ? fechaFiltro.split('-').reverse().join('-') : 'Fecha'}</span>
            <span className={styles.flechaFecha}>▼</span>
          </button>
          <input
            ref={fechaRef}
            type="date"
            className={styles.fechaOculta}
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            tabIndex={-1}
          />
        </div>

        {(grupoFiltro || estadoFiltro || fechaFiltro || textoBusqueda) && (
          <button
            type="button"
            className={styles.botonLimpiar}
            onClick={() => { setTextoBusqueda(''); setGrupoFiltro(''); setEstadoFiltro(''); setFechaFiltro(''); }}
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Id solicitud</th>
              <th>Tipo requerido</th>
              <th>Fenotipo</th>
              <th>Urgencia</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th>Candidato asignado</th>
              <th>Fecha de creación</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                  Cargando solicitudes desde la base de datos...
                </td>
              </tr>
            ) : solicitudesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                  No se encontraron solicitudes registradas.
                </td>
              </tr>
            ) : (
              solicitudesFiltradas.map((sol) => {
                const idMostrado = sol.codigo_solicitud ?? sol.id;
                const estado = ESTADOS_SOLICITUD[obtenerEstadoSolicitud(sol.estado)];

                return (
                  <tr
                    key={sol.id}
                    onClick={() => navigate('/solicitudes/' + idMostrado)}
                    className={styles.fila}
                  >
                    <td>{idMostrado}</td>
                    <td style={{ color: '#333', fontWeight: 'bold' }}>{sol.grupo_sanguineo_requerido || '-'}</td>
                    <td>{sol.fenotipo_requerido || '-'}</td>
                    <td>{sol.urgencia || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge texto={estado.texto} color={estado.color} />
                    </td>
                    <td>{sol.donante ? `${sol.donante.nombre} ${sol.donante.apellido}` : 'Sin asignar'}</td>
                    <td>{sol.created_at ? new Date(sol.created_at).toLocaleDateString('es-CL') : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
