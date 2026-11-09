// Comentarios - Detalle de solicitud
// Estado de la solicitud y bitácora de contacto con el donante asignado: llamada, correo y WhatsApp.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, type ColorBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ESTADOS_SOLICITUD, obtenerEstadoSolicitud, type EstadoSolicitud } from '../../utils/estadosSolicitud';
import {
  cambiarEstadoSolicitud,
  consultarUltimoContacto,
  enviarCorreoContacto,
  obtenerSolicitud,
  registrarContactoWhatsapp,
  type SolicitudConDonante,
} from '../../servicios/solicitudes';
import type { ResultadoContacto } from '../../tipos/dominio';
import styles from './SolicitudDetallePage.module.css';

type Mensaje = { tipo: 'ok' | 'error'; texto: string };

// Comentarios - Bitácora de contacto
// Badge que se muestra según el resultado del último contacto registrado.
const BADGES_CONTACTO: Record<ResultadoContacto, { texto: string; color: ColorBadge }> = {
  enviado: { texto: 'Enviado', color: 'rojo' },
  confirmado: { texto: 'Confirmado', color: 'verde' },
  sin_respuesta: { texto: 'Sin respuesta', color: 'gris' },
  rechazado: { texto: 'Rechazado', color: 'gris' },
};

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

  const [solicitud, setSolicitud] = useState<SolicitudConDonante | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [mensajeCorreo, setMensajeCorreo] = useState<Mensaje | null>(null);
  const [ultimoCorreo, setUltimoCorreo] = useState<ResultadoContacto | null>(null);
  const [ultimoWhatsapp, setUltimoWhatsapp] = useState<ResultadoContacto | null>(null);
  const [mensajeWhatsappEstado, setMensajeWhatsappEstado] = useState<Mensaje | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<Mensaje | null>(null);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const [modalPcAbierto, setModalPcAbierto] = useState(false);
  const [modalWhatsappAbierto, setModalWhatsappAbierto] = useState(false);
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState('');

  // Comentarios - Detalle de solicitud
  // Carga la solicitud de la ruta y el último contacto por correo y por WhatsApp.
  // "vigente" descarta la respuesta si el usuario navegó a otra solicitud mientras se esperaba.
  useEffect(() => {
    if (!id) return;
    let vigente = true;

    void (async () => {
      const datos = await obtenerSolicitud(id);
      if (!vigente) return;
      if (!datos) {
        setError('No se pudo encontrar la solicitud en la base de datos.');
        setCargando(false);
        return;
      }
      const [correo, whatsapp] = await Promise.all([
        consultarUltimoContacto(datos.id, 'correo'),
        consultarUltimoContacto(datos.id, 'whatsapp'),
      ]);
      if (!vigente) return;
      setSolicitud(datos);
      setUltimoCorreo(correo);
      setUltimoWhatsapp(whatsapp);
      setCargando(false);
    })();

    return () => { vigente = false; };
  }, [id]);

  const handleEnviarCorreo = async () => {
    if (!solicitud) return;
    setEnviandoCorreo(true);
    setMensajeCorreo(null);

    const errorEnvio = await enviarCorreoContacto(solicitud.id);
    setEnviandoCorreo(false);

    if (errorEnvio) {
      setMensajeCorreo({ tipo: 'error', texto: errorEnvio });
      return;
    }
    setMensajeCorreo({ tipo: 'ok', texto: 'Correo enviado y registrado en la bitácora.' });
    setUltimoCorreo(await consultarUltimoContacto(solicitud.id, 'correo'));
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

    const resultado = await cambiarEstadoSolicitud(solicitud.id, nuevoEstado);
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
    const errorRegistro = await registrarContactoWhatsapp(solicitud.id, donante.id);
    setModalWhatsappAbierto(false);

    if (errorRegistro) {
      pestana?.close();
      setMensajeWhatsappEstado({ tipo: 'error', texto: 'No se pudo registrar el contacto: ' + errorRegistro });
      return;
    }

    const url = enlaceWhatsapp(donante.telefono, mensajeWhatsapp);
    if (pestana) pestana.location.href = url;
    else window.open(url, '_blank');
    setMensajeWhatsappEstado({ tipo: 'ok', texto: 'Contacto registrado en la bitácora.' });
    setUltimoWhatsapp(await consultarUltimoContacto(solicitud.id, 'whatsapp'));
  };

  // Comentarios - Llamar al donante
  // En celulares abre el marcador; en computador muestra el número en un aviso.
  const handleLlamar = () => {
    const telefono = solicitud?.donante?.telefono;
    if (!telefono) return;

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
        <h2 className={styles.tituloError}>{error || 'Solicitud no encontrada'}</h2>
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
            <span className={styles.valorDato}>
              {solicitud.donante
                ? `${solicitud.donante.rut || 'Sin RUT'} - ${solicitud.donante.nombre} ${solicitud.donante.apellido}`
                : 'Sin asignar'}
            </span>
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
              <button type="button" className={styles.botonCorreo} onClick={handleLlamar} disabled={!telefono}>
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
              <button
                type="button"
                className={styles.botonCorreo}
                onClick={handleEnviarCorreo}
                disabled={enviandoCorreo || esCerrada || !solicitud.donante?.correo}
              >
                {enviandoCorreo ? 'Enviando...' : 'Enviar correo'}
              </button>
              {!solicitud.donante?.correo && (
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
              {ultimoWhatsapp ? (
                <Badge texto={BADGES_CONTACTO[ultimoWhatsapp].texto} color={BADGES_CONTACTO[ultimoWhatsapp].color} />
              ) : (
                <Badge texto={telefono ? 'Disponible' : 'Sin número'} color={telefono ? 'verde' : 'gris'} />
              )}
            </div>
            <div className={styles.bitacoraCelda}>
              <button
                type="button"
                className={styles.botonCorreo}
                onClick={handleAbrirModalWhatsapp}
                disabled={esCerrada || !telefono}
              >
                Mensaje
              </button>
              {mensajeWhatsappEstado && (
                <span className={mensajeWhatsappEstado.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError}>
                  {mensajeWhatsappEstado.texto}
                </span>
              )}
            </div>
          </div>

        </div>

      </div>

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
