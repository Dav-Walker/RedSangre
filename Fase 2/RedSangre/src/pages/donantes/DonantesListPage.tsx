import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './DonantesListPage.module.css';
import { supabase } from '../../utils/supabase';

interface Donante {
  codigo_donante: string;
  rut: string;
  nombre: string;
  apellido: string;
  grupo_sanguineo: string;
  fenotipo: string | null;
  fenotipo_raro: boolean;
  frecuente_plaquetas: boolean;
  fecha_ultima_donacion: string | null;
}

const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const OPCIONES_POR_PAGINA = [10, 25, 50, 100];

function calcularUltimaDonacion(fecha: string | null): string {
  if (!fecha) return '-';
  const hoy = new Date();
  const donacion = new Date(fecha);
  const meses = (hoy.getFullYear() - donacion.getFullYear()) * 12 + (hoy.getMonth() - donacion.getMonth());
  if (meses === 0) return 'este mes';
  if (meses === 1) return 'hace 1 mes';
  return `hace ${meses} meses`;
}

export function DonantesListPage() {
  const navigate = useNavigate();
  const [donantes, setDonantes] = useState<Donante[]>([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroFenotipo, setFiltroFenotipo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [totalDonantes, setTotalDonantes] = useState(0);

  const totalPaginas = Math.max(1, Math.ceil(totalDonantes / porPagina));

  const cargarDonantes = useCallback(async () => {
    setCargando(true);
    setError(null);

    let query = supabase!
      .from('donante')
      .select('codigo_donante, rut, nombre, apellido, grupo_sanguineo, fenotipo, fenotipo_raro, frecuente_plaquetas, fecha_ultima_donacion', { count: 'exact' })
      .order('codigo_donante', { ascending: false });

    if (filtroGrupo) query = query.eq('grupo_sanguineo', filtroGrupo);
    if (filtroFenotipo) query = query.ilike('fenotipo', `%${filtroFenotipo}%`);
    if (textoBusqueda) {
      query = query.or(
        `nombre.ilike.%${textoBusqueda}%,apellido.ilike.%${textoBusqueda}%,rut.ilike.%${textoBusqueda}%`
      );
    }

    const from = (paginaActual - 1) * porPagina;
    const to = from + porPagina - 1;
    query = query.range(from, to);

    const { data, error: err, count } = await query;

    if (err) {
      setError('No se pudieron cargar los donantes.');
    } else {
      setDonantes(data || []);
      setTotalDonantes(count || 0);
    }
    setCargando(false);
  }, [paginaActual, porPagina, filtroGrupo, filtroFenotipo, textoBusqueda]);

  useEffect(() => {
    cargarDonantes();
  }, [cargarDonantes]);

  const handleBuscar = () => {
    setPaginaActual(1);
    cargarDonantes();
  };

  const handleLimpiarFiltros = () => {
    setTextoBusqueda('');
    setFiltroGrupo('');
    setFiltroFenotipo('');
    setPaginaActual(1);
  };

  return (
    <div className={styles.contenedor}>
      {/* CABECERA */}
      <div className={styles.cabecera}>
        <div className={styles.buscadorContenedor}>
          <input
            type="text"
            placeholder="Buscar por nombre o rut..."
            className={styles.inputBuscador}
            value={textoBusqueda}
            onChange={(e) => { setTextoBusqueda(e.target.value); setPaginaActual(1); }}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          />
          <svg
            className={styles.iconoLupa}
            onClick={handleBuscar}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <Button texto="+ Nuevo donante" onClick={() => navigate('/donantes/nuevo')} />
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filtroGrupo}
          onChange={(e) => { setFiltroGrupo(e.target.value); setPaginaActual(1); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer' }}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <input
          type="text"
          placeholder="Buscar fenotipo (ej: dCe/dce)"
          value={filtroFenotipo}
          onChange={(e) => { setFiltroFenotipo(e.target.value); setPaginaActual(1); }}
          onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', minWidth: '220px' }}
        />

        {(filtroGrupo || filtroFenotipo || textoBusqueda) && (
          <button
            onClick={handleLimpiarFiltros}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontSize: '13px' }}
          >
            ✕ Limpiar filtros
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          {cargando ? 'Cargando...' : `${totalDonantes} donante${totalDonantes !== 1 ? 's' : ''} encontrado${totalDonantes !== 1 ? 's' : ''}`}
        </span>
      </div>

      {error && <p style={{ textAlign: 'center', color: 'red', padding: '20px' }}>{error}</p>}

      {/* TABLA */}
      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Id donante</th>
              <th>Rut</th>
              <th className={styles.thNombre}>Nombre</th>
              <th>Grupo</th>
              <th>Fenotipo</th>
              <th>Etiqueta</th>
              <th>Última donación</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>Cargando donantes...</td></tr>
            ) : donantes.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>No se encontraron donantes</td></tr>
            ) : (
              donantes.map((donante, index) => {
                const etiqueta = donante.fenotipo_raro ? 'Fenotipo raro' : donante.frecuente_plaquetas ? 'Plaquetas' : null;
                const colorEtiqueta = donante.fenotipo_raro ? 'morado' : 'azul';
                return (
                  <tr
                    key={donante.codigo_donante}
                    onClick={() => navigate('/donantes/' + donante.codigo_donante)}
                    className={`${styles.fila} ${index === donantes.length - 1 ? styles.sinBorde : ''}`}
                  >
                    <td>{donante.codigo_donante}</td>
                    <td>{donante.rut}</td>
                    <td className={styles.tdNombre}>{donante.nombre} {donante.apellido}</td>
                    <td>{donante.grupo_sanguineo}</td>
                    <td>{donante.fenotipo || '-'}</td>
                    <td>
                      {etiqueta ? (
                        <Badge texto={etiqueta} color={colorEtiqueta as any} />
                      ) : (
                        <span style={{ color: '#aaa' }}>-</span>
                      )}
                    </td>
                    <td>{calcularUltimaDonacion(donante.fecha_ultima_donacion)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      {!cargando && !error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#555' }}>
            <span>Mostrar</span>
            <select
              value={porPagina}
              onChange={(e) => { setPorPagina(Number(e.target.value)); setPaginaActual(1); }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer' }}
            >
              {OPCIONES_POR_PAGINA.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>por página</span>
          </div>

          <span style={{ fontSize: '14px', color: '#555' }}>
            Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong>
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPaginaActual(1)}
              disabled={paginaActual === 1}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ddd', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.4 : 1, fontSize: '14px' }}
            >«</button>
            <button
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.4 : 1, fontSize: '14px' }}
            >‹ Anterior</button>
            <button
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.4 : 1, fontSize: '14px' }}
            >Siguiente ›</button>
            <button
              onClick={() => setPaginaActual(totalPaginas)}
              disabled={paginaActual === totalPaginas}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ddd', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.4 : 1, fontSize: '14px' }}
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}