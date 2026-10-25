export const ESTADOS_SOLICITUD = {
  abierta: { texto: 'Abierta', color: 'azul' },
  en_proceso: { texto: 'En proceso', color: 'naranja' },
  cerrada: { texto: 'Cerrada', color: 'gris' },
} as const;

export type EstadoSolicitud = keyof typeof ESTADOS_SOLICITUD;

export function obtenerEstadoSolicitud(valor?: string | null): EstadoSolicitud {
  return valor && valor in ESTADOS_SOLICITUD ? (valor as EstadoSolicitud) : 'abierta';
}
