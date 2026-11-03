import { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/useAuth';
import type { UserRole } from '../../contexts/auth-context';
import { supabase } from '../../utils/supabase';
import { UsuarioModal } from './UsuarioModal';
import styles from './ConfiguracionPage.module.css';

interface UsuarioFila {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
  created_at: string;
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

async function cargarUltimaConexion(usuarioId: string): Promise<string | null> {
  const { data } = await supabase!
    .from('auditoria')
    .select('fecha')
    .eq('usuario_id', usuarioId)
    .eq('accion', 'LOGIN')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.fecha ?? null;
}

export function ConfiguracionPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState<string[]>([]);
  const [ultimaConexion, setUltimaConexion] = useState<Record<string, string | null>>({});
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioFila | null>(null);

  useEffect(() => {
    const cargarUsuarios = async () => {
      const { data, error: err } = await supabase!
        .from('usuario')
        .select('id, nombre, apellido, correo, rol, activo, created_at')
        .order('nombre');

      if (err || !data) {
        setError('No se pudieron cargar los usuarios.');
        setCargando(false);
        return;
      }

      const ultimas = await Promise.all(data.map((u) => cargarUltimaConexion(u.id)));

      setUsuarios(data);
      setUltimaConexion(Object.fromEntries(data.map((u, i) => [u.id, ultimas[i]])));
      setCargando(false);
    };

    cargarUsuarios();
  }, []);

  const idsOtros = usuarios.filter((u) => u.id !== user?.id).map((u) => u.id).join(',');

  useEffect(() => {
    if (!idsOtros) return;
    const enLinea = new Set<string>();

    const canales = idsOtros.split(',').map((id) => {
      const canal = supabase!.channel(`presencia:${id}`, { config: { private: true } });
      canal
        .on('presence', { event: 'sync' }, async () => {
          const conectado = Object.keys(canal.presenceState()).length > 0;
          const estaba = enLinea.has(id);
          if (conectado) enLinea.add(id);
          else enLinea.delete(id);
          setUsuariosEnLinea([...enLinea]);

          if (estaba && !conectado) {
            const fecha = await cargarUltimaConexion(id);
            setUltimaConexion((prev) => ({ ...prev, [id]: fecha }));
          }
        })
        .subscribe();
      return canal;
    });

    return () => {
      canales.forEach((canal) => supabase!.removeChannel(canal));
    };
  }, [idsOtros]);

  const estaEnLinea = (id: string) => id === user?.id || usuariosEnLinea.includes(id);

  const textoEstado = (u: UsuarioFila) => {
    if (!u.activo) return 'Cuenta desactivada';
    if (estaEnLinea(u.id)) return 'Conectado ahora';
    return formatearUltimaConexion(ultimaConexion[u.id] ?? null);
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
              <tr
                key={usuario.id}
                className={styles.fila}
                onClick={() => setUsuarioSeleccionado(usuario)}
                style={{ cursor: 'pointer' }}
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

      {usuarioSeleccionado && (
        <UsuarioModal
          usuario={usuarioSeleccionado}
          estaEnLinea={estaEnLinea(usuarioSeleccionado.id)}
          textoEstado={textoEstado(usuarioSeleccionado)}
          onCerrar={() => setUsuarioSeleccionado(null)}
        />
      )}

    </div>
  );
}
