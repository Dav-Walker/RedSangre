// Comentarios - Componente Badge
// Etiqueta de color para estados y categorías (estado de solicitud, fenotipo raro, consentimiento, etc.).
// Los colores están en Badge.module.css; se exporta el tipo para que las páginas no usen "as any".
import styles from './Badge.module.css';

export type ColorBadge = 'morado' | 'azul' | 'gris' | 'verde' | 'naranja' | 'rojo';

interface BadgeProps {
  texto: string;
  color: ColorBadge;
}

export function Badge({ texto, color }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[color]}`}>{texto}</span>;
}
