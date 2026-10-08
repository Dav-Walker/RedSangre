import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NuevoDonantePage.module.css';

const REGIONES_CHILE: Record<string, string[]> = {
  "Arica y Parinacota": ["Arica", "Camarones", "Putre", "General Lagos"],
  "Tarapacá": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Pica"],
  "Antofagasta": ["Antofagasta", "Calama", "Tocopilla", "Mejillones"],
  "Atacama": ["Copiapó", "Vallenar", "Caldera", "Chañaral"],
  "Coquimbo": ["La Serena", "Coquimbo", "Ovalle", "Illapel"],
  "Valparaíso": ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio"],
  "Metropolitana": ["Santiago", "Providencia", "Las Condes", "Peñalolén", "Maipú", "Puente Alto", "La Florida", "Melipilla"],
  "O'Higgins": ["Rancagua", "Machalí", "San Fernando", "Rengo"],
  "Maule": ["Talca", "Curicó", "Linares", "Constitución"],
  "Ñuble": ["Chillán", "San Carlos", "Bulnes", "Coihueco"],
  "Biobío": ["Concepción", "Talcahuano", "Los Ángeles", "San Pedro de la Paz"],
  "Araucanía": ["Temuco", "Padre Las Casas", "Villarrica", "Angol"],
  "Los Ríos": ["Valdivia", "La Unión", "Panguipulli", "Río Bueno"],
  "Los Lagos": ["Puerto Montt", "Osorno", "Castro", "Ancud"],
  "Aysén": ["Coyhaique", "Puerto Aysén", "Chile Chico", "Cochrane"],
  "Magallanes": ["Punta Arenas", "Puerto Natales", "Porvenir", "Cabo de Hornos"]
};

const FENOTIPOS_EXTENDIDOS = [
  'D', 'C', 'Cw', 'Diego', 'E', 'Fya', 'Fyb', 'I', 'JKa', 'JKb', 
  'JSa', 'JSb', 'K', 'Kpa', 'Kpb', 'Lea', 'Leb', 'Lua', 'Lub'
];

