// Comentarios - Detalle de solicitud
// Estado de la solicitud y bitácora de contacto con el donante asignado: llamada, correo y WhatsApp.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, type ColorBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ESTADOS_SOLICITUD, obtenerEstadoSolicitud, type EstadoSolicitud } from '../../utils/estadosSolicitud';
import {
  buscarCandidatos,
  cambiarDonanteAsignado,
  cambiarEstadoSolicitud,
  consultarUltimoContacto,
  enviarCorreoContacto,
  listarContactos,
  obtenerSolicitud,
  registrarContactoWhatsapp,
  registrarRespuestaDonante,
  type CanalContacto,
  type Candidato,
  type ContactoBitacora,
  type RespuestaDonante,
  type SolicitudConDonante,
} from '../../servicios/solicitudes';
import { registrarEvento } from '../../servicios/auditoria';
import type { ResultadoContacto } from '../../tipos/dominio';
import styles from './SolicitudDetallePage.module.css';
import { useAuth } from '../../contexts/useAuth';
import { puedeEditar } from '../../utils/roles';

type Mensaje = { tipo: 'ok' | 'error'; texto: string };

// Comentarios - Bitácora de contacto
// Badge que se muestra según el resultado del último contacto registrado.
// Comentarios - Manejo de errores y excepciones
// 'no_disponible': la consulta del último contacto falló, así que no se afirma que esté "Sin enviar".
const BADGES_CONTACTO: Record<ResultadoContacto | 'no_disponible', { texto: string; color: ColorBadge }> = {
  enviado: { texto: 'Enviado', color: 'rojo' },
  confirmado: { texto: 'Confirmado', color: 'verde' },
  sin_respuesta: { texto: 'Sin respuesta', color: 'gris' },
  rechazado: { texto: 'Rechazado', color: 'gris' },
  no_disponible: { texto: 'No disponible', color: 'gris' },
};

type UltimoContacto = ResultadoContacto | null | 'no_disponible';

// Comentarios - Registrar respuesta del donante
// Textos de los canales y de las respuestas que se pueden registrar en la bitácora.
const TEXTOS_CANAL: Record<CanalContacto, string> = { telefono: 'Teléfono', correo: 'Correo', whatsapp: 'WhatsApp' };
const TEXTOS_RESPUESTA: Record<RespuestaDonante, string> = {
  confirmado: 'Confirma la donación',
  rechazado: 'Rechaza la donación',
  sin_respuesta: 'Sin respuesta',
};

// Comentarios - Manejo de errores y excepciones
// Mensajes generales cuando algo lanza una excepción inesperada en las acciones de la página.
const SOLICITUD_NO_EXISTE = 'La solicitud no existe.';
const ERROR_CARGA = 'No se pudo cargar la solicitud.';

// Comentarios - Contactar donante por WhatsApp
// Mensaje inicial que el usuario puede editar antes de abrir WhatsApp.
function mensajeWhatsappInicial(nombre: string): string {
  return (
    `Hola ${nombre}, le contactamos desde el Banco de Sangre de Clínica Indisa.\n\n` +
    `Su donación voluntaria puede salvar una vida hoy. ` +
    `Lo/La invitamos a acercarse a nuestro centro ubicado en Av. Santa María 1810, Providencia.\n\n` +
    `La donación es gratuita, segura y no le tomará más de una hora. ` +
    `¿Podría venir pronto?\n\n` +
    `Quedamos a su disposición para cualquier consulta. ¡Muchas gracias por su generosidad!`
  );
}

