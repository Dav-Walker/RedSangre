// Comentarios - Componente Button
// Botón principal de las páginas (rojo de la marca). Por defecto es type="button" para que, si queda dentro
// de un formulario, no lo envíe sin querer.
import styles from './Button.module.css';

interface ButtonProps {
  texto: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function Button({ texto, onClick, disabled, type = 'button' }: ButtonProps) {
  return (
    <button type={type} className={styles.boton} onClick={onClick} disabled={disabled}>
      {texto}
    </button>
  );
}
