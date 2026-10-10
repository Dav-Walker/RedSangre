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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [valoresFenotipos, setValoresFenotipos] = useState<Record<string, string>>({});

  const handleCambioFenotipo = (fenotipo: string, valor: string) => {
    setValoresFenotipos(prev => ({ ...prev, [fenotipo]: valor }));
  };

  const estanTodosCompletos = FENOTIPOS_EXTENDIDOS.every(f => valoresFenotipos[f] && valoresFenotipos[f] !== "");

  // Lógica para emparejar los 19 fenotipos (Antígeno 1 y Antígeno 2)
  const filasAgrupadas = [];
  for (let i = 0; i < FENOTIPOS_EXTENDIDOS.length; i += 2) {
    filasAgrupadas.push([FENOTIPOS_EXTENDIDOS[i], FENOTIPOS_EXTENDIDOS[i + 1]]);
  }

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/donantes')}>
          ← Volver a donantes
        </button>
      </div>

      <h1 className={styles.tituloPrincipal}>Nuevo donante</h1>

      <div className={styles.layoutPrincipal}>
        
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

          <div className={styles.filaFormulario} style={{ marginTop: '15px' }}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Grupo sanguíneo</label>
              <div className={styles.selectContenedor}>
                <select className={styles.select}>
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
              <label className={styles.label}>Fenotipo</label>
              <div 
                className={styles.selectContenedor} 
                onClick={() => setIsModalOpen(true)}
              >
                <input 
                  type="text" 
                  className={styles.select} 
                  style={{ cursor: 'pointer', caretColor: 'transparent', color: '#333' }}
                  readOnly 
                  value={estanTodosCompletos ? "DcE/dce" : "Haga clic para definir..."} 
                />
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

        </div>

        <div className={styles.panelDerecho} style={{ textAlign: 'left', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
          
          <h3 className={styles.tituloConsentimiento} style={{ marginTop: 0 }}>Consentimiento del donante</h3>
          
          <div className={styles.checkboxGroup}>
            <input type="checkbox" className={styles.checkbox} id="ck1" />
            <label htmlFor="ck1" className={styles.checkboxLabel}>
              Acepta el uso de cookies y el tratamiento de datos según la política del sistema
            </label>
          </div>

          <div className={styles.checkboxGroup}>
            <input type="checkbox" className={styles.checkbox} id="ck2" />
            <label htmlFor="ck2" className={styles.checkboxLabel}>
              Autoriza a ser contactado telefónicamente ante una necesidad de transfusión compatible
            </label>
          </div>

          <button 
            className={styles.botonGuardar}
            style={{ marginTop: '30px' }}
            onClick={() => {
              if (!estanTodosCompletos) {
                alert('Debe definir los fenotipos antes de guardar al donante.');
                return;
              }
              alert('¡Donante guardado exitosamente!');
              navigate('/donantes');
            }}
          >
            Finalizar y guardar donante
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* VENTANA EMERGENTE (COMPACTA SIN SCROLL)   */}
      {/* ========================================= */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContenido}>
            
            <div className={styles.modalCabecera}>
              <h2>Tipificación Extendida</h2>
            </div>

            <table className={styles.tablaCompacta}>
              <thead>
                <tr>
                  <th>Antígeno</th>
                  <th>Resultado</th>
                  <th>Antígeno</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filasAgrupadas.map((par, index) => (
                  <tr key={index}>
                    <td className={styles.nombreAntigeno}>{par[0]}</td>
                    <td>
                      <select 
                        className={styles.selectCompacto} 
                        value={valoresFenotipos[par[0]] || ""}
                        onChange={(e) => handleCambioFenotipo(par[0], e.target.value)}
                      >
                        <option value=""></option>
                        <option value="POSITIVO">POSITIVO (+)</option>
                        <option value="NEGATIVO">NEGATIVO (-)</option>
                      </select>
                    </td>

                    {par[1] ? (
                      <>
                        <td className={styles.nombreAntigeno}>{par[1]}</td>
                        <td>
                          <select 
                            className={styles.selectCompacto} 
                            value={valoresFenotipos[par[1]] || ""}
                            onChange={(e) => handleCambioFenotipo(par[1], e.target.value)}
                          >
                            <option value=""></option>
                            <option value="POSITIVO">POSITIVO (+)</option>
                            <option value="NEGATIVO">NEGATIVO (-)</option>
                          </select>
                        </td>
                      </>
                    ) : (
                      <><td></td><td></td></>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.modalPie}>
              <button 
                className={styles.botonGuardarModal}
                disabled={!estanTodosCompletos}
                onClick={() => setIsModalOpen(false)}
              >
                Guardar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}