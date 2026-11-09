// Comentarios - Clientes de Supabase en las Edge Functions
// clienteUsuario actúa con el token de quien llama, así que respeta las políticas RLS.
// clienteAdmin usa la service role y salta RLS: solo se usa después de verificar al administrador.
import { createClient } from 'npm:@supabase/supabase-js@2';

export function clienteUsuario(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

export function clienteAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// Tipo del cliente inferido de createClient (sin esquema tipado, igual que antes de compartirlo).
export type ClienteSupabase = ReturnType<typeof clienteAdmin>;