export function NuevoDonantePage() {
  const navigate = useNavigate();
  
  const [regionSeleccionada, setRegionSeleccionada] = useState('');
  const comunasDisponibles = regionSeleccionada ? REGIONES_CHILE[regionSeleccionada] : [];

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/donantes')}>
          ← Volver a donantes
        </button>
      </div>

      <h1 className={styles.tituloPrincipal}>Nuevo donante</h1>

      <div className={styles.layoutPrincipal}>
        
        {/* PANEL IZQUIERDO: DATOS PERSONALES */}
        <div className={styles.panelIzquierdo} style={{ textAlign: 'left' }}>
          
          <div className={styles.grupoInput}>
            <label className={styles.label}>Nombre</label>
            <input type="text" className={styles.input} placeholder="Ej: María" />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Apellido</label>
            <input type="text" className={styles.input} placeholder="Ej: Fernández Soto" />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Correo electrónico</label>
            <input type="email" className={styles.input} placeholder="ejemplo@correo.com" />
          </div>

          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>RUT</label>
              <input type="text" className={styles.input} placeholder="12345678-9" />
            </div>
            
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Sexo</label>
              <div className={styles.selectContenedor}>
                <select className={styles.select}>
                  <option value="">Seleccionar...</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="No especifica">No especifica</option>
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Fecha de nacimiento</label>
              <input type="date" className={styles.input} />
            </div>

            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Teléfono</label>
              <input type="text" className={styles.input} placeholder="+56 9 1234 5678" />
            </div>
          </div>

          <div className={styles.grupoInput} style={{ marginTop: '15px' }}>
            <label className={styles.label}>Dirección</label>
            <input type="text" className={styles.input} placeholder="Ej: Av. Apoquindo 4567, Depto 102" />
          </div>

          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Región</label>
              <div className={styles.selectContenedor}>
                <select 
                  className={styles.select}
                  value={regionSeleccionada}
                  onChange={(e) => setRegionSeleccionada(e.target.value)}
                >
                  <option value="">Seleccionar región...</option>
                  {Object.keys(REGIONES_CHILE).map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
            
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Comuna</label>
              <div className={styles.selectContenedor}>
                <select className={styles.select} disabled={!regionSeleccionada}>
                  <option value="">Seleccionar comuna...</option>
                  {comunasDisponibles.map((comuna) => (
                    <option key={comuna} value={comuna}>{comuna}</option>
                  ))}
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

          <div className={styles.badgesContainer}>
            <span className={styles.badgeMorado}>Fenotipo raro</span>
            <span className={styles.badgeAzul}>Donante frecuente de plaquetas</span>
          </div>
        </div>

        {/* PANEL DERECHO: DATOS HEMATOLÓGICOS */}
        <div className={styles.panelDerecho} style={{ textAlign: 'left' }}>
          
          <h3 className={styles.tituloConsentimiento} style={{ marginTop: 0 }}>Datos hematológicos</h3>
          
          {/* SANGRE Y FENOTIPO BASE */}
          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Grupo sanguíneo</label>
              <div className={styles.selectContenedor}>
                {/* ¡LA MAGIA DEL ROJO GRUESO ESTÁ AQUÍ! */}
                <select className={`${styles.select} ${styles.sangreRojo}`}>
                  <option value="">Seleccionar...</option>
                  <option value="O-">O (-)</option>
                  <option value="O+">O (+)</option>
                  <option value="A-">A (-)</option>
                  <option value="A+">A (+)</option>
                  <option value="B-">B (-)</option>
                  <option value="B+">B (+)</option>
                  <option value="AB-">AB (-)</option>
                  <option value="AB+">AB (+)</option>
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
            
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Fenotipo Base</label>
              <div className={styles.selectContenedor}>
                <select className={styles.select}>
                  <option value="">Seleccionar...</option>
                  <option value="dce/dce">dce/dce</option>
                  <option value="dCe/dce">dCe/dce</option>
                  <option value="DCe/dce">DCe/dce</option>
                  <option value="Dce/dce">Dce/dce</option>
                  <option value="DcE/dce">DcE/dce</option>
                  <option value="DCE/dce">DCE/dce</option>
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

          {/* TABLA DE FENOTIPOS EXTENDIDOS (Diseño moderno) */}
          <div className={styles.tablaFenotiposContainer} style={{ marginTop: '15px' }}>
            <table className={styles.tablaFenotipos}>
              <thead>
                <tr>
                  <th>Tipificación extendida</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {FENOTIPOS_EXTENDIDOS.map((fenotipo) => (
                  <tr key={fenotipo}>
                    <td style={{ fontWeight: 'bold', color: '#555' }}>{fenotipo}</td>
                    <td>
                      <select className={styles.selectFenotipoDetalle} defaultValue="">
                        <option value=""></option>
                        <option value="POSITIVO">POSITIVO</option>
                        <option value="NEGATIVO">NEGATIVO</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CONSENTIMIENTOS */}
          <h3 className={styles.tituloConsentimiento} style={{ marginTop: '15px' }}>Consentimiento del donante</h3>
          
          <div className={styles.checkboxGroup}>
            <input type="checkbox" className={styles.checkbox} id="ck1" />
            <label htmlFor="ck1" className={styles.checkboxLabel}>
              Acepta el uso de cookies y el tratamiento de datos según política
            </label>
          </div>

          <div className={styles.checkboxGroup}>
            <input type="checkbox" className={styles.checkbox} id="ck2" />
            <label htmlFor="ck2" className={styles.checkboxLabel}>
              Autoriza a ser contactado telefónicamente ante necesidad
            </label>
          </div>

          <button 
            className={styles.botonGuardar}
            style={{ marginTop: '15px' }}
            onClick={() => {
              alert('¡Donante guardado exitosamente!');
              navigate('/donantes');
            }}
          >
            Guardar donante
          </button>
        </div>

      </div>
    </div>
  );
}