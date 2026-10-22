import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { supabase } from '../../utils/supabase';
import styles from './SolicitudesListPage.module.css';

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
  const [solicitudesFiltradas, setSolicitudesFiltradas] = useState<Solicitud[]>([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
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
      setSolicitudesFiltradas(lista);
      setCargando(false);
    }

    cargarSolicitudes();
  }, []);

  const handleBuscar = () => {
    const filtrados = solicitudes.filter((sol) => {
      const codigoStr = String(sol.codigo_solicitud ?? '').toLowerCase();
      const grupoStr = String(sol.grupo_sanguineo_requerido ?? '').toLowerCase();
      const fenotipoStr = String(sol.fenotipo_requerido ?? '').toLowerCase();
      const busqueda = textoBusqueda.toLowerCase();

      return codigoStr.includes(busqueda) || grupoStr.includes(busqueda) || fenotipoStr.includes(busqueda);
    });
    setSolicitudesFiltradas(filtrados);
  };

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
            onChange={(e) => {
              setTextoBusqueda(e.target.value);
              const busqueda = e.target.value.toLowerCase();
              const filtrados = solicitudes.filter((sol) => {
                const codigoStr = String(sol.codigo_solicitud ?? '').toLowerCase();
                const grupoStr = String(sol.grupo_sanguineo_requerido ?? '').toLowerCase();
                const fenotipoStr = String(sol.fenotipo_requerido ?? '').toLowerCase();
                return codigoStr.includes(busqueda) || grupoStr.includes(busqueda) || fenotipoStr.includes(busqueda);
              });
              setSolicitudesFiltradas(filtrados);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          />
          <svg 
            className={styles.iconoLupa} 
            onClick={handleBuscar}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <Button texto="+ Nueva solicitud" onClick={() => navigate('/solicitudes/nueva')} />
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