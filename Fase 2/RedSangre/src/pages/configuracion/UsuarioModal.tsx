import { useState } from 'react';
import type { UserRole } from '../../contexts/auth-context';
import { supabase } from '../../utils/supabase';
import styles from './UsuarioModal.module.css';

interface UsuarioModalProps {
  usuario: {
    id: string;
    nombre: string;
    apellido: string;
    correo: string;
    rol: UserRole;
    activo: boolean;
    created_at: string;
  };
  estaEnLinea: boolean;
  textoEstado: string;
  onCerrar: () => void;
}

const ETIQUETAS_ROL: Record<UserRole, string> = {
  administrador: 'Administrador',
  tecnologo: 'Tecnólogo',
};

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function UsuarioModal({ usuario, estaEnLinea, textoEstado, onCerrar }: UsuarioModalProps) {
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const handleGuardar = async () => {
    setErrorForm(null);
    setExito(false);

    if (nuevaContrasena.length < 6) {
      setErrorForm('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaContrasena !== confirmar) {
      setErrorForm('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);

    const { data: { session } } = await supabase!.auth.getSession();
    const { data, error } = await supabase!.functions.invoke('cambiar-contrasena', {
      body: { usuario_id: usuario.id, nueva_contrasena: nuevaContrasena },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    setGuardando(false);

    if (error || !data?.ok) {
      setErrorForm(data?.error ?? 'No se pudo actualizar la contraseña. Intenta nuevamente.');
    } else {
      setExito(true);
      setNuevaContrasena('');
      setConfirmar('');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCerrar();
  };

  const hayDatosCambio = nuevaContrasena.length > 0 || confirmar.length > 0;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">

        {/* Cabecera */}
        <div className={styles.cabecera}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className={styles.nombreUsuario}>
              {usuario.nombre} {usuario.apellido}
            </h2>
            <span className={styles.rolBadge}>{ETIQUETAS_ROL[usuario.rol]}</span>
          </div>
          <button className={styles.botonCerrar} onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>

        {/* Cuerpo */}
        <div className={styles.cuerpo}>

          {/* Info general */}
          <section className={styles.seccion}>
            <p className={styles.seccionTitulo}>Información</p>
            <hr className={styles.separador} />

            <div className={styles.fila}>
              <span className={styles.etiqueta}>Correo</span>
              <span className={styles.valor}>{usuario.correo}</span>
            </div>

            <div className={styles.fila}>
              <span className={styles.etiqueta}>Estado de cuenta</span>
              <div className={styles.estadoContainer}>
                <div className={estaEnLinea && usuario.activo ? styles.puntoVerde : styles.puntoRojo} />
                <span className={styles.valor}>{textoEstado}</span>
              </div>
            </div>

            <div className={styles.fila}>
              <span className={styles.etiqueta}>Miembro desde</span>
              <span className={styles.valor}>{formatearFecha(usuario.created_at)}</span>
            </div>
          </section>

          {/* Cambio de contraseña */}
          <section className={styles.seccion}>
            <p className={styles.seccionTitulo}>Cambiar contraseña</p>
            <hr className={styles.separador} />

            <div className={styles.campoContrasena}>
              <label className={styles.labelInput} htmlFor="nueva-contrasena">
                Nueva contraseña
              </label>
              <input
                id="nueva-contrasena"
                type="password"
                className={`${styles.input} ${errorForm && nuevaContrasena.length < 6 ? styles.inputError : ''}`}
                value={nuevaContrasena}
                onChange={(e) => { setNuevaContrasena(e.target.value); setErrorForm(null); setExito(false); }}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div className={styles.campoContrasena}>
              <label className={styles.labelInput} htmlFor="confirmar-contrasena">
                Confirmar contraseña
              </label>
              <input
                id="confirmar-contrasena"
                type="password"
                className={`${styles.input} ${errorForm && nuevaContrasena !== confirmar ? styles.inputError : ''}`}
                value={confirmar}
                onChange={(e) => { setConfirmar(e.target.value); setErrorForm(null); setExito(false); }}
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
              />
            </div>

            {errorForm && <p className={styles.mensajeError}>{errorForm}</p>}
            {exito && <p className={styles.mensajeExito}>Contraseña actualizada correctamente.</p>}
          </section>
        </div>

        {/* Pie */}
        <div className={styles.pie}>
          <button className={styles.botonSecundario} onClick={onCerrar}>
            Cerrar
          </button>
          <button
            className={styles.botonPrimario}
            onClick={handleGuardar}
            disabled={!hayDatosCambio || guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

      </div>
    </div>
  );
}
