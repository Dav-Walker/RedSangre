import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import styles from './SolicitudDetallePage.module.css';

export function SolicitudDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams(); // Atrapamos el ID de la URL

  // Si no hay ID (por algún error), mostramos el de tu diseño por defecto
  const solicitudId = id || 'S2026002';

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/solicitudes')}>
          ← Volver a solicitudes
        </button>
        <h2 className={styles.tituloCentral}>Detalle de solicitud</h2>
      </div>

      <h1 className={styles.tituloPrincipal}>Solicitud {solicitudId}</h1>

      <div className={styles.layoutColumnas}>
        
        {/* TARJETA IZQUIERDA: ESTADO */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Estado</h3>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Estado</span>
            <div className={styles.valorDato}>
              <Badge texto="En proceso" color="morado" />
            </div>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Urgencia</span>
            <span className={styles.valorDato}>Alta</span>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Donante asignado</span>
            <span className={styles.valorDato}>María Fernández</span>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Reacción</span>
            <span className={styles.valorDato}>Donación aceptada</span>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Creada por</span>
            <span className={styles.valorDato}>Miguel de Cervantes</span>
          </div>
        </div>

        {/* TARJETA DERECHA: BITÁCORA */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Bítacora de contacto</h3>
          
          {/* Encabezados grises de la bitácora */}
          <div className={styles.filaDatos} style={{ backgroundColor: '#fafafa' }}>
            <span className={styles.etiquetaDato} style={{ color: '#999' }}>Canal</span>
            <span className={styles.valorDato} style={{ color: '#999', fontWeight: 'bold' }}>Resultado</span>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Teléfono</span>
            <div className={styles.valorDato}>
              <Badge texto="Confirmado" color="verde" />
            </div>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Correo</span>
            <div className={styles.valorDato}>
              <Badge texto="Enviado" color="rojo" />
            </div>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>WhatsApp</span>
            <div className={styles.valorDato}>
              <Badge texto="Enviado" color="rojo" />
            </div>
          </div>
        </div>

      </div>

      <div className={styles.pieFicha}>
        <button 
          className={styles.botonAzul}
          onClick={() => {
            alert('Solicitud finalizada con éxito');
            navigate('/solicitudes');
          }}
        >
          Finalizar solicitud
        </button>
      </div>

    </div>
  );
}