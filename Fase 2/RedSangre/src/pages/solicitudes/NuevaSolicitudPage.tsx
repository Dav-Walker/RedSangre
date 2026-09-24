import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NuevaSolicitudPage.module.css';

// SIMULAMOS EL ALGORITMO DE BACKEND
const CANDIDATOS_MOCK = [
  { id: 1, nombre: 'María Fernandez', grupo: 'O (-)', fenotipo: 'dce/dce', ultimaDonacion: 'hace 4 meses', distancia: '1.2 km', comuna: 'Providencia', disponible: true },
  { id: 2, nombre: 'Carlos Ruiz', grupo: 'O (-)', fenotipo: 'dce/dce', ultimaDonacion: 'hace 6 meses', distancia: '3.5 km', comuna: 'Ñuñoa', disponible: true },
  { id: 3, nombre: 'Ana Gómez', grupo: 'O (-)', fenotipo: 'dce/dce', ultimaDonacion: 'hace 2 semanas', distancia: '4.8 km', comuna: 'Santiago Centro', disponible: false },
  { id: 4, nombre: 'Jorge Álvarez', grupo: 'O (-)', fenotipo: 'dce/dce', ultimaDonacion: 'hace 5 meses', distancia: '8.1 km', comuna: 'Las Condes', disponible: true },
];

export function NuevaSolicitudPage() {
  const navigate = useNavigate();
  
  // ESTADOS DEL FORMULARIO
  const [grupoSanguineo, setGrupoSanguineo] = useState('O-');
  const [fenotipo, setFenotipo] = useState('dce/dce');
  const [urgencia, setUrgencia] = useState('Media'); // <-- ¡Aquí guardamos la urgencia!
  const [candidatoSeleccionado, setCandidatoSeleccionado] = useState<number | null>(null);

  const handleCrearSolicitud = () => {
    if (!candidatoSeleccionado) return;
    alert(`¡Solicitud de urgencia ${urgencia} creada exitosamente!`);
    navigate('/solicitudes');
  };

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/solicitudes')}>
          ← Volver a solicitudes
        </button>
        <h2 className={styles.tituloCentral}>Nueva solicitud</h2>
      </div>

      <h1 className={styles.tituloPrincipal}>Buscar donante compatible</h1>

      {/* PANEL GRIS */}
      <div className={styles.panelBusqueda}>
        
        {/* FILA 1: SANGRE Y FENOTIPO */}
        <div className={styles.filaFormulario}>
          <div className={styles.grupoInput}>
            <label className={styles.label}>Grupo sanguíneo</label>
            <div className={styles.selectContenedor}>
              <select 
                className={styles.select} 
                value={grupoSanguineo}
                onChange={(e) => setGrupoSanguineo(e.target.value)}
              >
                <option value="O-">O (-)</option>
                <option value="O+">O (+)</option>
                <option value="A-">A (-)</option>
                <option value="A+">A (+)</option>
              </select>
              <div className={styles.selectIcon}>▼</div>
            </div>
          </div>
          
          <div className={styles.grupoInput}>
            <label className={styles.label}>Fenotipo</label>
            <div className={styles.selectContenedor}>
              <select 
                className={styles.select}
                value={fenotipo}
                onChange={(e) => setFenotipo(e.target.value)}
              >
                <option value="dce/dce">dce/dce</option>
                <option value="dCe/dce">dCe/dce</option>
                <option value="DCe/dce">DCe/dce</option>
              </select>
              <div className={styles.selectIcon}>▼</div>
            </div>
          </div>
        </div>

        {/* FILA 2: URGENCIA */}
        <div className={styles.filaFormulario}>
          <div className={styles.grupoInput}>
            <label className={styles.label}>Nivel de urgencia</label>
            <div className={styles.selectContenedor}>
              <select 
                className={styles.select}
                value={urgencia}
                onChange={(e) => setUrgencia(e.target.value)}
              >
                <option value="Baja">Baja (Programada)</option>
                <option value="Media">Media (24 a 48 hrs)</option>
                <option value="Alta">Alta (Menos de 24 hrs)</option>
                <option value="Emergencia vital">Emergencia vital (Inmediata)</option>
              </select>
              <div className={styles.selectIcon}>▼</div>
            </div>
          </div>
          
          {/* Dejamos un div vacío para que el selector de urgencia no ocupe todo el ancho y se vea simétrico con los de arriba */}
          <div className={styles.grupoInput}></div>
        </div>

        <div className={styles.subtituloCandidatos}>Candidatos priorizados (Desde Clínica INDISA, Providencia)</div>

        {/* LISTA DE CANDIDATOS */}
        {CANDIDATOS_MOCK.map((candidato, index) => (
          <div 
            key={candidato.id}
            className={`
              ${styles.tarjetaCandidato} 
              ${candidato.disponible ? styles.disponible : styles.noDisponible}
              ${candidatoSeleccionado === candidato.id ? styles.seleccionado : ''}
            `}
            onClick={() => {
              if (candidato.disponible) setCandidatoSeleccionado(candidato.id);
            }}
          >
            <div className={styles.numeroRanking}>{index + 1}</div>
            
            <div className={styles.infoCandidato}>
              <span className={styles.nombreCandidato}>{candidato.nombre}</span>
              <span className={styles.detallesCandidato}>
                {candidato.grupo} {candidato.ultimaDonacion} • {candidato.distancia} ({candidato.comuna})
              </span>
            </div>

            <div>
              {candidato.disponible ? (
                <span className={styles.badgeDisponible}>Disponible</span>
              ) : (
                <span className={styles.badgeNoDisponible}>No disponible</span>
              )}
            </div>
          </div>
        ))}

      </div>

      <button 
        className={styles.botonGuardar} 
        disabled={!candidatoSeleccionado}
        onClick={handleCrearSolicitud}
      >
        Crear solicitud con candidato
      </button>

    </div>
  );
}