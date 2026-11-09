// Comentarios - Tipificación de fenotipo
// Antígenos del popup de tipificación y conversión de lo elegido al texto que se guarda y se busca.
// El texto separa cada antígeno con coma ("C+, E-, K+"): la base compara fenotipos por componentes
// separados por coma (fn_fenotipo_tokens), así que cada antígeno queda como un componente propio.

// Resultado elegido para cada antígeno: POSITIVO, NEGATIVO o vacío (sin seleccionar).
export type ValoresFenotipo = Record<string, string>;

export const FENOTIPOS_COMPACTOS = ['C', 'E', 'K', 'c', 'e'];

export const FENOTIPOS_EXTENDIDOS = [
  'C', 'Cw', 'Diego', 'E', 'Fya', 'Fyb', 'I', 'JKa', 'JKb',
  'JSa', 'JSb', 'K', 'Kpa', 'Kpb', 'Lea', 'Leb', 'Lua', 'Lub',
  'M', 'Mia', 'N', 'P1', 'S', 'V', 'Xga', 'c', 'e', 'f', 'k', 's',
];

// Comentarios - Tipificación de fenotipo
// Antígenos elegidos como lista, en el orden del modo extendido: ['C+', 'E-', 'K+'].
export function antigenosElegidos(valores: ValoresFenotipo): string[] {
  return FENOTIPOS_EXTENDIDOS
    .filter((antigeno) => valores[antigeno])
    .map((antigeno) => `${antigeno}${valores[antigeno] === 'POSITIVO' ? '+' : '-'}`);
}

// Comentarios - Tipificación de fenotipo
// Texto que se guarda en la base y se muestra en pantalla: "C+, E-, K+". Vacío si no se eligió nada.
export function textoFenotipo(valores: ValoresFenotipo): string {
  return antigenosElegidos(valores).join(', ');
}
