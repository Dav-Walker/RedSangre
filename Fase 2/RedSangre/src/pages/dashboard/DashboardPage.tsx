import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
// Importamos nuestros estilos estéticos
import styles from './DashboardPage.module.css';

// --- DATOS FALSOS (MOCKS) ESTATICOS ---
const inventarioSangre = [
  { name: 'O+', cantidad: 120 }, { name: 'O-', cantidad: 15 },
  { name: 'A+', cantidad: 85 }, { name: 'A-', cantidad: 8 },
  { name: 'B+', cantidad: 40 }, { name: 'AB+', cantidad: 12 },
];
const COLORES_PIE = ['#00a0df', '#f47c36', '#9b59b6', '#e74c3c']; 

const tendenciaMeses = [
  { name: 'Ene', donaciones: 45, solicitudes: 40 },
  { name: 'Feb', donaciones: 50, solicitudes: 60 },
  { name: 'Mar', donaciones: 35, solicitudes: 45 },
  { name: 'Abr', donaciones: 60, solicitudes: 55 },
];

const solicitudesActivas = [
  { id: 1, tipo: 'O - Kell(-)', urgencia: 'Alta', estado: 'En proceso', creada: 'hoy' },
  { id: 2, tipo: 'A -', urgencia: 'Media', estado: 'Abierta', creada: 'ayer' },
];

export function DashboardPage() {
  // 1. ESTADO: Nuestro "cerebro" para el filtro interactivo
  const [filtroGrupo, setFiltroGrupo] = useState('Todos');

  // 2. LÓGICA DINÁMICA: Cambiamos los datos del gráfico según el filtro
  let datosFenotipos: { name: string; value: number }[] = [];
  
  if (filtroGrupo === 'Todos') {
    datosFenotipos = [
      { name: 'Varios (Rh+)', value: 145 },
      { name: 'Varios (Rh-)', value: 42 },
      { name: 'Kell (-)', value: 15 },
    ];
  } else if (filtroGrupo.includes('-')) {
    datosFenotipos = [
      { name: 'dce/dce', value: 12 },
      { name: 'dCe/dce', value: 8 },
      { name: 'dcE/dce', value: 3 },
      { name: 'dCE/dce', value: 1 },
    ];
  } else if (filtroGrupo.includes('+')) {
    datosFenotipos = [
      { name: 'DCe/dce', value: 45 },
      { name: 'Dce/dce', value: 30 },
      { name: 'DcE/dce', value: 12 },
      { name: 'DCE/dce', value: 5 },
    ];
  }

  return (
    <div className={styles.contenedor}>
      
      {/* TARJETAS SUPERIORES */}
      <div className={styles.kpiFila}>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Donantes totales</h3>
          <p className={styles.tarjetaValor}>248</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Fenotipos raros</h3>
          <p className={styles.tarjetaValor}>9</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Plaquetas</h3>
          <p className={styles.tarjetaValor}>31</p>
        </div>
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaTitulo}>Disponibles ahora</h3>
          <p className={styles.tarjetaValor}>162</p>
        </div>
      </div>

      <div className={styles.layoutPrincipal}>
        {/* COLUMNA IZQUIERDA: Gráficos */}
        <div className={styles.columnaGraficos}>
          
          <div className={styles.filaGraficos}>
            {/* GRÁFICO 1: Inventario Fijo */}
            <div className={styles.panel}>
              <h4 className={styles.tituloPanel}>Inventario por Grupo</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={inventarioSangre}>
                  <XAxis dataKey="name" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#00a0df" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* GRÁFICO 2: Fenotipos INTERACTIVO */}
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
                  <Pie data={datosFenotipos} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {datosFenotipos.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 3: Tendencia */}
          <div className={styles.panel}>
            <h4 className={styles.tituloPanel}>Donaciones vs Solicitudes</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tendenciaMeses}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="donaciones" stroke="#00a0df" strokeWidth={3} />
                <Line type="monotone" dataKey="solicitudes" stroke="#f47c36" strokeWidth={3} />
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
                <th>Tipo</th>
                <th>Urgencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesActivas.map((sol) => (
                <tr key={sol.id}>
                  <td>{sol.tipo}</td>
                  <td>{sol.urgencia}</td>
                  <td>
                    <span className={sol.estado === 'En proceso' ? styles.estadoProceso : styles.estadoNormal}>
                      {sol.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}