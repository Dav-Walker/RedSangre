// Comentarios - Segundo factor TOTP (RF-36)
// Indica si el token de la petición tiene nivel aal2, es decir, si el usuario completó el código TOTP.
// Debe llamarse después de auth.getUser(), que ya comprobó con Supabase Auth que el token es auténtico.
export const MENSAJE_SIN_DOS_PASOS = 'Debes completar la verificación en dos pasos para realizar esta acción';

export function tieneDosPasos(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).aal === 'aal2';
  } catch {
    return false;
  }
}
