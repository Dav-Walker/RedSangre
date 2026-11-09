// Comentarios - Envío de correo por SMTP del dominio
// Transporte de nodemailer y remitente comunes a las funciones que envían correos, con la cuenta @redsangre.cl del hosting.
// SMTP_HOST, SMTP_USER y SMTP_PASSWORD son secretos de Supabase. Se usa el puerto 465 (SSL) porque las Edge Functions bloquean el 25 y el 587.
import nodemailer from 'npm:nodemailer@6';

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
