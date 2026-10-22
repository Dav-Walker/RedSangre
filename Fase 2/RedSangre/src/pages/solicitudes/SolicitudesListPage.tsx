import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { supabase } from '../../utils/supabase';
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

      // ORDENAR: Las abiertas / en proceso primero, y las cerradas al final
      lista.sort((a, b) => {
        const estA = (a.estado || '').toLowerCase();
        const estB = (b.estado || '').toLowerCase();
        const esCerradaA = estA.includes('cerrada') || estA.includes('completada');
        const esCerradaB = estB.includes('cerrada') || estB.includes('completada');

        if (esCerradaA === esCerradaB) return 0;
        return esCerradaA ? 1 : -1; // Si A está cerrada, va después (1)
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

  const obtenerColorBadge = (estado: string) => {
    const est = (estado || '').toLowerCase();
    if (est.includes('proceso') || est.includes('pendiente')) return 'rojo';
    if (est.includes('cerrada') || est.includes('completada')) return 'gris';
    return 'azul';
  };

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

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
          style={{ boxSizing: 'border-box', height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#333', colorScheme: 'light' }}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          style={{ boxSizing: 'border-box', height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#333', colorScheme: 'light' }}
        >
          <option value="">Todos los estados</option>
          <option value="abierta">Abierta</option>
          <option value="en_proceso">En proceso</option>
          <option value="cerrada">Cerrada</option>
        </select>

        <div style={{ position: 'relative', minWidth: '150px' }}>
          <div style={{ boxSizing: 'border-box', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', background: '#fff', color: fechaFiltro ? '#333' : '#757575', cursor: 'pointer' }}>
            <span>{fechaFiltro ? fechaFiltro.split('-').reverse().join('-') : 'Fecha'}</span>
            <span style={{ fontSize: '10px', color: '#333' }}>▼</span>
          </div>
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', colorScheme: 'light' }}
          />
        </div>

        {(grupoFiltro || estadoFiltro || fechaFiltro || textoBusqueda) && (
          <button
            onClick={() => { setTextoBusqueda(''); setGrupoFiltro(''); setEstadoFiltro(''); setFechaFiltro(''); }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontSize: '13px' }}
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
                const estadoTexto = sol.estado || 'En proceso';
                const colorBadge = obtenerColorBadge(estadoTexto);

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
                      <Badge texto={estadoTexto} color={colorBadge as any} />
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