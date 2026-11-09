// Comentarios - Respuestas de las Edge Functions
// Arma una respuesta JSON con las cabeceras CORS de la petición en curso. La usan todas las funciones.
import { cabeceras } from './cors.ts';

export function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cabeceras(), 'Content-Type': 'application/json' },
  });
}

// Comentarios - Respuestas de las Edge Functions
// Responde la consulta previa (OPTIONS) del navegador y rechaza los métodos que no sean POST.
// Devuelve null cuando la petición es un POST y la función debe continuar.
export function revisarMetodo(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras() });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);
  return null;
}
