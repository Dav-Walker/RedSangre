import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './DonanteFichaPage.module.css';

export function DonanteFichaPage() {
  const navigate = useNavigate();

  // ESTADO: Controla si la página está en modo lectura o modo edición
  const [isEditing, setIsEditing] = useState(false);

  // ESTADO: Los datos del donante ahora viven aquí, así podemos modificarlos
  const [donante, setDonante] = useState({
    nombre: 'Lilith Juarez',
    grupo: 'O (-)',
    fenotipo: 'dCe/dce',
    ultimaDonacion: '4 meses',
    etiquetas: [{ texto: 'Altruista', color: 'morado' }],
    observaciones: 'Vena difícil de encontrar, se desmaya',
    telefono: '+56 9 4512 7893',
    ubicacion: 'Peñalolén, Santiago',
    cookies: true,
    autorizaContacto: true,
  });

  // Función para simular que guardamos los datos
  const handleGuardar = () => {
    setIsEditing(false); // Apagamos el modo edición
    alert('¡Cambios guardados exitosamente!');
  };

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.cabecera}>
        <button onClick={() => navigate('/donantes')} className={styles.botonVolver}>
          ← Volver a donantes
        </button>
        <h2 className={styles.tituloPagina}>Ficha de donante</h2>
      </div>

      {/* NOMBRE DEL DONANTE (Editable) */}
      {isEditing ? (
        <input 
          className={styles.inputEdit} 
          style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '30px', padding: '10px' }}
          value={donante.nombre} 
          onChange={(e) => setDonante({...donante, nombre: e.target.value})}
        />
      ) : (
        <h1 className={styles.nombreDonante}>{donante.nombre}</h1>
      )}

      <div className={styles.layoutColumnas}>
        
        {/* COLUMNA 1 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Datos clínicos</h3>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Grupo sanguíneo</span>
            {isEditing ? (
              <select className={styles.selectEdit} value={donante.grupo} onChange={(e) => setDonante({...donante, grupo: e.target.value})}>
                <option>O (-)</option>
                <option>O (+)</option>
                <option>A (+)</option>
                <option>A (-)</option>
              </select>
            ) : (
              <span className={styles.valorDato}>{donante.grupo}</span>
            )}
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fenotipo</span>
            {isEditing ? (
              <select className={styles.selectEdit} value={donante.fenotipo} onChange={(e) => setDonante({...donante, fenotipo: e.target.value})}>
                <option>dce/dce</option>
                <option>dCe/dce</option>
                <option>DCe/dce</option>
              </select>
            ) : (
              <span className={styles.valorDato}>{donante.fenotipo}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Última donación</span>
            {isEditing ? (
              <input type="text" className={styles.inputEdit} value={donante.ultimaDonacion} onChange={(e) => setDonante({...donante, ultimaDonacion: e.target.value})} />
            ) : (
              <span className={styles.valorDato}>{donante.ultimaDonacion}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Etiquetas</span>
            <div className={styles.contenedorEtiquetas}>
              {donante.etiquetas.map((eti, i) => (
                <Badge key={i} texto={eti.texto} color={eti.color as any} />
              ))}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Observaciones</span>
            {isEditing ? (
              <textarea 
                className={styles.inputEdit} 
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={donante.observaciones} 
                onChange={(e) => setDonante({...donante, observaciones: e.target.value})} 
              />
            ) : (
              <span className={styles.valorDato}>{donante.observaciones}</span>
            )}
          </div>
        </div>

        {/* COLUMNA 2 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Contacto y consentimiento</h3>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Teléfono</span>
            {isEditing ? (
              <input type="text" className={styles.inputEdit} value={donante.telefono} onChange={(e) => setDonante({...donante, telefono: e.target.value})} />
            ) : (
              <span className={styles.valorDato}>{donante.telefono}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Ubicación</span>
            {isEditing ? (
              <input type="text" className={styles.inputEdit} value={donante.ubicacion} onChange={(e) => setDonante({...donante, ubicacion: e.target.value})} />
            ) : (
              <span className={styles.valorDato}>{donante.ubicacion}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Cookies aceptadas</span>
            <div className={styles.contenedorEtiquetas}>
              {isEditing ? (
                <select className={styles.selectEdit} value={donante.cookies ? 'sí' : 'no'} onChange={(e) => setDonante({...donante, cookies: e.target.value === 'sí'})}>
                  <option value="sí">Sí</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <Badge texto={donante.cookies ? 'sí' : 'no'} color={donante.cookies ? 'verde' : 'gris'} />
              )}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Autoriza contacto</span>
            <div className={styles.contenedorEtiquetas}>
              {isEditing ? (
                <select className={styles.selectEdit} value={donante.autorizaContacto ? 'sí' : 'no'} onChange={(e) => setDonante({...donante, autorizaContacto: e.target.value === 'sí'})}>
                  <option value="sí">Sí</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <Badge texto={donante.autorizaContacto ? 'sí' : 'no'} color={donante.autorizaContacto ? 'verde' : 'gris'} />
              )}
            </div>
          </div>
        </div>

      </div>

      <div className={styles.pieFicha}>
        {/* Si está editando, mostramos Guardar/Cancelar. Si no, mostramos Editar */}
        {isEditing ? (
          <div className={styles.botonesPie}>
            <button className={styles.botonCancelar} onClick={() => setIsEditing(false)}>
              Cancelar
            </button>
            <Button texto="Guardar cambios" onClick={handleGuardar} />
          </div>
        ) : (
          <Button texto="Editar donante" onClick={() => setIsEditing(true)} />
        )}
      </div>
    </div>
  );
}