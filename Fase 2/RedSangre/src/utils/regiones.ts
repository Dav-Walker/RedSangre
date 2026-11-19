// Comentarios - Ubicación del donante
// Regiones de Chile con sus comunas, para elegir la ubicación desde una lista en el alta y en la edición del donante.
export const REGIONES_CHILE: Record<string, string[]> = {
  "Arica y Parinacota": ["Arica", "Camarones", "Putre", "General Lagos"],
  "Tarapacá": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Pica"],
  "Antofagasta": ["Antofagasta", "Calama", "Tocopilla", "Mejillones"],
  "Atacama": ["Copiapó", "Vallenar", "Caldera", "Chañaral"],
  "Coquimbo": ["La Serena", "Coquimbo", "Ovalle", "Illapel"],
  "Valparaíso": ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio"],
  "Metropolitana": ["Santiago", "Providencia", "Las Condes", "Peñalolén", "Maipú", "Puente Alto", "La Florida", "Melipilla"],
  "O'Higgins": ["Rancagua", "Machalí", "San Fernando", "Rengo"],
  "Maule": ["Talca", "Curicó", "Linares", "Constitución"],
  "Ñuble": ["Chillán", "San Carlos", "Bulnes", "Coihueco"],
  "Biobío": ["Concepción", "Talcahuano", "Los Ángeles", "San Pedro de la Paz"],
  "Araucanía": ["Temuco", "Padre Las Casas", "Villarrica", "Angol"],
  "Los Ríos": ["Valdivia", "La Unión", "Panguipulli", "Río Bueno"],
  "Los Lagos": ["Puerto Montt", "Osorno", "Castro", "Ancud"],
  "Aysén": ["Coyhaique", "Puerto Aysén", "Chile Chico", "Cochrane"],
  "Magallanes": ["Punta Arenas", "Puerto Natales", "Porvenir", "Cabo de Hornos"]
};

// Comentarios - Ubicación del donante
// Separa la ubicación guardada ("Comuna, Región") en región y comuna de la lista. Si la región guardada no
// está en la lista (datos antiguos como "Peñalolén, Santiago"), la busca por la comuna. Lo que no se
// reconoce queda vacío para que el usuario lo elija.
export function separarUbicacion(ubicacion: string | null): { region: string; comuna: string } {
  const [comunaTexto = '', regionTexto = ''] = (ubicacion ?? '').split(',').map((p) => p.trim());
  const region = REGIONES_CHILE[regionTexto]?.includes(comunaTexto)
    ? regionTexto
    : Object.keys(REGIONES_CHILE).find((r) => REGIONES_CHILE[r].includes(comunaTexto)) ?? '';
  return { region, comuna: region ? comunaTexto : '' };
}
