// Comentarios - Envío de correo por SMTP del dominio
// Transporte de nodemailer y remitente comunes a las funciones que envían correos, con la cuenta @redsangre.cl del hosting.
// SMTP_HOST, SMTP_USER y SMTP_PASSWORD son secretos de Supabase. Se usa el puerto 465 (SSL) porque las Edge Functions bloquean el 25 y el 587.
// Comentarios - Versiones fijas en las Edge Functions
// Versión exacta: cada deploy usa el mismo código. Las versiones anteriores a la 10.1.4 tienen avisos de seguridad
// en el parser de direcciones (correos que terminan en un dominio distinto al indicado).
import nodemailer from 'npm:nodemailer@10.3.1';

export function crearTransporte() {
  return nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: 465,
    secure: true,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
  });
}

export function remitente(): string {
  return `"RedSangre – Banco de Sangre" <${Deno.env.get('SMTP_USER')}>`;
}
