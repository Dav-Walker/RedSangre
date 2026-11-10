// Comentarios - Bitácora completa
// Registra en la bitácora (tabla auditoria) una acción hecha desde una Edge Function: quién la hizo y la IP y el
// navegador de su petición, que la base no ve porque la llamada llega con service_role.
// Si el registro falla se deja en los logs de la función y la acción del usuario sigue su curso.
import { clienteAdmin } from './clientes.ts';

type AccionAdmin = 'CREAR_USUARIO' | 'CAMBIAR_CONTRASENA' | 'REENVIAR_ACTIVACION' | 'ACCESO_DENEGADO';

export async function auditarAdmin(
  req: Request,
  actorId: string,
  accion: AccionAdmin,
  datos: { tabla?: string; registroId?: string; detalle?: Record<string, unknown> } = {},
) {
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? null;

  const { error } = await clienteAdmin().rpc('fn_auditar_admin', {
    p_actor: actorId,
    p_accion: accion,
    p_tabla: datos.tabla ?? null,
    p_registro: datos.registroId ?? null,
    p_detalle: datos.detalle ?? null,
    p_ip: ip,
    p_user_agent: req.headers.get('user-agent'),
  });
  if (error) console.error('No se pudo registrar en la bitácora:', accion, error.message);
}
