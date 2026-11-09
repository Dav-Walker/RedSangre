import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge, type ColorBadge } from '../../components/common/Badge';
import styles from './DonantesListPage.module.css';
import { textoMesesDesde } from '../../utils/fechas';
import { GRUPOS_SANGUINEOS } from '../../utils/gruposSanguineos';
import { ETIQUETAS_DONANTE } from '../../utils/etiquetas';
import { consultarDonantes, type FiltrosDonantes, type ResultadoDonantes } from '../../servicios/donantes';
import type { GrupoSanguineo } from '../../tipos/dominio';

// Comentarios - Búsqueda de donantes
// Milisegundos que se espera después de la última tecla antes de consultar la base.
const ESPERA_BUSQUEDA_MS = 350;
const OPCIONES_POR_PAGINA = [10, 25, 50, 100];

export function DonantesListPage() {
  const navigate = useNavigate();
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoSanguineo | ''>('');
  const [filtroFenotipo, setFiltroFenotipo] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  // Comentarios - Búsqueda de donantes
  // Textos que realmente se consultan. Se copian desde los campos tras una pausa al escribir,
  // o de inmediato con Enter o la lupa, para no consultar la base en cada tecla.
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [fenotipoAplicado, setFenotipoAplicado] = useState('');

  // Comentarios - Búsqueda de donantes
  // Cada combinación de filtros tiene una clave. El resultado guarda la clave con que se pidió:
  // si no coincide con la actual, la consulta sigue en curso (cargando).
  const filtros: FiltrosDonantes = {
    pagina: paginaActual, porPagina, grupo: filtroGrupo,
    fenotipo: fenotipoAplicado, etiqueta: filtroEtiqueta, busqueda: busquedaAplicada,
  };
  const claveConsulta = JSON.stringify(filtros);
  const [resultado, setResultado] = useState<ResultadoDonantes & { clave: string } | null>(null);
  const cargando = resultado?.clave !== claveConsulta;
  const donantes = resultado?.donantes ?? [];
  const totalDonantes = resultado?.total ?? 0;
  const error = resultado?.error ?? null;

  const totalPaginas = Math.max(1, Math.ceil(totalDonantes / porPagina));

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setBusquedaAplicada(textoBusqueda.trim());
      setFenotipoAplicado(filtroFenotipo.trim());
    }, ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(temporizador);
  }, [textoBusqueda, filtroFenotipo]);

  // Comentarios - Búsqueda de donantes
  // Consulta cuando cambia la clave. "vigente" descarta la respuesta si los filtros cambiaron mientras tanto.
  useEffect(() => {
    let vigente = true;
    void consultarDonantes(JSON.parse(claveConsulta) as FiltrosDonantes).then((r) => {
      if (vigente) setResultado({ ...r, clave: claveConsulta });
    });
    return () => { vigente = false; };
  }, [claveConsulta]);

  // Comentarios - Búsqueda de donantes
  // Enter o la lupa aplican la búsqueda de inmediato; el efecto de arriba hace la consulta una sola vez.
  const handleBuscar = () => {
    setPaginaActual(1);
    setBusquedaAplicada(textoBusqueda.trim());
    setFenotipoAplicado(filtroFenotipo.trim());
  };

  const handleLimpiarFiltros = () => {
    setTextoBusqueda('');
    setFiltroGrupo('');
    setFiltroFenotipo('');
    setFiltroEtiqueta('');
    setBusquedaAplicada('');
    setFenotipoAplicado('');
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
          onChange={(e) => { setFiltroGrupo(e.target.value as GrupoSanguineo | ''); setPaginaActual(1); }}
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

        <select
          value={filtroEtiqueta}
          onChange={(e) => { setFiltroEtiqueta(e.target.value); setPaginaActual(1); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer' }}
        >
          <option value="">Todas las etiquetas</option>
          {ETIQUETAS_DONANTE.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {(filtroGrupo || filtroFenotipo || filtroEtiqueta || textoBusqueda) && (
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
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>Cargando donantes...</td></tr>
            ) : donantes.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>No se encontraron donantes</td></tr>
            ) : (
              donantes.map((donante, index) => {
                const etiqueta = donante.fenotipo_raro ? 'Fenotipo raro' : donante.frecuente_plaquetas ? 'Plaquetas' : null;
                const colorEtiqueta: ColorBadge = donante.fenotipo_raro ? 'morado' : 'azul';
                return (
                  <tr
                    key={donante.id}
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
                        <Badge texto={etiqueta} color={colorEtiqueta} />
                      ) : (
                        <span style={{ color: '#aaa' }}>-</span>
                      )}
                    </td>
                    <td>{donante.fecha_ultima_donacion ? textoMesesDesde(donante.fecha_ultima_donacion) : '-'}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: donante.observaciones ? '#333' : '#aaa' }}
                        title={donante.observaciones || ''}>
                      {donante.observaciones || '-'}
                    </td>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#666' }}>
            <span>Mostrar</span>
            <select
              value={porPagina}
              onChange={(e) => { setPorPagina(Number(e.target.value)); setPaginaActual(1); }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', cursor: 'pointer', backgroundColor: '#ffffff', color: '#333333' }}
            >
              {OPCIONES_POR_PAGINA.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>por página</span>
          </div>

          <span style={{ fontSize: '14px', color: '#666' }}>
            Página <strong style={{ color: '#333' }}>{paginaActual}</strong> de <strong style={{ color: '#333' }}>{totalPaginas}</strong>
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPaginaActual(1)}
              disabled={paginaActual === 1}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ccc', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.4 : 1, fontSize: '14px', backgroundColor: '#ffffff', color: '#333333' }}
            >«</button>
            <button
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ccc', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.4 : 1, fontSize: '14px', backgroundColor: '#ffffff', color: '#333333' }}
            >‹ Anterior</button>
            <button
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ccc', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.4 : 1, fontSize: '14px', backgroundColor: '#ffffff', color: '#333333' }}
            >Siguiente ›</button>
            <button
              onClick={() => setPaginaActual(totalPaginas)}
              disabled={paginaActual === totalPaginas}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #ccc', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.4 : 1, fontSize: '14px', backgroundColor: '#ffffff', color: '#333333' }}
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}