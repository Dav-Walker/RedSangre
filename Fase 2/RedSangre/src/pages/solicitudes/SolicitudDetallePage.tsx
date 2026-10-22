import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { supabase } from '../../utils/supabase';
import styles from './SolicitudDetallePage.module.css';

export function SolicitudDetallePage() {
  const navigate = useNavigate();
  const { id } = useParams(); // Atrapamos el ID o código de la URL

  const [solicitud, setSolicitud] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [mensajeCorreo, setMensajeCorreo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarDetalleSolicitud() {
      if (!id) return;
      setCargando(true);
      setError(null);

      // 1. Intentamos buscar primero por el campo de texto 'codigo_solicitud'
      let { data, error: err } = await supabase!
        .from('solicitud')
        .select('*, donante:donante_asignado_id (id, codigo_donante, nombre, apellido, correo)')
        .eq('codigo_solicitud', id)
        .maybeSingle();

      // 2. Si no lo encuentra por código, intentamos buscar por 'id' (por si acaso es numérico o texto compatible)
      if (!data && !err) {
        const resId = await supabase!
          .from('solicitud')
          .select('*, donante:donante_asignado_id (id, codigo_donante, nombre, apellido, correo)')
          .eq('id', id)
          .maybeSingle();
        data = resId.data;
        err = resId.error;
      }

      if (err || !data) {
        setError('No se pudo encontrar la solicitud en la base de datos.');
        setCargando(false);
        return;
      }

      setSolicitud(data);
      setCargando(false);
    }

    cargarDetalleSolicitud();
  }, [id]);

  const handleEnviarCorreo = async () => {
    if (!solicitud) return;
    setEnviandoCorreo(true);
    setMensajeCorreo(null);

    const { data, error: errFuncion } = await supabase!.functions.invoke('enviar-correo-contacto', {
      body: { solicitud_id: solicitud.id },
    });

    setEnviandoCorreo(false);

    if (errFuncion) {
      const cuerpo = await (errFuncion as any).context?.json?.().catch(() => null);
      setMensajeCorreo({ tipo: 'error', texto: cuerpo?.error ?? 'No se pudo enviar el correo.' });
      return;
    }
    if (data?.error) {
      setMensajeCorreo({ tipo: 'error', texto: data.error });
      return;
    }
    setMensajeCorreo({ tipo: 'ok', texto: 'Correo enviado y registrado en la bitácora.' });
  };

  const handleFinalizar = async () => {
    if (!solicitud) return;

    const fechaHoy = new Date().toISOString().split('T')[0];

    // Actualizamos usando el id interno real del registro
    const { error: errUpdate } = await supabase!
      .from('solicitud')
      .update({ 
        estado: 'cerrada',
        fecha_cierre: fechaHoy
      })
      .eq('id', solicitud.id);

    if (errUpdate) {
      alert('Error al finalizar la solicitud: ' + errUpdate.message);
      return;
    }

    alert('Solicitud finalizada con éxito');
    navigate('/solicitudes');
  };

  if (cargando) {
    return (
      <div className={styles.contenedor} style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Cargando detalle de la solicitud...</h2>
      </div>
    );
  }

  if (error || !solicitud) {
    return (
      <div className={styles.contenedor} style={{ textAlign: 'center', padding: '50px' }}>
        <h2 style={{ color: '#c0392b' }}>{error || 'Solicitud no encontrada'}</h2>
        <button className={styles.botonVolver} onClick={() => navigate('/solicitudes')} style={{ marginTop: '20px' }}>
          ← Volver a solicitudes
        </button>
      </div>
    );
  }

  const identificador = solicitud.codigo_solicitud ?? solicitud.id;
  const estadoTexto = solicitud.estado || 'En proceso';
  const esCerrada = estadoTexto.toLowerCase().includes('cerrada') || Boolean(solicitud.fecha_cierre);
  const badgeColor = esCerrada ? 'gris' : 'rojo';

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
        
        {/* TARJETA IZQUIERDA: ESTADO Y DATOS REALES */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Estado</h3>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Estado</span>
            <div className={styles.valorDato}>
              <Badge texto={estadoTexto} color={badgeColor} />
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
              {solicitud.donante ? `${solicitud.donante.nombre} ${solicitud.donante.apellido} (${solicitud.donante.codigo_donante})` : 'Sin asignar'}
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

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fecha de inicio</span>
            <span className={styles.valorDato}>
              {solicitud.created_at ? new Date(solicitud.created_at).toLocaleDateString('es-CL') : '-'}
            </span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fecha de cierre</span>
            <span className={styles.valorDato}>
              {solicitud.fecha_cierre ? new Date(solicitud.fecha_cierre).toLocaleDateString('es-CL') : 'Sin cerrar'}
            </span>
          </div>
        </div>

        {/* TARJETA DERECHA: BITÁCORA */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Bítacora de contacto</h3>
          
          <div className={styles.filaDatos} style={{ backgroundColor: '#fafafa' }}>
            <span className={styles.etiquetaDato} style={{ color: '#999' }}>Canal</span>
            <span className={styles.valorDato} style={{ color: '#999', fontWeight: 'bold' }}>Resultado</span>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Teléfono</span>
            <div className={styles.valorDato}>
              <Badge texto="Confirmado" color="verde" />
            </div>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Correo</span>
            <div className={styles.valorDato}>
              <Badge texto="Enviado" color="rojo" />
            </div>
          </div>
          
          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>WhatsApp</span>
            <div className={styles.valorDato}>
              <Badge texto="Enviado" color="rojo" />
            </div>
          </div>

          <div className={styles.accionesCorreo}>
            <button
              type="button"
              className={styles.botonAzul}
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

      </div>

      {!esCerrada && (
        <div className={styles.pieFicha}>
          <button 
            className={styles.botonAzul}
            onClick={handleFinalizar}
          >
            Finalizar solicitud
          </button>
        </div>
      )}

    </div>
  );
}