// Comentarios - Dashboard
// Indicadores, inventario por grupo, fenotipos más frecuentes, tendencia mensual y solicitudes activas.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import styles from './DashboardPage.module.css';
import { Badge } from '../../components/common/Badge';
import { ESTADOS_SOLICITUD, obtenerEstadoSolicitud } from '../../utils/estadosSolicitud';
import { GRUPOS_SANGUINEOS } from '../../utils/gruposSanguineos';
import { calcularFenotipos, construirTendencia } from '../../utils/graficosDashboard';
import { cargarDashboard, type DatosDashboard, type SolicitudActiva } from '../../servicios/dashboard';

// Comentarios - Dashboard
// Recharts dibuja en SVG y necesita los colores como texto: no puede leer las variables CSS de la marca.
const COLORES_PIE = ['#00a0df', '#f47c36', '#9b59b6', '#e74c3c', '#2ecc71', '#f1c40f'];

const SIN_ERRORES: DatosDashboard['errores'] = { kpis: false, grupos: false, solicitudes: false, tendencia: false, fenotipos: false };

export function DashboardPage() {
  const navigate = useNavigate();
  // Comentarios - Dashboard
  // null mientras carga; después, los datos de las vistas (cada panel muestra su propio error si falló).
  const [datos, setDatos] = useState<DatosDashboard | null>(null);
  const [filtroGrupo, setFiltroGrupo] = useState('Todos');

  useEffect(() => {
    let vigente = true;
    void cargarDashboard().then((resultado) => { if (vigente) setDatos(resultado); });
    return () => { vigente = false; };
  }, []);

  const errores = datos?.errores ?? SIN_ERRORES;
  const r = datos?.resumen;
  const totales = r ? {
    donantes: r.donantes_totales ?? 0,
    fenotipos: r.fenotipos_raros ?? 0,
    plaquetas: r.plaquetas_frecuentes ?? 0,
    disponibles: r.disponibles_ahora ?? 0,
  } : null;
  const inventario = datos ? datos.porGrupo.map((fila) => ({
    name: fila.grupo_sanguineo ?? 'Sin grupo',
    cantidad: fila.disponibles ?? 0,
  })) : null;
  const solicitudesActivas = datos?.solicitudesActivas ?? null;
  const tendencia = datos ? construirTendencia(datos.donaciones, datos.demanda) : null;
  const donantesFenotipo = datos?.donantes ?? null;

  // Comentarios - Dashboard
  // Cada solicitud activa abre su detalle, igual que en el listado de Solicitudes (ruta por código, o por id si no tiene).
  const abrirDetalle = (sol: SolicitudActiva) => {
    const identificador = sol.codigo_solicitud ?? sol.id;
    if (identificador) navigate('/solicitudes/' + identificador);
  };

  const mensaje = (texto: string) => <p className={styles.mensajePanel}>{texto}</p>;

  const textoKpi = (valor: number | undefined) => valor ?? (errores.kpis ? '—' : '…');

  const datosFenotipos = calcularFenotipos(donantesFenotipo ?? [], filtroGrupo);

  return (
    <div className={styles.contenedor}>
      {/* TARJETAS SUPERIORES */}
      <div className={styles.kpiFila}>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Donantes totales</h3>
          <p className={styles.tarjetaValor}>{textoKpi(totales?.donantes)}</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Fenotipos raros</h3>
          <p className={styles.tarjetaValor}>{textoKpi(totales?.fenotipos)}</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Plaquetas</h3>
          <p className={styles.tarjetaValor}>{textoKpi(totales?.plaquetas)}</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Disponibles ahora</h3>
          <p className={styles.tarjetaValor}>{textoKpi(totales?.disponibles)}</p>
        </div>
      </div>

      <div className={styles.layoutPrincipal}>
        {/* COLUMNA IZQUIERDA: Gráficos */}
        <div className={styles.columnaGraficos}>

          <div className={styles.filaGraficos}>
            <div className={styles.panel}>
              <h4 className={styles.tituloPanel}>Inventario por Grupo</h4>
              {inventario === null ? mensaje('Cargando...')
                : errores.grupos ? mensaje('No se pudo cargar el inventario.')
                : inventario.length === 0 ? mensaje('Sin datos')
                : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={inventario}>
                    <XAxis dataKey="name" fontSize={12} />
                    <Tooltip cursor={{ fill: '#f5f7fa' }} />
                    <Bar dataKey="cantidad" fill="#00a0df" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={styles.panel}>
              <div className={styles.cabeceraFiltro}>
                <h4 className={styles.tituloFiltro}>Fenotipos Raros</h4>
                <select
                  className={styles.selectFiltro}
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {GRUPOS_SANGUINEOS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {donantesFenotipo === null ? mensaje('Cargando...')
                : errores.fenotipos ? mensaje('No se pudieron cargar los fenotipos.')
                : datosFenotipos.length === 0 ? mensaje(filtroGrupo === 'Todos' ? 'Sin datos' : `No hay fenotipos para ${filtroGrupo}`)
                : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={datosFenotipos}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {datosFenotipos.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <h4 className={styles.tituloPanel}>Donaciones vs Solicitudes</h4>
            {tendencia === null ? mensaje('Cargando...')
              : errores.tendencia ? mensaje('No se pudo cargar la tendencia.')
              : tendencia.length === 0 ? mensaje('Sin datos')
              : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={tendencia}>
                  <XAxis dataKey="name" fontSize={12} interval="preserveStartEnd" />
                  <YAxis fontSize={12} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="donaciones" name="Donaciones" stroke="#00a0df" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="solicitudes" name="Solicitudes" stroke="#f47c36" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Legend verticalAlign="top" height={36} iconType="plainline" wrapperStyle={{ fontSize: '12px' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: Tabla (en celular pasa arriba, ver .panelSolicitudes) */}
        <div className={`${styles.panel} ${styles.panelSolicitudes}`}>
          <h4 className={styles.tituloPanel}>Solicitudes Activas</h4>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Código / Grupo</th>
                <th>Urgencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesActivas === null ? (
                <tr><td colSpan={3} className={styles.mensajePanel}>Cargando...</td></tr>
              ) : errores.solicitudes ? (
                <tr><td colSpan={3} className={styles.mensajePanel}>No se pudieron cargar las solicitudes.</td></tr>
              ) : solicitudesActivas.length === 0 ? (
                <tr><td colSpan={3} className={styles.mensajePanel}>No hay solicitudes activas</td></tr>
              ) : solicitudesActivas.map((sol) => {
                const estado = ESTADOS_SOLICITUD[obtenerEstadoSolicitud(sol.estado)];
                return (
                  <tr
                    key={sol.id}
                    className={styles.filaSolicitud}
                    onClick={() => abrirDetalle(sol)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalle(sol); } }}
                    tabIndex={0}
                  >
                    <td className={styles.celdaCodigo}>{sol.codigo_solicitud ?? sol.id} ({sol.grupo_sanguineo_requerido ?? '-'})</td>
                    <td data-label="Urgencia" className={styles.celdaUrgencia}>{sol.urgencia ?? '-'}</td>
                    <td className={styles.celdaEstado}><Badge texto={estado.texto} color={estado.color} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
