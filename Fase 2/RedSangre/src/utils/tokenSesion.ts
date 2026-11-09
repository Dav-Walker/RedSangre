// Comentarios - Segundo factor TOTP (RF-36)
// Lee los claims del access token de Supabase sin validar la firma. Solo sirve para decisiones de la interfaz;
// la validación real la hacen Supabase Auth, las políticas RLS y las Edge Functions.
export interface ClaimsToken {
  aal?: string;
  amr?: { method?: string; timestamp?: number }[];
}

export function leerClaimsToken(accessToken: string): ClaimsToken | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as ClaimsToken;
  } catch {
    return null;
  }
}
