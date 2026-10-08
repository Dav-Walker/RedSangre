import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend // <-- Agregamos Legend aquí
} from 'recharts';
import styles from './DashboardPage.module.css';
import { supabase } from '../../supabase';

const COLORES_PIE = ['#00a0df', '#f47c36', '#9b59b6', '#e74c3c', '#2ecc71', '#f1c40f']; 

export function DashboardPage() {
  const [inventarioSangre, setInventarioSangre] = useState<any[]>([]);
  const [solicitudesActivas, setSolicitudesActivas] = useState<any[]>([]);
  const [totales, setTotales] = useState({ donantes: 0, fenotipos: 0, plaquetas: 0, disponibles: 0 });
  
  const [tendenciaMeses, setTendenciaMeses] = useState<any[]>([]);
  
  // OJO AQUÍ: Inicializamos en null para saber cuándo está cargando y cuándo está vacío
  const [datosBrutosFenotipos, setDatosBrutosFenotipos] = useState<any[] | null>(null);
  
  const [filtroGrupo, setFiltroGrupo] = useState('Todos');

  useEffect(() => {
    async function buscarDatosReales() {
      try {
        // 1. TARJETAS (KPIs)
        const { data: dataResumen } = await supabase.from('v_dashboard_resumen').select('*').single();
        if (dataResumen) {
          setTotales({
            donantes: dataResumen.donantes_totales || dataResumen.total || 0,
            fenotipos: dataResumen.fenotipos_raros || 0,
            plaquetas: dataResumen.plaquetas_frecuentes || 0,
            disponibles: dataResumen.disponibles_ahora || 0
          });
        }

        // 2. GRÁFICO DE BARRAS
        const { data: dataGrupos } = await supabase.from('v_dashboard_donantes_por_grupo').select('*');
        if (dataGrupos) {
          const inventarioFormateado = dataGrupos.map((fila: any) => ({
            name: fila.grupo_sanguineo || 'Sin grupo',
            cantidad: fila.disponibles || fila.total || 0 
          }));
          setInventarioSangre(inventarioFormateado);
        }

        // 3. TABLA DE SOLICITUDES
        const { data: dataSolicitudes } = await supabase.from('v_solicitud_activa').select('*').limit(5);
        if (dataSolicitudes) setSolicitudesActivas(dataSolicitudes);

        // 4. GRÁFICO DE LÍNEAS
        const { data: dataDonaciones } = await supabase.from('v_donaciones_mensuales').select('*');
        const { data: dataDemanda } = await supabase.from('v_demanda_historica').select('*');
        
        if (dataDonaciones || dataDemanda) {
          const historialMapa: Record<string, any> = {};
          
          if (dataDonaciones) {
            dataDonaciones.forEach((d: any) => {
              const mes = d.mes || d.mes_nombre || 'N/A';
              if (!historialMapa[mes]) historialMapa[mes] = { name: mes, donaciones: 0, solicitudes: 0 };
              historialMapa[mes].donaciones += (d.total || d.cantidad || 1);
            });
          }
          
          if (dataDemanda) {
            dataDemanda.forEach((s: any) => {
              const mes = s.mes || s.mes_nombre || 'N/A';
              if (!historialMapa[mes]) historialMapa[mes] = { name: mes, donaciones: 0, solicitudes: 0 };
              historialMapa[mes].solicitudes += (s.total || s.cantidad || 1);
            });
          }
          setTendenciaMeses(Object.values(historialMapa));
        }

        // 5. GRÁFICO DE TORTA (A PRUEBA DE BALAS)
        const { data: dataDonantes, error: errDonantes } = await supabase.from('donante').select('grupo_sanguineo, fenotipo');
        
        if (errDonantes) {
          console.error("Error cargando torta (Quizás falta login/RLS):", errDonantes);
          setDatosBrutosFenotipos([]); // Si hay error, lo dejamos vacío para que no se tranque
        } else if (dataDonantes) {
          setDatosBrutosFenotipos(dataDonantes);
        } else {
          setDatosBrutosFenotipos([]);
        }

      } catch (error) {
        console.error('Error conectando a la base de datos:', error);
      }
    }

    buscarDatosReales();
  }, []);

  // LÓGICA INTERACTIVA DEL GRÁFICO DE TORTA CORREGIDA
  let datosFenotipos: { name: string; value: number }[] = [];
  
  if (datosBrutosFenotipos === null) {
    // Estado 1: Aún no llegan los datos
    datosFenotipos = [{ name: 'Cargando datos...', value: 1 }];
  } else if (datosBrutosFenotipos.length === 0) {
    // Estado 2: Llegaron los datos pero está vacío (por seguridad RLS o tabla sin datos)
    datosFenotipos = [{ name: 'Sin acceso o sin datos', value: 1 }];
  } else {
    // Estado 3: ¡Hay datos! Vamos a contarlos.
    const conteo: Record<string, number> = {};
    
    datosBrutosFenotipos.forEach(donante => {
      const grupo = donante.grupo_sanguineo || '';
      const fenotipo = donante.fenotipo || ''; 
      
      if (fenotipo && fenotipo.trim() !== '') {
        if (filtroGrupo === 'Todos' || grupo === filtroGrupo) {
           conteo[fenotipo] = (conteo[fenotipo] || 0) + 1;
        }
      }
    });
    
    datosFenotipos = Object.keys(conteo)
      .sort((a, b) => conteo[b] - conteo[a]) 
      .slice(0, 5) 
      .map(key => ({ name: key, value: conteo[key] }));

    if (datosFenotipos.length === 0) {
      datosFenotipos = [{ name: 'No hay fenotipos para ' + filtroGrupo, value: 1 }];
    }
  }

  const tendenciaFinal = tendenciaMeses.length > 0 ? tendenciaMeses : [
    { name: 'Ene', donaciones: 45, solicitudes: 40 },
    { name: 'Feb', donaciones: 50, solicitudes: 60 },
    { name: 'Mar', donaciones: 35, solicitudes: 45 },
  ];

  return (
    <div className={styles.contenedor}>
      {/* TARJETAS SUPERIORES */}
      <div className={styles.kpiFila}>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Donantes totales</h3>
          <p className={styles.tarjetaValor}>{totales.donantes}</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Fenotipos raros</h3>
          <p className={styles.tarjetaValor}>{totales.fenotipos}</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Plaquetas</h3>
          <p className={styles.tarjetaValor}>{totales.plaquetas}</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Disponibles ahora</h3>
          <p className={styles.tarjetaValor}>{totales.disponibles}</p>
        </div>
      </div>

      <div className={styles.layoutPrincipal}>
        {/* COLUMNA IZQUIERDA: Gráficos */}
        <div className={styles.columnaGraficos}>
          
          <div className={styles.filaGraficos}>
            <div className={styles.panel}>
              <h4 className={styles.tituloPanel}>Inventario por Grupo</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={inventarioSangre.length > 0 ? inventarioSangre : [{ name: 'Sin datos', cantidad: 0 }]}>
                  <XAxis dataKey="name" fontSize={12} />
                  <Tooltip cursor={{fill: '#f5f7fa'}} />
                  <Bar dataKey="cantidad" fill="#00a0df" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                </select>
              </div>
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
                  {/* MAGIA VISUAL: Esto pondrá los nombres de los fenotipos debajo de la torta */}
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.panel}>
            <h4 className={styles.tituloPanel}>Donaciones vs Solicitudes</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tendenciaFinal}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="donaciones" stroke="#00a0df" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="solicitudes" stroke="#f47c36" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Legend verticalAlign="top" height={36} iconType="plainline" wrapperStyle={{ fontSize: '12px' }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* COLUMNA DERECHA: Tabla */}
        <div className={styles.panel}>
          <h4 className={styles.tituloPanel}>Solicitudes Activas</h4>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Código/Tipo</th>
                <th>Urgencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesActivas.length > 0 ? solicitudesActivas.map((sol) => (
                <tr key={sol.id || sol.codigo}>
                  <td>{sol.tipo || sol.grupo_sanguineo || 'Sangre'}</td>
                  <td>{sol.urgencia}</td>
                  <td>
                    <span className={sol.estado === 'en_proceso' ? styles.estadoProceso : styles.estadoNormal}>
                      {sol.estado === 'en_proceso' ? 'En proceso' : sol.estado}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={3} style={{textAlign: 'center', padding: '20px'}}>No hay solicitudes activas</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}