// Comentarios - Usuarios y roles
// Página de administración: lista de usuarios con su conexión en línea, creación de usuarios y acceso al detalle.
import { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/useAuth';
import { ETIQUETAS_ROL } from '../../utils/roles';
import {
  consultarUltimaConexion,
  escucharPresencia,
  listarUsuarios,
  registrarVistaUsuario,
  type UsuarioFila,
} from '../../servicios/usuarios';
import { UsuarioModal } from './UsuarioModal';
import { NuevoUsuarioModal } from './NuevoUsuarioModal';
import styles from './ConfiguracionPage.module.css';

function formatearUltimaConexion(fecha: string | null): string {
  if (!fecha) return 'Sin conexiones registradas';
  const d = new Date(fecha);
  const dia = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `Última conexión el ${dia} a las ${hora}`;
}

export function ConfiguracionPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState<string[]>([]);
  const [ultimaConexion, setUltimaConexion] = useState<Record<string, string | null>>({});
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioFila | null>(null);
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [avisoCreado, setAvisoCreado] = useState<string | null>(null);

  // Comentarios - Lista de usuarios
  // Carga los usuarios y la última conexión de cada uno.
  useEffect(() => {
    let vigente = true;

    void (async () => {
      const lista = await listarUsuarios();
      if (!vigente) return;
      if (!lista) {
        setError('No se pudieron cargar los usuarios.');
        setCargando(false);
        return;
      }

      const ultimas = await Promise.all(lista.map((u) => consultarUltimaConexion(u.id)));
      if (!vigente) return;
      setUsuarios(lista);
      setUltimaConexion(Object.fromEntries(lista.map((u, i) => [u.id, ultimas[i]])));
      setCargando(false);
    })();

    return () => { vigente = false; };
  }, []);

  const idsOtros = usuarios.filter((u) => u.id !== user?.id).map((u) => u.id).join(',');

  // Comentarios - Presencia en línea
  // Escucha el canal de presencia de cada usuario (salvo el propio). Cuando alguien se desconecta,
  // se relee su última conexión para mostrarla al instante.
  useEffect(() => {
    if (!idsOtros) return;
    const enLinea = new Set<string>();

    const cerrarCanales = idsOtros.split(',').map((id) => escucharPresencia(id, (conectado) => {
      const estaba = enLinea.has(id);
      if (conectado) enLinea.add(id);
      else enLinea.delete(id);
      setUsuariosEnLinea([...enLinea]);

      if (estaba && !conectado) {
        void consultarUltimaConexion(id).then((fecha) => {
          setUltimaConexion((prev) => ({ ...prev, [id]: fecha }));
        });
      }
    }));

    return () => { cerrarCanales.forEach((cerrar) => cerrar()); };
  }, [idsOtros]);

  // Comentarios - Crear usuario desde Configuración
  // Agrega el usuario recién creado a la lista (ordenada por nombre), cierra el modal y avisa del resultado.
  const handleUsuarioCreado = (nuevo: UsuarioFila, correoEnviado: boolean) => {
    setUsuarios((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    setUltimaConexion((prev) => ({ ...prev, [nuevo.id]: null }));
    setCreandoUsuario(false);
    setAvisoCreado(
      correoEnviado
        ? `Usuario ${nuevo.nombre} ${nuevo.apellido} creado. Se envió el correo de activación a ${nuevo.correo}.`
        : `Usuario ${nuevo.nombre} ${nuevo.apellido} creado, pero no se pudo enviar el correo de activación. Ábrelo desde la lista y usa "Reenviar correo de activación".`,
    );
  };

  const estaEnLinea = (id: string) => id === user?.id || usuariosEnLinea.includes(id);

  const textoEstado = (u: UsuarioFila) => {
    if (!u.activo) return 'Cuenta desactivada';
    if (u.debe_cambiar_password) return 'Pendiente de activación';
    if (estaEnLinea(u.id)) return 'Conectado ahora';
    return formatearUltimaConexion(ultimaConexion[u.id] ?? null);
  };

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabeceraSeccion}>
        <div className={styles.espaciador}></div>
        <h1 className={styles.tituloPrincipal}>Usuarios y roles</h1>
        <Button texto="+ Nuevo usuario" onClick={() => { setAvisoCreado(null); setCreandoUsuario(true); }} />
      </div>

      {avisoCreado && <p role="status" className={styles.mensajeExito}>{avisoCreado}</p>}

      {error && <p role="alert" className={styles.mensajeError}>{error}</p>}

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
            {cargando && (
              <tr><td colSpan={4}>Cargando usuarios...</td></tr>
            )}
            {usuarios.map((usuario) => (
              <tr
                key={usuario.id}
                className={styles.fila}
                onClick={() => {
                  // Comentarios - Bitácora completa
                  // Registra que el administrador abrió el detalle de este usuario
                  registrarVistaUsuario(usuario.id);
                  setUsuarioSeleccionado(usuario);
                }}
              >
                <td className={styles.celdaNombre}>{usuario.nombre} {usuario.apellido}</td>
                <td className={styles.celdaCorreo}>{usuario.correo}</td>
                <td>
                  <div className={styles.estadoContainer}>
                    <div className={usuario.activo && estaEnLinea(usuario.id) ? styles.puntoVerde : styles.puntoRojo} />
                    <span className={styles.textoEstado}>{textoEstado(usuario)}</span>
                  </div>
                </td>
                <td className={styles.celdaRol}>{ETIQUETAS_ROL[usuario.rol]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creandoUsuario && (
        <NuevoUsuarioModal
          usuariosExistentes={usuarios}
          onCerrar={() => setCreandoUsuario(false)}
          onCreado={handleUsuarioCreado}
        />
      )}

      {usuarioSeleccionado && (
        <UsuarioModal
          usuario={usuarioSeleccionado}
          estaEnLinea={estaEnLinea(usuarioSeleccionado.id)}
          textoEstado={textoEstado(usuarioSeleccionado)}
          usuarioActualId={user?.id ?? ''}
          onCerrar={() => setUsuarioSeleccionado(null)}
          onCambioEstado={(id, activo) => {
            setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo } : u)));
            setUsuarioSeleccionado((prev) => (prev ? { ...prev, activo } : prev));
          }}
        />
      )}

    </div>
  );
}
