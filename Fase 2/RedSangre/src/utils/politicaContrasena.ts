// Comentarios - Seguridad de contraseñas
// Política única de contraseña para el frontend: mínimo 8 caracteres con letra, número y un carácter especial (el punto cuenta).
// Las Edge Functions crear-usuario y cambiar-contrasena repiten la misma regla en el servidor.
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
