import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
  });
}

const CONTACTO_BANCO = '+56 9 3640 5976 o al correo redsangre.notificaciones@gmail.com';

function textoCorreo(nombre: string, codigoSolicitud: string, grupo: string, urgencia: string) {
  const urgente = urgencia === 'alta' || urgencia === 'emergencia vital';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  let solicitudId: string | undefined;
  try {
    ({ solicitud_id: solicitudId } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }
  if (!solicitudId) return responder({ error: 'Falta solicitud_id' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );

  const { data: solicitud, error: errSolicitud } = await supabase
    .from('solicitud')
    .select('id, codigo_solicitud, estado, grupo_sanguineo_requerido, urgencia, donante:donante_asignado_id (id, nombre, apellido, correo)')
    .eq('id', solicitudId)
    .maybeSingle();

  if (errSolicitud || !solicitud) return responder({ error: 'Solicitud no encontrada o sin acceso' }, 404);
  if (solicitud.estado === 'cerrada') return responder({ error: 'La solicitud está cerrada' }, 409);

  const donante = solicitud.donante as { id: string; nombre: string; apellido: string; correo: string | null } | null;
  if (!donante) return responder({ error: 'La solicitud no tiene donante asignado' }, 422);
  if (!donante.correo) return responder({ error: 'El donante no tiene correo registrado' }, 422);

  const { data: puedeContactar, error: errConsentimiento } = await supabase
    .rpc('fn_donante_puede_contactarse', { p_donante_id: donante.id });
  if (errConsentimiento) return responder({ error: 'No se pudo verificar el consentimiento' }, 500);
  if (!puedeContactar) return responder({ error: 'El donante no autorizó contacto' }, 422);

  const usuarioGmail = Deno.env.get('GMAIL_USER');
  const transporte = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: usuarioGmail, pass: Deno.env.get('GMAIL_APP_PASSWORD') },
  });

  try {
    await transporte.sendMail({
      from: `"RedSangre – Banco de Sangre" <${usuarioGmail}>`,
      to: donante.correo,
      subject: `Solicitud ${solicitud.codigo_solicitud} – Banco de Sangre`,
      text: textoCorreo(donante.nombre, solicitud.codigo_solicitud, solicitud.grupo_sanguineo_requerido, solicitud.urgencia),
    });
  } catch {
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
});
