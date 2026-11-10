// Comentarios - Crear usuario desde Configuración
// Modal con el formulario de nuevo usuario. Valida los datos y llama a la Edge Function crear-usuario,
// que envía un correo de activación: la persona define su propia contraseña desde el enlace.
import { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { correoCanonico, validarCorreo } from '../../utils/validacionCorreo';
import { crearUsuario, type UsuarioFila } from '../../servicios/usuarios';
import type { RolUsuario } from '../../tipos/dominio';
import styles from './NuevoUsuarioModal.module.css';

interface NuevoUsuarioModalProps {
  usuariosExistentes: { correo: string; activo: boolean }[];
  onCerrar: () => void;
  onCreado: (usuario: UsuarioFila, correoEnviado: boolean) => void;
}

type Campo = 'nombre' | 'apellido' | 'correo';
type Errores = Partial<Record<Campo, string>>;

// Comentarios - Crear usuario
// Revisa los campos y devuelve un mensaje por cada uno que no cumple. Los mismos criterios los repite la Edge Function.
function validar(
  nombre: string,
  apellido: string,
  correo: string,
  errorDuplicado: (correo: string) => string | null,
): Errores {
  const errores: Errores = {};
  if (!nombre.trim()) errores.nombre = 'Ingresa el nombre.';
  if (!apellido.trim()) errores.apellido = 'Ingresa el apellido.';
  const errorCorreo = validarCorreo(correo) ?? errorDuplicado(correo);
  if (errorCorreo) errores.correo = errorCorreo;
  return errores;
}

export function NuevoUsuarioModal({ usuariosExistentes, onCerrar, onCreado }: NuevoUsuarioModalProps) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<RolUsuario>('tecnologo');
  const [errores, setErrores] = useState<Errores>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  // Comentarios - Validar correo duplicado y correo real (RF-07)
  // Avisa antes de enviar si el correo ya existe (activo o desactivado) en la lista cargada. El servidor vuelve a comprobarlo.
  const errorDuplicado = (valor: string): string | null => {
    const existente = usuariosExistentes.find((u) => correoCanonico(u.correo) === correoCanonico(valor));
    if (!existente) return null;
    return existente.activo
      ? 'Ya existe un usuario con ese correo.'
      : 'Ya existe un usuario con ese correo y está desactivado. Reactívalo desde la lista.';
  };

  const revisarCorreo = () => {
    if (!correo.trim()) return;
    const mensaje = validarCorreo(correo) ?? errorDuplicado(correo);
    if (mensaje) setErrores((previos) => ({ ...previos, correo: mensaje }));
  };

  const hayDatos = [nombre, apellido, correo].some((valor) => valor.length > 0);

  // Comentarios - Crear usuario
  // Edita un campo y quita el error de ese campo y el del servidor.
  const cambiarCampo = (campo: Campo, valor: string) => {
    const setters: Record<Campo, (v: string) => void> = {
      nombre: setNombre,
      apellido: setApellido,
      correo: setCorreo,
    };
    setters[campo](valor);
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
    setErrorServidor(null);
  };

  // Comentarios - Crear usuario
  // Valida, llama a la Edge Function con el token de la sesión y entrega el usuario creado a la página.
  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creando) return;

    const erroresForm = validar(nombre, apellido, correo, errorDuplicado);
    setErrores(erroresForm);
    setErrorServidor(null);
    if (Object.keys(erroresForm).length > 0) return;

    setCreando(true);
    const resultado = await crearUsuario({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correo.trim().toLowerCase(),
      rol,
    });
    setCreando(false);

    if ('error' in resultado) {
      setErrorServidor(resultado.error);
      return;
    }
    onCreado(resultado.usuario, resultado.correoEnviado);
  };

  const claseInput = (campo: Campo) => `${styles.input} ${errores[campo] ? styles.inputError : ''}`;

  return (
    // Comentarios - Crear usuario
    // Escape y clic fuera cierran solo si el formulario está vacío, para no perder lo escrito sin querer.
    <Modal
      className={styles.modal}
      idTitulo="titulo-nuevo-usuario"
      onCerrar={creando ? undefined : onCerrar}
      cerrarConClicFuera={!hayDatos}
    >
      <form className={styles.formulario} onSubmit={handleCrear} noValidate>

        <div className={styles.cabecera}>
          <h2 className={styles.titulo} id="titulo-nuevo-usuario">Nuevo usuario</h2>
          <button type="button" className={styles.botonCerrar} onClick={onCerrar} disabled={creando} aria-label="Cerrar">×</button>
        </div>

        <div className={styles.cuerpo}>
          <div className={styles.filaDoble}>
            <div className={styles.campo}>
              <label className={styles.label} htmlFor="nuevo-nombre">Nombre</label>
              <input
                id="nuevo-nombre"
                className={claseInput('nombre')}
                value={nombre}
                onChange={(e) => cambiarCampo('nombre', e.target.value)}
                autoComplete="off"
              />
              {errores.nombre && <p className={styles.mensajeCampo}>{errores.nombre}</p>}
            </div>
            <div className={styles.campo}>
              <label className={styles.label} htmlFor="nuevo-apellido">Apellido</label>
              <input
                id="nuevo-apellido"
                className={claseInput('apellido')}
                value={apellido}
                onChange={(e) => cambiarCampo('apellido', e.target.value)}
                autoComplete="off"
              />
              {errores.apellido && <p className={styles.mensajeCampo}>{errores.apellido}</p>}
            </div>
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="nuevo-correo">Correo</label>
            <input
              id="nuevo-correo"
              type="email"
              className={claseInput('correo')}
              value={correo}
              onChange={(e) => cambiarCampo('correo', e.target.value)}
              onBlur={revisarCorreo}
              placeholder="nombre@indisa.cl, @duocuc.cl o @gmail.com"
              autoComplete="off"
            />
            {errores.correo && <p className={styles.mensajeCampo}>{errores.correo}</p>}
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="nuevo-rol">Rol</label>
            <select
              id="nuevo-rol"
              className={styles.select}
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
            >
              <option value="tecnologo">Tecnólogo</option>
              <option value="administrador">Administrador</option>
              {/* Comentarios - Perfil TENS solo lectura */}
              {/* TENS solo consulta datos y llama a los donantes */}
              <option value="tens">TENS (solo lectura)</option>
            </select>
          </div>

          <p className={styles.nota}>
            Se enviará un correo de activación a esta dirección. La persona define su propia contraseña desde el enlace,
            y la cuenta queda pendiente hasta que lo haga.
          </p>

          {errorServidor && <p className={styles.mensajeError} role="alert">{errorServidor}</p>}
        </div>

        <div className={styles.pie}>
          <button type="button" className={styles.botonSecundario} onClick={onCerrar} disabled={creando}>
            Cancelar
          </button>
          <button type="submit" className={styles.botonPrimario} disabled={creando}>
            {creando ? 'Creando y enviando correo...' : 'Crear y enviar activación'}
          </button>
        </div>

      </form>
    </Modal>
  );
}
