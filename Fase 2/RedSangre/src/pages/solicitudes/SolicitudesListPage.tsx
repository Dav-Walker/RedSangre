import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './SolicitudesListPage.module.css';

const SOLICITUDES_MOCK = [
  { id: 'S2026002', tipo: 'O (-)', fenotipo: 'dce/dce', urgencia: 'Alta', estado: 'En proceso', candidato: 'María Fernández', color: 'rojo' },
  { id: 'S2026003', tipo: 'A +', fenotipo: 'DCe/dce', urgencia: 'Media', estado: 'Cerrada', candidato: 'Jorge Álvarez', color: 'gris' },
];

export function SolicitudesListPage() {
  const navigate = useNavigate();
  
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [solicitudesFiltradas, setSolicitudesFiltradas] = useState(SOLICITUDES_MOCK);

  const handleBuscar = () => {
    const filtrados = SOLICITUDES_MOCK.filter((sol) => 
      sol.id.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
      sol.tipo.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
      sol.candidato.toLowerCase().includes(textoBusqueda.toLowerCase())
    );
    setSolicitudesFiltradas(filtrados);
  };

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.cabecera}>
        <div className={styles.buscadorContenedor}>
          <input 
            type="text" 
            placeholder="Buscar solicitud..." 
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

        <Button texto="+ Nueva solicitud" onClick={() => navigate('/solicitudes/nueva')} />
      </div>

      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Id solicitud</th>
              <th>Tipo requerido</th>
              <th>Fenotipo</th>
              <th>Urgencia</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th>Candidato asignado</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesFiltradas.map((sol) => (
              <tr 
                key={sol.id} 
                onClick={() => navigate('/solicitudes/' + sol.id)}
                className={styles.fila}
              >
                <td>{sol.id}</td>
                <td style={{ color: '#333', fontWeight: 'bold' }}>{sol.tipo}</td>
                <td>{sol.fenotipo}</td>
                <td>{sol.urgencia}</td>
                <td style={{ textAlign: 'center' }}>
                  <Badge texto={sol.estado} color={sol.color as any} />
                </td>
                <td>{sol.candidato}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}