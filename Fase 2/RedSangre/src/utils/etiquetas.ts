// Comentarios - Etiquetas de donante
// "Fenotipo sanguíneo raro" y "Donante de plaquetas" se guardan además como columnas booleanas de donante
// (fenotipo_raro y frecuente_plaquetas), que usan los filtros y el dashboard. El resto son etiquetas genéricas
// que solo viven en la tabla etiqueta_donante.
export const ETIQUETA_FENOTIPO_RARO = 'Fenotipo sanguíneo raro';
export const ETIQUETA_PLAQUETAS = 'Donante de plaquetas';

export const ETIQUETAS_GENERICAS = [
  'Donación altruista',
  'Grupo sanguíneo de interés',
  'Donante derivado o referido',
  'Donante corporativo',
  'Donante de plasma',
];

// Todas las etiquetas, en el orden en que se muestran en formularios y filtros.
export const ETIQUETAS_DONANTE = [
  ETIQUETA_FENOTIPO_RARO,
  'Donación altruista',
  'Grupo sanguíneo de interés',
  'Donante derivado o referido',
  'Donante corporativo',
  ETIQUETA_PLAQUETAS,
  'Donante de plasma',
];

// Indica si la etiqueta es una de las que también son columna booleana de donante.
export function esEtiquetaDeColumna(etiqueta: string): boolean {
  return etiqueta === ETIQUETA_FENOTIPO_RARO || etiqueta === ETIQUETA_PLAQUETAS;
}
