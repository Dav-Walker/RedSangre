import { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { validarContrasena } from '../../utils/politicaContrasena';
import { ETIQUETAS_ROL } from '../../utils/roles';
import {
  cambiarContrasenaUsuario,
  cambiarEstadoUsuario,
  reenviarActivacion,
  type UsuarioFila,
} from '../../servicios/usuarios';
import styles from './UsuarioModal.module.css';

interface UsuarioModalProps {
  usuario: UsuarioFila;
  estaEnLinea: boolean;
  textoEstado: string;
  usuarioActualId: string;
  onCerrar: () => void;
  onCambioEstado: (id: string, activo: boolean) => void;
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function UsuarioModal({ usuario, estaEnLinea, textoEstado, usuarioActualId, onCerrar, onCambioEstado }: UsuarioModalProps) {
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [confirmandoCambio, setConfirmandoCambio] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const [avisoReenvio, setAvisoReenvio] = useState<{ texto: string; esError: boolean } | null>(null);

  const handleGuardar = async () => {
    setErrorForm(null);
    setExito(false);

    const errorPolitica = validarContrasena(nuevaContrasena);
    if (errorPolitica) {
      setErrorForm(errorPolitica);
      return;
    }
    if (nuevaContrasena !== confirmar) {
      setErrorForm('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);

    const errorCambio = await cambiarContrasenaUsuario(usuario.id, nuevaContrasena);
    setGuardando(false);

    if (errorCambio) {
      setErrorForm(errorCambio);
    } else {
      setExito(true);
      setNuevaContrasena('');
      setConfirmar('');
    }
  };

  const handleCambiarEstado = async () => {
    setCambiandoEstado(true);
    setErrorEstado(null);

    const nuevoEstado = !usuario.activo;
    const errorEstadoUsuario = await cambiarEstadoUsuario(usuario.id, nuevoEstado);

    setCambiandoEstado(false);
    setConfirmandoCambio(false);

    if (errorEstadoUsuario) {
      setErrorEstado(errorEstadoUsuario);
    } else {
      onCambioEstado(usuario.id, nuevoEstado);
    }
  };

  // Comentarios - Activación de cuenta por correo
  // Pide a la Edge Function reenviar-activacion que envíe un enlace nuevo al correo del usuario pendiente.
  const handleReenviar = async () => {
    setReenviando(true);
    setAvisoReenvio(null);

    const errorReenvio = await reenviarActivacion(usuario.id);
    setReenviando(false);

    if (errorReenvio) {
      setAvisoReenvio({ texto: errorReenvio, esError: true });
    } else {
      setAvisoReenvio({ texto: `Correo de activación enviado a ${usuario.correo}.`, esError: false });
    }
  };

  const esPropioUsuario = usuario.id === usuarioActualId;
  const hayDatosCambio = nuevaContrasena.length > 0 || confirmar.length > 0;

  return (
    <Modal className={styles.modal} idTitulo="titulo-usuario" onCerrar={onCerrar}>

        {/* Cabecera */}
        <div className={styles.cabecera}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className={styles.nombreUsuario} id="titulo-usuario">
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

          {/* Activación pendiente */}
          {usuario.debe_cambiar_password && usuario.activo && (
            <section className={styles.seccion}>
              <p className={styles.seccionTitulo}>Activación de la cuenta</p>
              <hr className={styles.separador} />
              <p className={styles.textoAyuda}>
                Esta persona aún no define su contraseña. Si perdió el correo o el enlace venció, puedes enviarle uno nuevo.
              </p>
              <div>
                <button className={styles.botonSecundario} onClick={handleReenviar} disabled={reenviando}>
                  {reenviando ? 'Enviando...' : 'Reenviar correo de activación'}
                </button>
              </div>
              {avisoReenvio && (
                <p className={avisoReenvio.esError ? styles.mensajeError : styles.mensajeExito}>{avisoReenvio.texto}</p>
              )}
            </section>
          )}

          {/* Cambio de contraseña */}
          {!usuario.debe_cambiar_password && (
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
                className={`${styles.input} ${errorForm && validarContrasena(nuevaContrasena) ? styles.inputError : ''}`}
                value={nuevaContrasena}
                onChange={(e) => { setNuevaContrasena(e.target.value); setErrorForm(null); setExito(false); }}
                placeholder="Mínimo 8, con número y símbolo (ej. un punto)"
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
          )}
        </div>

        {/* Pie */}
        <div className={styles.pie}>
          <div className={styles.pieIzquierda}>
            {!esPropioUsuario && !confirmandoCambio && (
              <>
                <button
                  className={usuario.activo ? styles.botonEliminar : styles.botonReactivar}
                  onClick={() => { setConfirmandoCambio(true); setErrorEstado(null); }}
                >
                  {usuario.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                </button>
                {errorEstado && <p className={styles.mensajeErrorPie}>{errorEstado}</p>}
              </>
            )}
            {!esPropioUsuario && confirmandoCambio && (
              <div className={styles.confirmacionEliminar}>
                <span className={styles.textoConfirmacion}>
                  {usuario.activo
                    ? '¿Desactivar? Perderá el acceso de inmediato.'
                    : '¿Reactivar? Podrá ingresar nuevamente.'}
                </span>
                <button className={styles.botonEliminarConfirmar} onClick={handleCambiarEstado} disabled={cambiandoEstado}>
                  {cambiandoEstado ? 'Guardando...' : usuario.activo ? 'Sí, desactivar' : 'Sí, reactivar'}
                </button>
                <button className={styles.botonCancelarEliminar} onClick={() => setConfirmandoCambio(false)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className={styles.pieDerecha}>
            <button className={styles.botonSecundario} onClick={onCerrar}>
              Cerrar
            </button>
            <button
              className={styles.botonPrimario}
              onClick={handleGuardar}
              disabled={!hayDatosCambio || guardando || usuario.debe_cambiar_password}
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

    </Modal>
  );
}
