import { useState } from 'react';
import { Button } from '../../components/common/Button';
import styles from './ConfiguracionPage.module.css';

const USUARIOS_INICIALES = [
  { 
    id: 1, 
    nombre: 'David Walker', 
    correo: 'david.walker@indisa.cl', 
    rol: 'Administrador', 
    activo: true, 
    tiempoActivo: 'Activo hace 12 min' 
  },
  { 
    id: 2, 
    nombre: 'Nicole Hernandez', 
    correo: 'nicole.hernandez@indisa.cl', 
    rol: 'Tecnólogo', 
    activo: false, 
    tiempoActivo: 'Última conexión el 10-05-2026 a las 16:00' 
  },
];

export function ConfiguracionPage() {
  // ESTADOS
  const [usuarios, setUsuarios] = useState(USUARIOS_INICIALES);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Campos del formulario del modal
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('Tecnólogo médico');

  const handleCrearUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !correo) return;

    const nuevoUser = {
      id: Date.now(),
      nombre,
      correo,
      rol,
      activo: true,
      tiempoActivo: 'Activo recién'
    };

    setUsuarios([...usuarios, nuevoUser]);
    setIsModalOpen(false); // Cierra el modal
    setNombre('');
    setCorreo('');
  };

  return (
    <div className={styles.contenedor}>
      
      <div className={styles.cabeceraSeccion}>
        <div style={{ width: '150px' }}></div>
        <h1 className={styles.tituloPrincipal}>Usuarios y roles</h1>
        <Button texto="+ Nuevo usuario" onClick={() => setIsModalOpen(true)} />
      </div>

      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Estado de conexión</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className={styles.fila}>
                <td style={{ fontWeight: 'bold' }}>{usuario.nombre}</td>
                <td style={{ color: '#666' }}>{usuario.correo}</td>
                <td>
                  <div className={styles.estadoContainer}>
                    <div className={usuario.activo ? styles.puntoVerde : styles.puntoRojo} />
                    <span className={styles.textoEstado}>{usuario.tiempoActivo}</span>
                  </div>
                </td>
                <td style={{ fontWeight: '500' }}>{usuario.rol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* VENTANA EMERGENTE (MODAL) */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContenido}>
            <h2 className={styles.modalTitulo}>Nuevo usuario</h2>
            
            <form onSubmit={handleCrearUsuario}>
              <div className={styles.grupoInputModal}>
                <label className={styles.labelModal}>Nombre completo</label>
                <input 
                  type="text" 
                  className={styles.inputModal} 
                  placeholder="Nombre Apellido"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>

              <div className={styles.grupoInputModal}>
                <label className={styles.labelModal}>Correo institucional</label>
                <input 
                  type="email" 
                  className={styles.inputModal} 
                  placeholder="nombre.apellido@indisa.cl"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                />
              </div>

              <div className={styles.grupoInputModal}>
                <label className={styles.labelModal}>Rol</label>
                <div className={styles.selectModalContainer}>
                  <select 
                    className={styles.selectModal}
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                  >
                    <option value="Tecnólogo médico">Tecnólogo médico</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Enfermero/a">Enfermero/a</option>
                  </select>
                  <div className={styles.selectIconModal}>▼</div>
                </div>
              </div>

              <div className={styles.grupoInputModal}>
                <label className={styles.labelModal}>Contraseña temporal</label>
                <input 
                  type="password" 
                  className={styles.inputModal} 
                  defaultValue="********" 
                />
              </div>

              <div className={styles.checkboxContainerModal}>
                <input type="checkbox" className={styles.checkboxModal} defaultChecked id="cambiarPass" />
                <label htmlFor="cambiarPass" className={styles.checkboxLabelModal}>
                  La contraseña debe ser cambiada en el primer inicio de sesión
                </label>
              </div>

              <div className={styles.modalBotones}>
                <button 
                  type="button" 
                  className={styles.botonCancelarModal}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={styles.botonCrearModal}
                >
                  Crear usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}