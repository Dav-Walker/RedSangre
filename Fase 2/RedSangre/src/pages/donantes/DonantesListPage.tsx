import { useState, useEffect } from 'react';
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
  const [donantesFiltrados, setDonantesFiltrados] = useState<Donante[]>([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarDonantes() {
      setCargando(true);
      setError(null);
      const { data, error: err } = await supabase!
        .from('donante')
        .select('codigo_donante, rut, nombre, apellido, grupo_sanguineo, fenotipo, fenotipo_raro, frecuente_plaquetas, fecha_ultima_donacion')
        .order('codigo_donante', { ascending: false });

      if (err) {
        setError('No se pudieron cargar los donantes.');
      } else {
        setDonantes(data || []);
        setDonantesFiltrados(data || []);
      }
      setCargando(false);
    }
    cargarDonantes();
  }, []);

  const handleBuscar = () => {
    const texto = textoBusqueda.toLowerCase();
    const filtrados = donantes.filter((d) =>
      `${d.nombre} ${d.apellido}`.toLowerCase().includes(texto) ||
      d.rut.includes(texto) ||
      d.grupo_sanguineo.toLowerCase().includes(texto)
    );
    setDonantesFiltrados(filtrados);
  };

  return (
    <div className={styles.contenedor}>
      <div className={styles.cabecera}>
        <div className={styles.buscadorContenedor}>
          <input
            type="text"
            placeholder="Buscar por nombre, rut o grupo sanguíneo..."
            className={styles.inputBuscador}
            value={textoBusqueda}
            onChange={(e) => setTextoBusqueda(e.target.value)}
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
        <Button texto="+ Nuevo donante" onClick={() => navigate('/donantes/nuevo')} />
      </div>

      {cargando && <p style={{ textAlign: 'center', padding: '20px' }}>Cargando donantes...</p>}
      {error && <p style={{ textAlign: 'center', color: 'red', padding: '20px' }}>{error}</p>}

      {!cargando && !error && (
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
              {donantesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>
                    No se encontraron donantes
                  </td>
                </tr>
              ) : (
                donantesFiltrados.map((donante, index) => {
                  const etiqueta = donante.fenotipo_raro ? 'Fenotipo raro' : donante.frecuente_plaquetas ? 'Plaquetas' : null;
                  const colorEtiqueta = donante.fenotipo_raro ? 'morado' : 'azul';
                  return (
                    <tr
                      key={donante.codigo_donante}
                      onClick={() => navigate('/donantes/' + donante.codigo_donante)}
                      className={`${styles.fila} ${index === donantesFiltrados.length - 1 ? styles.sinBorde : ''}`}
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
      )}
    </div>
  );
}