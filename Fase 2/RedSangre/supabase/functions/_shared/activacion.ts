// Comentarios - Activación de cuenta por correo
// Código compartido por crear-usuario y reenviar-activacion: genera el enlace de activación y envía el correo.
import type { ClienteSupabase } from './clientes.ts';
import { crearTransporte, remitente } from './correo.ts';

// invite: cuenta nueva sin confirmar. recovery: la persona ya confirmó su correo pero aún no tiene contraseña.
export type TipoEnlace = 'invite' | 'recovery';

// Comentarios - Activación de cuenta por correo
// Pide a Auth un token de un solo uso y arma el enlace hacia la aplicación (/activar). El correo se envía aparte.
// Con tipo invite, Auth también crea la cuenta (sin contraseña y sin confirmar). APP_URL es un secreto de Supabase.
export async function generarEnlace(
  admin: ClienteSupabase,
  correo: string,
  tipo: TipoEnlace,
  datos?: { nombre: string; apellido: string },
): Promise<{ enlace: string; usuarioId: string } | { error: string }> {
  // Comentarios - APP_URL obligatorio
  // Sin APP_URL el enlace apuntaría a localhost y no serviría en producción: se informa el error en vez de enviarlo.
  // Se revisa antes de generateLink, porque con tipo invite esa llamada ya crea la cuenta en Auth.
  // Para probar en local, definir APP_URL=http://localhost:5173 en supabase/functions/.env.
  const urlApp = Deno.env.get('APP_URL')?.replace(/\/+$/, '');
  if (!urlApp) return { error: 'Falta el secreto APP_URL: no se puede armar el enlace de activación' };

  const { data, error } = tipo === 'invite'
    ? await admin.auth.admin.generateLink({ type: 'invite', email: correo, options: { data: datos } })
    : await admin.auth.admin.generateLink({ type: 'recovery', email: correo });

  const token = data?.properties?.hashed_token;
  if (error || !token || !data?.user) return { error: error?.message ?? 'Auth no devolvió el token de activación' };

  return {
    enlace: `${urlApp}/activar?token_hash=${encodeURIComponent(token)}&type=${tipo}`,
    usuarioId: data.user.id,
  };
}

// Comentarios - Activación de cuenta por correo
// Envía el correo con el enlace por el SMTP del dominio, igual que enviar-correo-contacto. Lanza un error si el envío falla.
export async function enviarCorreoActivacion(correo: string, nombre: string, enlace: string) {
  await crearTransporte().sendMail({
    from: remitente(),
    to: correo,
    subject: 'Activa tu cuenta en RedSangre',
    text: [
      `Hola ${nombre}:`,
      '',
      'El administrador creó una cuenta para ti en RedSangre, el sistema del Banco de Sangre de Clínica Indisa.',
      'Para activarla y definir tu contraseña, abre este enlace:',
      '',
      enlace,
      '',
      'El enlace es de un solo uso y vence en un plazo limitado. Si ya no funciona, pide al administrador que te envíe uno nuevo.',
      'Si no esperabas este correo, ignóralo.',
      '',
      'Banco de Sangre – Clínica Indisa',
    ].join('\n'),
  });
}
