import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import styles from './DashboardPage.module.css';
import { supabase } from '../../supabase';
import { Badge } from '../../components/common/Badge';
import { ESTADOS_SOLICITUD, obtenerEstadoSolicitud } from '../../utils/estadosSolicitud';
import { GRUPOS_SANGUINEOS } from '../../utils/gruposSanguineos';

const COLORES_PIE = ['#00a0df', '#f47c36', '#9b59b6', '#e74c3c', '#2ecc71', '#f1c40f'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface Totales {
  donantes: number;
  fenotipos: number;
  plaquetas: number;
  disponibles: number;
}

interface SolicitudActiva {
  id: string;
  codigo_solicitud: string | null;
  grupo_sanguineo_requerido: string | null;
  urgencia: string | null;
  estado: string | null;
}

interface DonanteFenotipo {
  grupo_sanguineo: string | null;
  fenotipo: string | null;
}

interface PuntoTendencia {
  clave: string;
  name: string;
  donaciones: number;
  solicitudes: number;
}

// Une donaciones y solicitudes por mes (AAAA-MM), en orden cronológico
function construirTendencia(
  donaciones: { anio: number; mes: number; total_donaciones: number }[],
  demanda: { anio: number; mes: number; total_solicitudes: number }[],
): PuntoTendencia[] {
  const puntos = new Map<string, PuntoTendencia>();

  const obtenerPunto = (anio: number, mes: number) => {
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    const existente = puntos.get(clave);
    if (existente) return existente;

    const nuevo = { clave, name: `${MESES[mes - 1]} ${String(anio).slice(-2)}`, donaciones: 0, solicitudes: 0 };
    puntos.set(clave, nuevo);
    return nuevo;
  };

  donaciones.forEach((d) => { obtenerPunto(d.anio, d.mes).donaciones += d.total_donaciones; });
  demanda.forEach((s) => { obtenerPunto(s.anio, s.mes).solicitudes += s.total_solicitudes; });

  return [...puntos.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

// Top 5 fenotipos de los donantes, filtrados por grupo si corresponde
function calcularFenotipos(donantes: DonanteFenotipo[], grupo: string) {
  const conteo: Record<string, number> = {};

  donantes.forEach((d) => {
    const fenotipo = d.fenotipo?.trim();
    if (!fenotipo) return;
    if (grupo !== 'Todos' && d.grupo_sanguineo !== grupo) return;
    conteo[fenotipo] = (conteo[fenotipo] || 0) + 1;
  });

  return Object.entries(conteo)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));
}

export function DashboardPage() {
  // null = cargando; [] = sin datos; valor = datos reales
  const [totales, setTotales] = useState<Totales | null>(null);
  const [inventario, setInventario] = useState<{ name: string; cantidad: number }[] | null>(null);
  const [solicitudesActivas, setSolicitudesActivas] = useState<SolicitudActiva[] | null>(null);
  const [tendencia, setTendencia] = useState<PuntoTendencia[] | null>(null);
  const [donantesFenotipo, setDonantesFenotipo] = useState<DonanteFenotipo[] | null>(null);
  const [errores, setErrores] = useState({ kpis: false, grupos: false, solicitudes: false, tendencia: false, fenotipos: false });
  const [filtroGrupo, setFiltroGrupo] = useState('Todos');

  useEffect(() => {
    async function cargarDashboard() {
      const [resumen, grupos, activas, donaciones, demanda, donantes] = await Promise.all([
        supabase.from('v_dashboard_resumen').select('*').single(),
        supabase.from('v_dashboard_donantes_por_grupo').select('grupo_sanguineo, disponibles'),
        supabase.from('v_solicitud_activa')
          .select('id, codigo_solicitud, grupo_sanguineo_requerido, urgencia, estado')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('v_donaciones_mensuales').select('anio, mes, total_donaciones'),
        supabase.from('v_demanda_historica').select('anio, mes, total_solicitudes'),
        supabase.from('donante').select('grupo_sanguineo, fenotipo'),
      ]);

      const hayError = {
        kpis: !!resumen.error,
        grupos: !!grupos.error,
        solicitudes: !!activas.error,
        tendencia: !!(donaciones.error || demanda.error),
        fenotipos: !!donantes.error,
      };
      setErrores(hayError);

      [resumen.error, grupos.error, activas.error, donaciones.error, demanda.error, donantes.error]
        .filter(Boolean)
        .forEach((error) => console.error('Error cargando dashboard:', error));

      const r = resumen.data;
      setTotales(r ? {
        donantes: r.donantes_totales,
        fenotipos: r.fenotipos_raros,
        plaquetas: r.plaquetas_frecuentes,
        disponibles: r.disponibles_ahora,
      } : null);

      setInventario((grupos.data ?? []).map((fila) => ({
        name: fila.grupo_sanguineo ?? 'Sin grupo',
        cantidad: fila.disponibles ?? 0,
      })));

      setSolicitudesActivas(activas.data ?? []);
      setTendencia(construirTendencia(donaciones.data ?? [], demanda.data ?? []));
      setDonantesFenotipo(donantes.data ?? []);
    }

    cargarDashboard();
  }, []);

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

        {/* COLUMNA DERECHA: Tabla */}
        <div className={styles.panel}>
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
                  <tr key={sol.id}>
                    <td>{sol.codigo_solicitud ?? sol.id} ({sol.grupo_sanguineo_requerido ?? '-'})</td>
                    <td>{sol.urgencia ?? '-'}</td>
                    <td><Badge texto={estado.texto} color={estado.color} /></td>
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
