import { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../contexts/auth-context';
import { supabase } from '../../utils/supabase';
import styles from './ConfiguracionPage.module.css';

interface UsuarioFila {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
  ultimaConexion: string | null;
}

const ETIQUETAS_ROL: Record<UserRole, string> = {
  administrador: 'Administrador',
  tecnologo: 'Tecnólogo',
};

function formatearUltimaConexion(fecha: string | null): string {
  if (!fecha) return 'Sin conexiones registradas';
  const d = new Date(fecha);
  const dia = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `Última conexión el ${dia} a las ${hora}`;
}

export function ConfiguracionPage() {
  const { usuariosEnLinea } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarUsuarios = async () => {
      const { data, error: err } = await supabase!
        .from('usuario')
        .select('id, nombre, apellido, correo, rol, activo')
        .order('nombre');

      if (err || !data) {
        setError('No se pudieron cargar los usuarios.');
        setCargando(false);
        return;
      }

      // Una consulta por usuario: devuelve la última conexión exacta sin traer toda la bitácora.
      const ultimas = await Promise.all(
        data.map(async (u) => {
          const { data: login } = await supabase!
            .from('auditoria')
            .select('fecha')
            .eq('usuario_id', u.id)
            .eq('accion', 'LOGIN')
            .order('fecha', { ascending: false })
            .limit(1)
            .maybeSingle();
          return login?.fecha ?? null;
        })
      );

      setUsuarios(data.map((u, i) => ({ ...u, ultimaConexion: ultimas[i] })));
      setCargando(false);
    };

    cargarUsuarios();
  }, []);

  const textoEstado = (u: UsuarioFila) => {
    if (!u.activo) return 'Cuenta desactivada';
    if (usuariosEnLinea.includes(u.id)) return 'Conectado ahora';
    return formatearUltimaConexion(u.ultimaConexion);
  };

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabeceraSeccion}>
        <div className={styles.espaciador}></div>
        <h1 className={styles.tituloPrincipal}>Usuarios y roles</h1>
        <Button texto="+ Nuevo usuario" disabled />
      </div>
      <p className={styles.nota}>La creación de usuarios desde esta pantalla aún no está disponible.</p>

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
              <tr key={usuario.id} className={styles.fila}>
                <td className={styles.celdaNombre}>{usuario.nombre} {usuario.apellido}</td>
                <td className={styles.celdaCorreo}>{usuario.correo}</td>
                <td>
                  <div className={styles.estadoContainer}>
                    <div className={usuario.activo && usuariosEnLinea.includes(usuario.id) ? styles.puntoVerde : styles.puntoRojo} />
                    <span className={styles.textoEstado}>{textoEstado(usuario)}</span>
                  </div>
                </td>
                <td className={styles.celdaRol}>{ETIQUETAS_ROL[usuario.rol]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
