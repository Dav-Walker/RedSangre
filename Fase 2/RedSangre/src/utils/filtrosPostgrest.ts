// Comentarios - Búsqueda segura en filtros .or()
// Encierra un valor entre comillas dobles para usarlo dentro de .or() de supabase-js.
// Sin comillas, una coma o un paréntesis escrito por el usuario rompe el filtro de PostgREST.
export function valorFiltro(valor: string): string {
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
