// Comentarios - Listado de solicitudes
// Tabla de solicitudes con búsqueda y filtros por grupo, estado y fecha de creación.
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Paginacion } from '../../components/common/Paginacion';
import { ESTADOS_SOLICITUD, obtenerEstadoSolicitud } from '../../utils/estadosSolicitud';
import { GRUPOS_SANGUINEOS } from '../../utils/gruposSanguineos';
import { listarSolicitudes, type FiltrosSolicitudes, type ResultadoSolicitudes } from '../../servicios/solicitudes';
import type { EstadoSolicitudBase, GrupoSanguineo } from '../../tipos/dominio';
import styles from './SolicitudesListPage.module.css';
import { useAuth } from '../../contexts/useAuth';
import { puedeEditar } from '../../utils/roles';

// Comentarios - Listado de solicitudes
// Pausa tras la última tecla antes de consultar, y cantidades por página (las mismas que en Donantes).
const ESPERA_BUSQUEDA_MS = 350;
const OPCIONES_POR_PAGINA = [10, 25, 50, 100];

export function SolicitudesListPage() {
  const navigate = useNavigate();
  // Comentarios - Perfil TENS solo lectura
  // TENS ve el listado, pero no el botón para crear solicitudes
  const { user } = useAuth();
  const conEscritura = puedeEditar(user?.rol);

  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState<GrupoSanguineo | ''>('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoSolicitudBase | ''>('');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const fechaRef = useRef<HTMLInputElement>(null);

  // Comentarios - Listado de solicitudes
  // Igual que en Donantes: la base filtra, ordena y devuelve solo la página visible con el total.
  // Cada combinación de filtros tiene una clave; si el resultado guardado es de otra clave, sigue cargando.
  const filtros: FiltrosSolicitudes = {
    pagina: paginaActual, porPagina, busqueda: busquedaAplicada,
    grupo: grupoFiltro, estado: estadoFiltro, fecha: fechaFiltro,
  };
  const claveConsulta = JSON.stringify(filtros);
  const [resultado, setResultado] = useState<ResultadoSolicitudes & { clave: string } | null>(null);
  const cargando = resultado?.clave !== claveConsulta;
  const solicitudes = resultado?.solicitudes ?? [];
  const totalSolicitudes = resultado?.total ?? 0;
  const error = resultado?.error ?? null;
  const totalPaginas = Math.max(1, Math.ceil(totalSolicitudes / porPagina));

  useEffect(() => {
    const temporizador = window.setTimeout(() => setBusquedaAplicada(textoBusqueda.trim()), ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(temporizador);
  }, [textoBusqueda]);

  // Comentarios - Listado de solicitudes
  // Consulta cuando cambia la clave. "vigente" descarta la respuesta si los filtros cambiaron mientras tanto.
  useEffect(() => {
    let vigente = true;
    void listarSolicitudes(JSON.parse(claveConsulta) as FiltrosSolicitudes).then((r) => {
      if (vigente) setResultado({ ...r, clave: claveConsulta });
    });
    return () => { vigente = false; };
  }, [claveConsulta]);

  const handleLimpiarFiltros = () => {
    setTextoBusqueda('');
    setBusquedaAplicada('');
    setGrupoFiltro('');
    setEstadoFiltro('');
    setFechaFiltro('');
    setPaginaActual(1);
  };

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabecera}>
        <div className={styles.buscadorContenedor}>
          <input
            type="text"
            placeholder="Buscar por código o fenotipo..."
            className={styles.inputBuscador}
            value={textoBusqueda}
            onChange={(e) => { setTextoBusqueda(e.target.value); setPaginaActual(1); }}
          />
          <svg
            className={styles.iconoLupa}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {conEscritura && <Button texto="+ Nueva solicitud" onClick={() => navigate('/solicitudes/nueva')} />}
      </div>

      <div className={styles.filtros}>
        <select
          className={styles.controlFiltro}
          value={grupoFiltro}
          onChange={(e) => { setGrupoFiltro(e.target.value as GrupoSanguineo | ''); setPaginaActual(1); }}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          className={styles.controlFiltro}
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value as EstadoSolicitudBase | ''); setPaginaActual(1); }}
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
            onChange={(e) => { setFechaFiltro(e.target.value); setPaginaActual(1); }}
            tabIndex={-1}
          />
        </div>

        {(grupoFiltro || estadoFiltro || fechaFiltro || textoBusqueda) && (
          <button
            type="button"
            className={styles.botonLimpiar}
            onClick={handleLimpiarFiltros}
          >
            ✕ Limpiar filtros
          </button>
        )}

        <span className={styles.contador}>
          {cargando ? 'Cargando...' : `${totalSolicitudes} solicitud${totalSolicitudes !== 1 ? 'es' : ''} encontrada${totalSolicitudes !== 1 ? 's' : ''}`}
        </span>
      </div>

      {error && <div className={styles.mensajeError} role="alert">{error}</div>}

      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Id solicitud</th>
              <th>Tipo requerido</th>
              <th>Fenotipo</th>
              <th>Urgencia</th>
              <th className={styles.centrado}>Estado</th>
              <th>Candidato asignado</th>
              <th>Fecha de creación</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className={styles.celdaMensaje}>
                  Cargando solicitudes desde la base de datos...
                </td>
              </tr>
            ) : solicitudes.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.celdaMensaje}>
                  No se encontraron solicitudes registradas.
                </td>
              </tr>
            ) : (
              solicitudes.map((sol) => {
                const idMostrado = sol.codigo_solicitud ?? sol.id;
                const estado = ESTADOS_SOLICITUD[obtenerEstadoSolicitud(sol.estado)];

                return (
                  <tr
                    key={sol.id}
                    onClick={() => navigate('/solicitudes/' + idMostrado)}
                    className={styles.fila}
                  >
                    <td data-label="Id solicitud">{idMostrado}</td>
                    <td data-label="Tipo requerido" className={styles.celdaGrupo}>{sol.grupo_sanguineo_requerido || '-'}</td>
                    <td data-label="Fenotipo">{sol.fenotipo_requerido || '-'}</td>
                    <td data-label="Urgencia">{sol.urgencia || '-'}</td>
                    <td data-label="Estado" className={styles.centrado}>
                      <Badge texto={estado.texto} color={estado.color} />
                    </td>
                    <td data-label="Candidato asignado">{sol.donante ? `${sol.donante.nombre} ${sol.donante.apellido}` : 'Sin asignar'}</td>
                    <td data-label="Fecha de creación">{sol.created_at ? new Date(sol.created_at).toLocaleDateString('es-CL') : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
