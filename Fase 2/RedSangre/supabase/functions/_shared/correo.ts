// Comentarios - Envío de correo por Gmail SMTP
// Transporte de nodemailer y remitente comunes a las funciones que envían correos.
// GMAIL_USER y GMAIL_APP_PASSWORD son secretos de Supabase.
import nodemailer from 'npm:nodemailer@6';

export function crearTransporte() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: Deno.env.get('GMAIL_USER'), pass: Deno.env.get('GMAIL_APP_PASSWORD') },
  });
}

export function remitente(): string {
  return `"RedSangre – Banco de Sangre" <${Deno.env.get('GMAIL_USER')}>`;
}
