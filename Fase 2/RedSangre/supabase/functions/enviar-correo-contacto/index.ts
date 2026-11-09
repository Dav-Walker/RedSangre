// Comentarios - Contactar donante por correo
// Edge Function que envía al donante asignado el aviso de una solicitud y lo registra en la bitácora.
// Actúa con el token de quien llama, así que las políticas RLS y los triggers RS002/RS005 se aplican igual.
import { clienteUsuario } from '../_shared/clientes.ts';
import { crearTransporte, remitente } from '../_shared/correo.ts';
import { conCors } from '../_shared/cors.ts';
import { responder, revisarMetodo } from '../_shared/respuesta.ts';

const CONTACTO_BANCO = '+56 9 3640 5976 o al correo redsangre.notificaciones@gmail.com';

function textoCorreo(nombre: string, codigoSolicitud: string, grupo: string, urgencia: string) {
  // Comentarios - Urgencia de la solicitud
  // urgencia_enum solo tiene alta, media y baja; la urgencia alta usa el texto de necesidad urgente.
  const urgente = urgencia === 'alta';
  const frase = urgente
    ? `Existe una necesidad urgente de sangre del grupo ${grupo}.`
    : `Existe una necesidad de sangre del grupo ${grupo}, con fecha por confirmar.`;

  return [
    `Estimado/a ${nombre}:`,
    '',
    frase,
    '',
    `Solicitud: ${codigoSolicitud}.`,
    '',
    'Si está disponible y cumple los requisitos para donar, su colaboración puede ayudar a salvar vidas. Para coordinar, comuníquese con el Banco de Sangre al ' + CONTACTO_BANCO + '.',
    '',
    'Agradecemos sinceramente su solidaridad.',
    '',
    'Atentamente,',
    'Banco de Sangre – Clínica Indisa',
  ].join('\n');
}

Deno.serve(conCors(async (req) => {
  const respuestaMetodo = revisarMetodo(req);
  if (respuestaMetodo) return respuestaMetodo;

  let solicitudId: string | undefined;
  try {
    ({ solicitud_id: solicitudId } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }
  if (!solicitudId) return responder({ error: 'Falta solicitud_id' }, 400);

  const supabase = clienteUsuario(req);

  const { data: solicitud, error: errSolicitud } = await supabase
    .from('solicitud')
    .select('id, codigo_solicitud, estado, grupo_sanguineo_requerido, urgencia, donante:donante_asignado_id (id, nombre, apellido, correo)')
    .eq('id', solicitudId)
    .maybeSingle();

  if (errSolicitud || !solicitud) return responder({ error: 'Solicitud no encontrada o sin acceso' }, 404);
  if (solicitud.estado === 'cerrada') return responder({ error: 'La solicitud está cerrada' }, 409);

  // Comentarios - Contactar donante por correo
  // donante_asignado_id apunta a un solo donante, así que PostgREST devuelve un objeto. El cliente sin esquema
  // tipado lo infiere como lista; por eso se convierte pasando por unknown.
  const donante = solicitud.donante as unknown as { id: string; nombre: string; apellido: string; correo: string | null } | null;
  if (!donante) return responder({ error: 'La solicitud no tiene donante asignado' }, 422);
  if (!donante.correo) return responder({ error: 'El donante no tiene correo registrado' }, 422);

  const { data: puedeContactar, error: errConsentimiento } = await supabase
    .rpc('fn_donante_puede_contactarse', { p_donante_id: donante.id });
  if (errConsentimiento) return responder({ error: 'No se pudo verificar el consentimiento' }, 500);
  if (!puedeContactar) return responder({ error: 'El donante no autorizó contacto' }, 422);

  try {
    await crearTransporte().sendMail({
      from: remitente(),
      to: donante.correo,
      subject: `Solicitud ${solicitud.codigo_solicitud} – Banco de Sangre`,
      text: textoCorreo(donante.nombre, solicitud.codigo_solicitud, solicitud.grupo_sanguineo_requerido, solicitud.urgencia),
    });
  } catch (errorEnvio) {
    console.error('Error al enviar correo de contacto:', errorEnvio);
    return responder({ error: 'No se pudo enviar el correo' }, 502);
  }

  const { error: errRegistro } = await supabase.from('seguimiento_contacto').insert({
    solicitud_id: solicitud.id,
    donante_id: donante.id,
    canal: 'correo',
    resultado: 'enviado',
  });
  if (errRegistro) return responder({ error: 'Correo enviado, pero no se registró en la bitácora' }, 500);

  return responder({ ok: true });
}));
