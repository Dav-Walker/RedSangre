// Comentarios - Estados de solicitud
// Texto y color de cada valor de estado_solicitud_enum para mostrarlos con Badge.
export const ESTADOS_SOLICITUD = {
  abierta: { texto: 'Abierta', color: 'azul' },
  en_proceso: { texto: 'En proceso', color: 'naranja' },
  cerrada: { texto: 'Cerrada', color: 'gris' },
} as const;

export type EstadoSolicitud = keyof typeof ESTADOS_SOLICITUD;

// Comentarios - Estados de solicitud
// Convierte el valor de la base en un estado conocido. Si llega vacío o desconocido se muestra como "abierta",
// que es el estado con el que se crea toda solicitud.
export function obtenerEstadoSolicitud(valor?: string | null): EstadoSolicitud {
  return valor && valor in ESTADOS_SOLICITUD ? (valor as EstadoSolicitud) : 'abierta';
}