// Comentarios - Contactar donante por WhatsApp
// Enlace de WhatsApp con el número en formato internacional chileno (56...) y el mensaje.
function enlaceWhatsapp(telefono: string, mensaje: string): string {
  const limpio = telefono.replace(/[\s\-+()]/g, '');
  const numero = limpio.startsWith('56') ? limpio : '56' + limpio;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function SolicitudDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  // Comentarios - Perfil TENS solo lectura
  // TENS ve el estado y la bitácora y puede llamar; no cambia el estado ni contacta por correo o WhatsApp
  const { user } = useAuth();
  const conEscritura = puedeEditar(user?.rol);

  const [solicitud, setSolicitud] = useState<SolicitudConDonante | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [mensajeCorreo, setMensajeCorreo] = useState<Mensaje | null>(null);
  const [ultimoCorreo, setUltimoCorreo] = useState<UltimoContacto>(null);
  const [ultimoWhatsapp, setUltimoWhatsapp] = useState<UltimoContacto>(null);
  const [intento, setIntento] = useState(0);
  const [mensajeWhatsappEstado, setMensajeWhatsappEstado] = useState<Mensaje | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<Mensaje | null>(null);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const [modalPcAbierto, setModalPcAbierto] = useState(false);
  const [modalWhatsappAbierto, setModalWhatsappAbierto] = useState(false);
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState('');
  // Comentarios - Registrar respuesta del donante
  // Formulario para anotar qué respondió el donante y por qué canal.
  const [canalRespuesta, setCanalRespuesta] = useState<CanalContacto>('telefono');
  const [resultadoRespuesta, setResultadoRespuesta] = useState<RespuestaDonante>('confirmado');
  const [observacionesRespuesta, setObservacionesRespuesta] = useState('');
  const [registrandoRespuesta, setRegistrandoRespuesta] = useState(false);
  const [mensajeRespuesta, setMensajeRespuesta] = useState<Mensaje | null>(null);
  // Comentarios - Historial de contactos
  // Todos los contactos de la solicitud; errorContactos indica que no se pudieron leer.
  const [contactos, setContactos] = useState<ContactoBitacora[]>([]);
  const [errorContactos, setErrorContactos] = useState<string | null>(null);
  // Comentarios - Reasignar donante de la solicitud
  // Ventana con los candidatos aptos para reemplazar al donante asignado.
  const [modalReasignarAbierto, setModalReasignarAbierto] = useState(false);
  const [candidatosReasignar, setCandidatosReasignar] = useState<Candidato[] | null>(null);
  const [errorReasignar, setErrorReasignar] = useState<string | null>(null);
  const [candidatoElegido, setCandidatoElegido] = useState<string | null>(null);
  const [reasignando, setReasignando] = useState(false);
  const [mensajeReasignar, setMensajeReasignar] = useState<Mensaje | null>(null);

  // Comentarios - Detalle de solicitud
  // Carga la solicitud de la ruta, el último contacto por correo y por WhatsApp con el donante asignado y el historial.
  // "vigente" descarta la respuesta si el usuario navegó a otra solicitud mientras se esperaba.
  useEffect(() => {
    if (!id) return;
    let vigente = true;

    // Comentarios - Manejo de errores y excepciones
    // Distingue "no existe" de una falla al leer (con Reintentar). Una excepción inesperada no deja la página
    // cargando para siempre. El último contacto que no se pueda leer se muestra como "No disponible".
    void (async () => {
      try {
        const resultado = await obtenerSolicitud(id);
        if (!vigente) return;
        if (!resultado.solicitud) {
          setError(resultado.error);
          setCargando(false);
          return;
        }
        const solicitudId = resultado.solicitud.id;
        const donanteId = resultado.solicitud.donante?.id;
        const [correo, whatsapp, historial] = await Promise.all([
          donanteId ? consultarUltimoContacto(solicitudId, 'correo', donanteId) : null,
          donanteId ? consultarUltimoContacto(solicitudId, 'whatsapp', donanteId) : null,
          listarContactos(solicitudId),
        ]);
        if (!vigente) return;
        setSolicitud(resultado.solicitud);
        setUltimoCorreo(correo);
        setUltimoWhatsapp(whatsapp);
        setContactos(historial.contactos);
        setErrorContactos(historial.error);
        setError(null);
        setCargando(false);
      } catch {
        if (!vigente) return;
        setError(ERROR_CARGA);
        setCargando(false);
      }
    })();

    return () => { vigente = false; };
  }, [id, intento]);

  const reintentarCarga = () => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  };

  // Comentarios - Registrar respuesta del donante
  // Vuelve a leer la solicitud y la bitácora sin mostrar la pantalla de carga (la reacción y el estado los cambia la base).
  const recargar = () => setIntento((n) => n + 1);

  // Comentarios - Manejo de errores y excepciones
  // Relee el último contacto de un canal con el donante asignado; si falla por una excepción queda como "No disponible".
  const releerUltimoContacto = (solicitudId: string, canal: 'correo' | 'whatsapp', donanteId: string) =>
    consultarUltimoContacto(solicitudId, canal, donanteId).catch((): UltimoContacto => 'no_disponible');

  // Comentarios - Historial de contactos
  // Relee el historial después de registrar un contacto; una excepción se muestra como error del historial.
  const releerHistorial = async (solicitudId: string) => {
    const historial = await listarContactos(solicitudId)
      .catch(() => ({ contactos: [], error: 'No se pudo cargar el historial de contactos.' }));
    setContactos(historial.contactos);
    setErrorContactos(historial.error);
  };

  const handleEnviarCorreo = async () => {
    if (!solicitud) return;
    setEnviandoCorreo(true);
    setMensajeCorreo(null);

    // Comentarios - Manejo de errores y excepciones
    // Una excepción inesperada libera el botón y muestra un mensaje general.
    const errorEnvio = await enviarCorreoContacto(solicitud.id)
      .catch(() => 'No se pudo enviar el correo. Inténtalo nuevamente.');
    setEnviandoCorreo(false);

    if (errorEnvio) {
      setMensajeCorreo({ tipo: 'error', texto: errorEnvio });
      return;
    }
    setMensajeCorreo({ tipo: 'ok', texto: 'Correo enviado y registrado en la bitácora.' });
    if (solicitud.donante) setUltimoCorreo(await releerUltimoContacto(solicitud.id, 'correo', solicitud.donante.id));
    await releerHistorial(solicitud.id);
  };

  // Comentarios - Cambiar estado de solicitud
  // Cerrar pide confirmación en pantalla, porque una solicitud cerrada ya no admite cambios.
  const handleSeleccionarEstado = (nuevoEstado: EstadoSolicitud) => {
    if (nuevoEstado === 'cerrada') {
      setConfirmandoCierre(true);
      return;
    }
    void aplicarEstado(nuevoEstado);
  };

  const aplicarEstado = async (nuevoEstado: EstadoSolicitud) => {
    if (!solicitud) return;
    setConfirmandoCierre(false);
    setCambiandoEstado(true);
    setMensajeEstado(null);

    // Comentarios - Manejo de errores y excepciones
    // Una excepción inesperada libera el selector y muestra un mensaje general.
    const resultado = await cambiarEstadoSolicitud(solicitud.id, nuevoEstado)
      .catch(() => ({ error: 'No se pudo cambiar el estado. Inténtalo nuevamente.', yaCerrada: false }));
    setCambiandoEstado(false);

    if (resultado.error) {
      setMensajeEstado({ tipo: 'error', texto: resultado.error });
      if (resultado.yaCerrada) setSolicitud({ ...solicitud, estado: 'cerrada' });
      return;
    }
    setSolicitud({ ...solicitud, estado: nuevoEstado });
    setMensajeEstado({ tipo: 'ok', texto: `Estado actualizado a ${ESTADOS_SOLICITUD[nuevoEstado].texto}.` });
  };

  const handleAbrirModalWhatsapp = () => {
    const donante = solicitud?.donante;
    if (!donante?.telefono) return;
    setMensajeWhatsapp(mensajeWhatsappInicial(`${donante.nombre} ${donante.apellido}`));
    setMensajeWhatsappEstado(null);
    setModalWhatsappAbierto(true);
  };

  // Comentarios - Contactar donante por WhatsApp
  // Abre la pestaña de inmediato (si se abre después de esperar a la base, el navegador la bloquea),
  // registra el contacto en la bitácora y recién entonces carga WhatsApp. Si la base rechaza el contacto
  // (por ejemplo, el donante no autorizó contacto), la pestaña se cierra y se muestra el motivo.
  const handleEnviarWhatsapp = async () => {
    const donante = solicitud?.donante;
    if (!solicitud || !donante?.telefono) return;

    const pestana = window.open('', '_blank');
    // Comentarios - Manejo de errores y excepciones
    // El mensaje de error ya viene traducido por el servicio; una excepción inesperada da un mensaje general.
    const errorRegistro = await registrarContactoWhatsapp(solicitud.id, donante.id)
      .catch(() => 'No se pudo registrar el contacto. Inténtalo nuevamente.');
    setModalWhatsappAbierto(false);

    if (errorRegistro) {
      pestana?.close();
      setMensajeWhatsappEstado({ tipo: 'error', texto: `${errorRegistro} No se abrió WhatsApp.` });
      return;
    }

    // Comentarios - Manejo de errores y excepciones
    // Si el navegador bloqueó la ventana, el contacto ya quedó registrado: se avisa cómo permitirla.
    const url = enlaceWhatsapp(donante.telefono, mensajeWhatsapp);
    let abierta = true;
    if (pestana) pestana.location.href = url;
    else abierta = Boolean(window.open(url, '_blank'));
    setMensajeWhatsappEstado(abierta
      ? { tipo: 'ok', texto: 'Contacto registrado en la bitácora.' }
      : { tipo: 'error', texto: 'Contacto registrado, pero tu navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes para este sitio.' });
    setUltimoWhatsapp(await releerUltimoContacto(solicitud.id, 'whatsapp', donante.id));
    await releerHistorial(solicitud.id);
  };

  // Comentarios - Registrar respuesta del donante
  // Agrega la respuesta a la bitácora y relee la solicitud, porque la base actualiza su reacción y su estado.
  const handleRegistrarRespuesta = async () => {
    const donante = solicitud?.donante;
    if (!solicitud || !donante) return;
    setRegistrandoRespuesta(true);
    setMensajeRespuesta(null);

    // Comentarios - Manejo de errores y excepciones
    // Una excepción inesperada libera el botón y muestra un mensaje general.
    const errorRegistro = await registrarRespuestaDonante({
      solicitudId: solicitud.id,
      donanteId: donante.id,
      canal: canalRespuesta,
      resultado: resultadoRespuesta,
      observaciones: observacionesRespuesta,
    }).catch(() => 'No se pudo registrar la respuesta. Inténtalo nuevamente.');
    setRegistrandoRespuesta(false);

    if (errorRegistro) {
      setMensajeRespuesta({ tipo: 'error', texto: errorRegistro });
      return;
    }
    setObservacionesRespuesta('');
    setMensajeRespuesta({
      tipo: 'ok',
      texto: resultadoRespuesta === 'rechazado'
        ? 'Respuesta registrada. El donante rechazó: puedes asignar otro donante con "Cambiar donante".'
        : 'Respuesta registrada en la bitácora.',
    });
    recargar();
  };

  // Comentarios - Reasignar donante de la solicitud
  // Abre la ventana y busca candidatos con el mismo grupo y fenotipo de la solicitud.
  const handleAbrirReasignar = async () => {
    if (!solicitud) return;
    setModalReasignarAbierto(true);
    setMensajeReasignar(null);
    setCandidatosReasignar(null);
    setErrorReasignar(null);
    setCandidatoElegido(null);

    // Comentarios - Manejo de errores y excepciones
    // Una excepción inesperada se muestra como error de búsqueda en la ventana.
    const resultado = await buscarCandidatos(solicitud.grupo_sanguineo_requerido, solicitud.fenotipo_requerido ?? '')
      .catch(() => ({ candidatos: [], error: 'No se pudieron buscar donantes compatibles. Inténtalo nuevamente.' }));
    setErrorReasignar(resultado.error);
    setCandidatosReasignar(resultado.candidatos.filter((c) => c.apto && c.donante_id !== solicitud.donante?.id));
  };

  // Comentarios - Reasignar donante de la solicitud
  // Asigna el candidato elegido; la base vuelve a validar que sea compatible y esté disponible.
  const handleConfirmarReasignar = async () => {
    if (!solicitud || !candidatoElegido) return;
    setReasignando(true);
    setErrorReasignar(null);

    const errorCambio = await cambiarDonanteAsignado(solicitud.id, candidatoElegido)
      .catch(() => 'No se pudo cambiar el donante. Inténtalo nuevamente.');
    setReasignando(false);

    if (errorCambio) {
      setErrorReasignar(errorCambio);
      return;
    }
    setModalReasignarAbierto(false);
    setMensajeRespuesta(null);
    setMensajeCorreo(null);
    setMensajeWhatsappEstado(null);
    setMensajeReasignar({ tipo: 'ok', texto: 'Donante cambiado. Los contactos con el donante anterior quedan en el historial.' });
    recargar();
  };

  // Comentarios - Llamar al donante
  // En celulares abre el marcador; en computador muestra el número en un aviso.
  const handleLlamar = () => {
    const telefono = solicitud?.donante?.telefono;
    // Comentarios - Contacto con donante bloqueado
    // No se llama en una solicitud cerrada ni a un donante bloqueado (el botón también queda deshabilitado).
    if (!telefono || solicitud?.estado === 'cerrada' || solicitud?.donante?.reaccion_adversa_previa) return;

    // Comentarios - Bitácora completa
    // La llamada no pasa por la base, así que se registra aquí: quién llamó (o vio el número) a qué donante
    void registrarEvento('LLAMAR_DONANTE', {
      tabla: 'donante',
      registroId: solicitud?.donante?.id,
      detalle: { solicitud: solicitud?.codigo_solicitud ?? null },
    });

    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!esMovil) {
      setModalPcAbierto(true);
      return;
    }
    window.location.href = `tel:${telefono}`;
  };

  if (cargando) {
    return (
      <div className={`${styles.contenedor} ${styles.estadoPagina}`}>
        <h2>Cargando detalle de la solicitud...</h2>
      </div>
    );
  }

  if (error || !solicitud) {
    return (
      <div className={`${styles.contenedor} ${styles.estadoPagina}`}>
        <h2 className={styles.tituloError}>{error || SOLICITUD_NO_EXISTE}</h2>
        {/* Comentarios - Manejo de errores y excepciones */}
        {/* Si la falla fue al leer (no "no existe"), se ofrece reintentar */}
        {error && error !== SOLICITUD_NO_EXISTE && (
          <button className={`${styles.botonVolver} ${styles.botonVolverError}`} onClick={reintentarCarga}>
            Reintentar
          </button>
        )}
        <button className={`${styles.botonVolver} ${styles.botonVolverError}`} onClick={() => navigate('/solicitudes')}>
          ← Volver a solicitudes
        </button>
      </div>
    );
  }

  const identificador = solicitud.codigo_solicitud ?? solicitud.id;
  const estadoActual = obtenerEstadoSolicitud(solicitud.estado);
  const esCerrada = estadoActual === 'cerrada';
  const telefono = solicitud.donante?.telefono;
  // Comentarios - Contacto con donante bloqueado
  // Un donante bloqueado por reacción adversa no se contacta; tampoco se contacta en una solicitud cerrada.
  const donanteBloqueado = Boolean(solicitud.donante?.reaccion_adversa_previa);
  const sePuedeContactar = !esCerrada && !donanteBloqueado;

  return (
    <div className={styles.contenedor}>

      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/solicitudes')}>
          ← Volver a solicitudes
        </button>
        <h2 className={styles.tituloCentral}>Detalle de solicitud</h2>
      </div>

      <h1 className={styles.tituloPrincipal}>Solicitud {identificador}</h1>

      <div className={styles.layoutColumnas}>

        {/* TARJETA IZQUIERDA: ESTADO Y DATOS */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Estado</h3>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Estado</span>
            <div className={styles.valorEstado}>
              <Badge texto={ESTADOS_SOLICITUD[estadoActual].texto} color={ESTADOS_SOLICITUD[estadoActual].color} />
              {conEscritura && (
                <select
                  className={styles.selectEstado}
                  value={estadoActual}
                  onChange={(e) => handleSeleccionarEstado(e.target.value as EstadoSolicitud)}
                  disabled={cambiandoEstado || esCerrada || confirmandoCierre}
                >
                  {Object.entries(ESTADOS_SOLICITUD).map(([valor, { texto }]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
              )}
              {confirmandoCierre && (
                <div className={styles.confirmacionCierre} role="alert">
                  <span>¿Cerrar la solicitud? Una vez cerrada no podrá modificarse.</span>
                  <button type="button" className={styles.botonCorreo} onClick={() => aplicarEstado('cerrada')}>
                    Sí, cerrar
                  </button>
                  <button type="button" className={styles.botonCancelarModal} onClick={() => setConfirmandoCierre(false)}>
                    Cancelar
                  </button>
                </div>
              )}
              {esCerrada && <span className={styles.avisoCorreo}>Solicitud cerrada: no admite cambios.</span>}
              {mensajeEstado && (
                <span className={mensajeEstado.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError}>
                  {mensajeEstado.texto}
                </span>
              )}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Urgencia</span>
            <span className={styles.valorDato}>{solicitud.urgencia || 'No especificada'}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Grupo requerido</span>
            <span className={styles.valorDato}>{solicitud.grupo_sanguineo_requerido || '-'}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fenotipo requerido</span>
            <span className={styles.valorDato}>{solicitud.fenotipo_requerido || '-'}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Donante asignado</span>
            <div className={styles.valorEstado}>
              <span className={styles.valorDato}>
                {solicitud.donante
                  ? `${solicitud.donante.rut || 'Sin RUT'} - ${solicitud.donante.nombre} ${solicitud.donante.apellido}`
                  : 'Sin asignar'}
              </span>
              {/* Comentarios - Reasignar donante de la solicitud */}
              {/* Permite reemplazar al donante (por ejemplo, si rechazó o quedó bloqueado) mientras la solicitud no esté cerrada. */}
              {conEscritura && !esCerrada && (
                <button type="button" className={styles.botonSecundario} onClick={handleAbrirReasignar}>
                  Cambiar donante
                </button>
              )}
              {mensajeReasignar && (
                <span className={mensajeReasignar.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError}>
                  {mensajeReasignar.texto}
                </span>
              )}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Reacción / Nota</span>
            <span className={styles.valorDato}>{solicitud.reaccion || 'Sin reacciones registradas'}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fecha Agendada</span>
            <span className={styles.valorDato}>
              {solicitud.fecha_agendada ? new Date(solicitud.fecha_agendada).toLocaleDateString('es-CL') : 'Sin agendar'}
            </span>
          </div>
        </div>

        {/* TARJETA DERECHA: BITÁCORA */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Bitácora de contacto</h3>

          {/* Comentarios - Contacto con donante bloqueado */}
          {/* Aviso y botones deshabilitados: al donante bloqueado no se le contacta por ningún canal. */}
          {donanteBloqueado && (
            <p className={styles.avisoBloqueo} role="alert">
              ⚠ El donante asignado está bloqueado por una reacción adversa: no se puede contactar.
              {conEscritura && !esCerrada && ' Usa "Cambiar donante" para asignar otro.'}
            </p>
          )}

          <div className={`${styles.bitacoraFila} ${styles.bitacoraCabecera}`}>
            <span>Canal</span>
            <span>Resultado</span>
            <span>Acción</span>
          </div>

          <div className={styles.bitacoraFila}>
            <span className={styles.bitacoraEtiqueta}>Teléfono</span>
            <div className={styles.bitacoraCelda}>
              <Badge texto={telefono ? 'Disponible' : 'Sin número'} color={telefono ? 'verde' : 'gris'} />
            </div>
            <div className={styles.bitacoraCelda}>
              <button type="button" className={styles.botonCorreo} onClick={handleLlamar} disabled={!telefono || !sePuedeContactar}>
                Llamada
              </button>
            </div>
          </div>

          <div className={styles.bitacoraFila}>
            <span className={styles.bitacoraEtiqueta}>Correo</span>
            <div className={styles.bitacoraCelda}>
              {ultimoCorreo ? (
                <Badge texto={BADGES_CONTACTO[ultimoCorreo].texto} color={BADGES_CONTACTO[ultimoCorreo].color} />
              ) : (
                <Badge texto="Sin enviar" color="gris" />
              )}
            </div>
            <div className={styles.bitacoraCelda}>
              {conEscritura && (
                <button
                  type="button"
                  className={styles.botonCorreo}
                  onClick={handleEnviarCorreo}
                  disabled={enviandoCorreo || !sePuedeContactar || !solicitud.donante?.correo}
                >
                  {enviandoCorreo ? 'Enviando...' : 'Enviar correo'}
                </button>
              )}
              {conEscritura && !solicitud.donante?.correo && (
                <span className={styles.avisoCorreo}>El donante no tiene correo registrado.</span>
              )}
              {mensajeCorreo && (
                <span className={mensajeCorreo.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError}>
                  {mensajeCorreo.texto}
                </span>
              )}
            </div>
          </div>

          <div className={styles.bitacoraFila}>
            <span className={styles.bitacoraEtiqueta}>WhatsApp</span>
            <div className={styles.bitacoraCelda}>
              {/* Comentarios - Manejo de errores y excepciones */}
              {/* 'no_disponible' también cae aquí: muestra "No disponible" en vez de afirmar que no hubo contacto */}
              {ultimoWhatsapp ? (
                <Badge texto={BADGES_CONTACTO[ultimoWhatsapp].texto} color={BADGES_CONTACTO[ultimoWhatsapp].color} />
              ) : (
                <Badge texto={telefono ? 'Disponible' : 'Sin número'} color={telefono ? 'verde' : 'gris'} />
              )}
            </div>
            <div className={styles.bitacoraCelda}>
              {conEscritura && (
                <button
                  type="button"
                  className={styles.botonCorreo}
                  onClick={handleAbrirModalWhatsapp}
                  disabled={!sePuedeContactar || !telefono}
                >
                  Mensaje
                </button>
              )}
              {mensajeWhatsappEstado && (
                <span className={mensajeWhatsappEstado.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError}>
                  {mensajeWhatsappEstado.texto}
                </span>
              )}
            </div>
          </div>

          {/* Comentarios - Registrar respuesta del donante */}
          {/* Anota en la bitácora si el donante confirmó, rechazó o no respondió, y por qué canal. */}
          {conEscritura && solicitud.donante && sePuedeContactar && (
            <div className={styles.formRespuesta}>
              <h4 className={styles.tituloRespuesta}>Registrar respuesta del donante</h4>
              <div className={styles.filaRespuesta}>
                <label className={styles.campoRespuesta}>
                  <span>Canal</span>
                  <select
                    className={styles.selectRespuesta}
                    value={canalRespuesta}
                    onChange={(e) => setCanalRespuesta(e.target.value as CanalContacto)}
                  >
                    {Object.entries(TEXTOS_CANAL).map(([valor, texto]) => (
                      <option key={valor} value={valor}>{texto}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.campoRespuesta}>
                  <span>Respuesta</span>
                  <select
                    className={styles.selectRespuesta}
                    value={resultadoRespuesta}
                    onChange={(e) => setResultadoRespuesta(e.target.value as RespuestaDonante)}
                  >
                    {Object.entries(TEXTOS_RESPUESTA).map(([valor, texto]) => (
                      <option key={valor} value={valor}>{texto}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.campoRespuesta}>
                <span>Observaciones (opcional)</span>
                <textarea
                  className={styles.textareaRespuesta}
                  rows={2}
                  maxLength={500}
                  value={observacionesRespuesta}
                  onChange={(e) => setObservacionesRespuesta(e.target.value)}
                  placeholder="Ej.: confirma asistencia mañana a las 9:00"
                />
              </label>
              <button
                type="button"
                className={styles.botonCorreo}
                onClick={handleRegistrarRespuesta}
                disabled={registrandoRespuesta}
              >
                {registrandoRespuesta ? 'Registrando...' : 'Registrar respuesta'}
              </button>
              {mensajeRespuesta && (
                <span className={mensajeRespuesta.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError}>
                  {mensajeRespuesta.texto}
                </span>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Comentarios - Historial de contactos */}
      {/* Todos los contactos en orden cronológico, también los de donantes que se reemplazaron. */}
      <div className={`${styles.tarjeta} ${styles.tarjetaHistorial}`}>
        <h3 className={styles.tarjetaHeader}>Historial de contactos</h3>
        {errorContactos ? (
          <p className={`${styles.mensajeError} ${styles.historialVacio}`}>{errorContactos}</p>
        ) : contactos.length === 0 ? (
          <p className={styles.historialVacio}>Aún no hay contactos registrados.</p>
        ) : (
          <ul className={styles.listaHistorial}>
            {contactos.map((c) => (
              <li key={c.id} className={styles.itemHistorial}>
                <span className={styles.fechaHistorial}>{new Date(c.fecha).toLocaleString('es-CL')}</span>
                <span>
                  {c.donante ? `${c.donante.nombre} ${c.donante.apellido} (${c.donante.codigo_donante})` : 'Donante'}
                  {' · '}{TEXTOS_CANAL[c.canal]}
                </span>
                <Badge texto={BADGES_CONTACTO[c.resultado].texto} color={BADGES_CONTACTO[c.resultado].color} />
                {c.observaciones && <span className={styles.observacionHistorial}>{c.observaciones}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comentarios - Reasignar donante de la solicitud */}
      {/* Lista de candidatos aptos (misma búsqueda priorizada de Nueva solicitud) para elegir el reemplazo. */}
      {modalReasignarAbierto && (
        <Modal
          className={styles.modalReasignar}
          idTitulo="titulo-reasignar"
          onCerrar={reasignando ? undefined : () => setModalReasignarAbierto(false)}
        >
          <h2 id="titulo-reasignar" className={styles.tituloReasignar}>Cambiar donante asignado</h2>
          <p className={styles.modalSubtitulo}>
            Candidatos disponibles para {solicitud.grupo_sanguineo_requerido}
            {solicitud.fenotipo_requerido ? ` con fenotipo ${solicitud.fenotipo_requerido}` : ''}, en orden de prioridad.
          </p>
          {errorReasignar && <p className={styles.mensajeError} role="alert">{errorReasignar}</p>}
          {candidatosReasignar === null ? (
            <p className={styles.historialVacio}>Buscando candidatos...</p>
          ) : candidatosReasignar.length === 0 ? (
            <p className={styles.historialVacio}>No hay otros candidatos disponibles en este momento.</p>
          ) : (
            <ul className={styles.listaCandidatos}>
              {candidatosReasignar.map((c) => (
                <li key={c.donante_id}>
                  <button
                    type="button"
                    className={`${styles.opcionCandidato} ${candidatoElegido === c.donante_id ? styles.opcionElegida : ''}`}
                    onClick={() => setCandidatoElegido(c.donante_id)}
                    aria-pressed={candidatoElegido === c.donante_id}
                  >
                    <strong>{c.nombre_completo}</strong>
                    <span>
                      {c.codigo_donante} · {c.grupo_sanguineo} · {c.fenotipo || 'Sin fenotipo'}
                      {c.distancia_km != null ? ` · ${c.distancia_km.toFixed(1)} km` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.botonesModal}>
            <button
              type="button"
              className={styles.botonCancelarModal}
              onClick={() => setModalReasignarAbierto(false)}
              disabled={reasignando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.botonCorreo}
              onClick={handleConfirmarReasignar}
              disabled={!candidatoElegido || reasignando}
            >
              {reasignando ? 'Cambiando...' : 'Asignar donante'}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL DE WHATSAPP */}
      {modalWhatsappAbierto && (
        <Modal className={styles.modalWsp} idTitulo="titulo-whatsapp" onCerrar={() => setModalWhatsappAbierto(false)}>
          <div className={styles.modalCabeceraWsp}>
            <h2 id="titulo-whatsapp">Enviar WhatsApp</h2>
          </div>
          <p className={styles.modalSubtitulo}>
            Para: <strong>{solicitud.donante?.nombre} {solicitud.donante?.apellido}</strong>
            {' '}— {telefono}
          </p>
          <textarea
            className={styles.textareaWsp}
            value={mensajeWhatsapp}
            onChange={(e) => setMensajeWhatsapp(e.target.value)}
            rows={9}
          />
          <div className={styles.botonesModal}>
            <button type="button" className={styles.botonCancelarModal} onClick={() => setModalWhatsappAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className={styles.botonEnviarWsp} onClick={handleEnviarWhatsapp}>
              Abrir WhatsApp
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL DE AVISO SI ESTÁN EN PC */}
      {modalPcAbierto && (
        <Modal className={styles.modalAvisoPc} idTitulo="titulo-aviso-pc" onCerrar={() => setModalPcAbierto(false)}>
          <h3 id="titulo-aviso-pc" className={styles.tituloAvisoPc}>🖥️ Acción no disponible en PC</h3>
          <p className={styles.textoAvisoPc}>
            La función de llamada telefónica directa está diseñada para ser utilizada desde un teléfono celular o tablet por las enfermeras.
          </p>
          {telefono && <p className={styles.telefonoAvisoPc}>Teléfono del donante: {telefono}</p>}
          <button type="button" className={styles.botonEntendido} onClick={() => setModalPcAbierto(false)}>
            Entendido
          </button>
        </Modal>
      )}

    </div>
  );
}
