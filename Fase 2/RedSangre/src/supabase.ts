import { createClient } from '@supabase/supabase-js';

// Traemos las llaves desde el archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Exportamos la conexión para usarla en todo el proyecto
export const supabase = createClient(supabaseUrl, supabaseKey);