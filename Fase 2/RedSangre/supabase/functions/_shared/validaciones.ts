// Comentarios - Validaciones compartidas
// Única copia de las reglas de correo (RF-07) y de contraseña. La usan las Edge Functions y también el
// frontend, que las importa desde src/utils. No usa nada propio de Deno, así que funciona en ambos lados.

// Comentarios - Validar correo duplicado y correo real (RF-07)
// Solo se aceptan correos de estos dominios; con eso quedan bloqueados los dominios inventados y los desechables.
export const DOMINIOS_PERMITIDOS = ['gmail.com', 'duocuc.cl', 'indisa.cl'];
export const MENSAJE_DOMINIO = 'Solo se permiten correos @gmail.com, @duocuc.cl o @indisa.cl.';
const MENSAJE_FORMATO = 'El correo no tiene un formato válido.';
const FORMATO_LOCAL = /^[a-z0-9]+(?:[._+-][a-z0-9]+)*$/;

// Devuelve el mensaje de error si el correo no es válido o su dominio no está permitido, o null si está bien.
export function validarCorreo(correo: string): string | null {
  const c = correo.trim().toLowerCase();
  if (!c) return 'Ingresa el correo.';
  if (c.length > 254) return MENSAJE_FORMATO;

  const partes = c.split('@');
  if (partes.length !== 2) return MENSAJE_FORMATO;

  const [local, dominio] = partes;
  if (local.length > 64 || !FORMATO_LOCAL.test(local)) return MENSAJE_FORMATO;
  if (!DOMINIOS_PERMITIDOS.includes(dominio)) return MENSAJE_DOMINIO;
  return null;
}

// Forma única de un correo para detectar duplicados. Gmail ignora los puntos y lo que va después de "+",
// así que j.perez+x@gmail.com y jperez@gmail.com son el mismo buzón.
export function correoCanonico(correo: string): string {
  const [local, dominio] = correo.trim().toLowerCase().split('@');
  if (dominio !== 'gmail.com') return `${local}@${dominio}`;
  return `${local.split('+')[0].replace(/\./g, '')}@${dominio}`;
}

// Comentarios - Seguridad de contraseñas
// Política única: mínimo 8 caracteres con letra, número y un carácter especial (el punto cuenta).
export const MENSAJE_POLITICA_CONTRASENA =
  'La contraseña debe tener al menos 8 caracteres, una letra, un número y un carácter especial (por ejemplo, un punto).';

// Devuelve el mensaje de error si la contraseña no cumple la política, o null si es válida.
export function validarContrasena(contrasena: string): string | null {
  const cumple =
    contrasena.length >= 8 &&
    /[a-zA-Z]/.test(contrasena) &&
    /\d/.test(contrasena) &&
    /[^a-zA-Z0-9]/.test(contrasena);
  return cumple ? null : MENSAJE_POLITICA_CONTRASENA;
}
