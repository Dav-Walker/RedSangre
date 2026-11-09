// Comentarios - Listado de donantes
// Tabla paginada de donantes con búsqueda por nombre o RUT y filtros por grupo, fenotipo y etiqueta.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge, type ColorBadge } from '../../components/common/Badge';
import { Paginacion } from '../../components/common/Paginacion';
import { CampoFenotipo } from '../../components/donantes/CampoFenotipo';
import styles from './DonantesListPage.module.css';
import { textoMesesDesde } from '../../utils/fechas';
import { GRUPOS_SANGUINEOS } from '../../utils/gruposSanguineos';
import { ETIQUETAS_DONANTE } from '../../utils/etiquetas';
import { antigenosElegidos, type ValoresFenotipo } from '../../utils/fenotipo';
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
  // Comentarios - Búsqueda por fenotipo
  // Antígenos elegidos en el popup de tipificación. Se aplican al guardar el popup, sin esperar al teclado.
  const [filtroFenotipo, setFiltroFenotipo] = useState<ValoresFenotipo>({});
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  // Comentarios - Búsqueda de donantes
  // Texto que realmente se consulta. Se copia desde el buscador tras una pausa al escribir,
  // o de inmediato con Enter o la lupa, para no consultar la base en cada tecla.
  const [busquedaAplicada, setBusquedaAplicada] = useState('');

  // Comentarios - Búsqueda de donantes
  // Cada combinación de filtros tiene una clave. El resultado guarda la clave con que se pidió:
  // si no coincide con la actual, la consulta sigue en curso (cargando).
  const filtros: FiltrosDonantes = {
    pagina: paginaActual, porPagina, grupo: filtroGrupo,
    antigenos: antigenosElegidos(filtroFenotipo), etiqueta: filtroEtiqueta, busqueda: busquedaAplicada,
  };
  const claveConsulta = JSON.stringify(filtros);
  const [resultado, setResultado] = useState<ResultadoDonantes & { clave: string } | null>(null);
  const cargando = resultado?.clave !== claveConsulta;
  const donantes = resultado?.donantes ?? [];
  const totalDonantes = resultado?.total ?? 0;
  const error = resultado?.error ?? null;

  const totalPaginas = Math.max(1, Math.ceil(totalDonantes / porPagina));

  useEffect(() => {
    const temporizador = window.setTimeout(() => setBusquedaAplicada(textoBusqueda.trim()), ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(temporizador);
  }, [textoBusqueda]);

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
  };

  const handleLimpiarFiltros = () => {
    setTextoBusqueda('');
    setFiltroGrupo('');
    setFiltroFenotipo({});
    setFiltroEtiqueta('');
    setBusquedaAplicada('');
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
      <div className={styles.filtros}>
        <select
          value={filtroGrupo}
          onChange={(e) => { setFiltroGrupo(e.target.value as GrupoSanguineo | ''); setPaginaActual(1); }}
          className={styles.controlFiltro}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <CampoFenotipo
          valores={filtroFenotipo}
          onCambiar={(valores) => { setFiltroFenotipo(valores); setPaginaActual(1); }}
        />

        <select
          value={filtroEtiqueta}
          onChange={(e) => { setFiltroEtiqueta(e.target.value); setPaginaActual(1); }}
          className={styles.controlFiltro}
        >
          <option value="">Todas las etiquetas</option>
          {ETIQUETAS_DONANTE.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {(filtroGrupo || filtros.antigenos.length > 0 || filtroEtiqueta || textoBusqueda) && (
          <button
            onClick={handleLimpiarFiltros}
            className={styles.botonLimpiar}
          >
            ✕ Limpiar filtros
          </button>
        )}

        <span className={styles.contador}>
          {cargando ? 'Cargando...' : `${totalDonantes} donante${totalDonantes !== 1 ? 's' : ''} encontrado${totalDonantes !== 1 ? 's' : ''}`}
        </span>
      </div>

      {error && <p className={styles.mensajeError} role="alert">{error}</p>}

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
              <tr><td colSpan={8} className={styles.celdaMensaje}>Cargando donantes...</td></tr>
            ) : donantes.length === 0 ? (
              <tr><td colSpan={8} className={styles.celdaMensaje}>No se encontraron donantes</td></tr>
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
                        <span className={styles.sinDato}>-</span>
                      )}
                    </td>
                    <td>{donante.fecha_ultima_donacion ? textoMesesDesde(donante.fecha_ultima_donacion) : '-'}</td>
                    <td
                      className={`${styles.celdaObservaciones} ${donante.observaciones ? '' : styles.sinDato}`}
                      title={donante.observaciones || ''}
                    >
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
        <Paginacion
          pagina={paginaActual}
          totalPaginas={totalPaginas}
          porPagina={porPagina}
          opciones={OPCIONES_POR_PAGINA}
          onCambiarPagina={setPaginaActual}
          onCambiarPorPagina={(cantidad) => { setPorPagina(cantidad); setPaginaActual(1); }}
        />
      )}
    </div>
  );
}