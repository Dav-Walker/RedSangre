// Comentarios - Límite de sesión de 1 hora
// Duración máxima de una sesión desde el inicio de sesión; debe coincidir con el hook fn_hook_limite_sesion de la base
export const DURACION_SESION_MS = 60 * 60 * 1000;

// Comentarios - Límite de sesión de 1 hora
// Lee del access token la hora en que el usuario se autenticó (claim amr). Esa hora no cambia al renovar el token.
// Solo se usa para programar el cierre en la interfaz; la validación real la hace el servidor.
export function obtenerInicioSesion(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload)) as { amr?: { timestamp?: number }[] };
    const marcas = (claims.amr ?? [])
      .map((metodo) => metodo.timestamp)
      .filter((marca): marca is number => typeof marca === 'number');

    return marcas.length > 0 ? Math.min(...marcas) * 1000 : null;
  } catch {
    return null;
  }
}
