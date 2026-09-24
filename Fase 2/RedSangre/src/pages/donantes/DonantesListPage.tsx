import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './DonantesListPage.module.css';


const DONANTES_MOCK = [
  { id: '2026004', rut: '16.804.733-4', nombre: 'Maria Fernández', grupo: 'O (-)', fenotipo: 'dCe/dce', etiqueta: 'Fenotipo raro', colorEtiqueta: 'morado', ultimaDonacion: 'hace 4 meses' },
  { id: '2026003', rut: '21.555.803-k', nombre: 'Carla Muñoz', grupo: 'O +', fenotipo: '-', etiqueta: 'Plaquetas', colorEtiqueta: 'azul', ultimaDonacion: 'hace 3 meses' },
  { id: '2026007', rut: '21.666.666-k', nombre: 'Jorge Alvarez', grupo: 'A +', fenotipo: '-', etiqueta: '-', colorEtiqueta: 'gris', ultimaDonacion: 'hace 2 meses' },
];

export function DonantesListPage() {
  const navigate = useNavigate();
  
  // EL CEREBRO DEL BUSCADOR
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [donantesFiltrados, setDonantesFiltrados] = useState(DONANTES_MOCK);

  const handleBuscar = () => {
    // Filtramos la tabla ignorando mayúsculas y minúsculas
    const filtrados = DONANTES_MOCK.filter((donante) => 
      donante.nombre.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
      donante.rut.includes(textoBusqueda) ||
      donante.grupo.toLowerCase().includes(textoBusqueda.toLowerCase())
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
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()} // ¡También busca si presionas Enter!
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
            {/* Ahora mapeamos "donantesFiltrados" en lugar del mock fijo */}
            {donantesFiltrados.map((donante, index) => (
              <tr 
                key={donante.id} 
                onClick={() => navigate('/donantes/' + donante.id)}
                className={`${styles.fila} ${index === donantesFiltrados.length - 1 ? styles.sinBorde : ''}`}
              >
                <td>{donante.id}</td>
                <td>{donante.rut}</td>
                <td className={styles.tdNombre}>{donante.nombre}</td>
                <td>{donante.grupo}</td>
                <td>{donante.fenotipo}</td>
                <td>
                  {donante.etiqueta !== '-' ? (
                    <Badge texto={donante.etiqueta} color={donante.colorEtiqueta as any} />
                  ) : (
                    <span style={{ color: '#aaa' }}>-</span>
                  )}
                </td>
                <td>{donante.ultimaDonacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}