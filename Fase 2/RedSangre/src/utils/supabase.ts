import { createClient } from '@supabase/supabase-js';
import type { Database } from '../tipos/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Comentarios - Cliente único de Supabase
// isSupabaseConfigured indica si el .env tiene la URL y la clave publicable; el login lo usa para avisar.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Comentarios - Cliente único de Supabase
// Cliente tipado con el esquema de la base (src/tipos/database.types.ts, se regenera con "npm run tipos").
// Nunca es null: sin .env se crea con valores de relleno que no conectan a nada, y el login queda deshabilitado
// con el aviso de configuración. Así las páginas no necesitan comprobar si el cliente existe.
export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'sin-configurar',
);
