// Comentarios - CORS compartido por las Edge Functions
// Se aceptan dos orígenes: el de producción (secreto APP_URL) y el de desarrollo local.
// Cada petición recibe el origen que corresponde; cualquier otro origen recibe el de producción y el navegador lo rechaza.
import { AsyncLocalStorage } from 'node:async_hooks';

// Comentarios - APP_URL obligatorio
// Si falta APP_URL solo se acepta el origen local, y se deja aviso en los logs de la función.
const ORIGEN_LOCAL = 'http://localhost:5173';
const APP_URL = Deno.env.get('APP_URL')?.replace(/\/+$/, '');
if (!APP_URL) console.error('Falta el secreto APP_URL: CORS solo aceptará el origen local');
const ORIGEN_PRODUCCION = APP_URL ?? ORIGEN_LOCAL;
const ORIGENES_PERMITIDOS = [ORIGEN_PRODUCCION, ORIGEN_LOCAL];

const origenDeLaPeticion = new AsyncLocalStorage<string>();

// Envuelve el manejador de Deno.serve para que cabeceras() sepa a qué petición responde.
export function conCors(manejador: (req: Request) => Response | Promise<Response>) {
  return (req: Request) => {
    const origen = req.headers.get('origin') ?? '';
    const permitido = ORIGENES_PERMITIDOS.includes(origen) ? origen : ORIGEN_PRODUCCION;
    return origenDeLaPeticion.run(permitido, () => manejador(req));
  };
}

export function cabeceras() {
  return {
    'Access-Control-Allow-Origin': origenDeLaPeticion.getStore() ?? ORIGEN_PRODUCCION,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
