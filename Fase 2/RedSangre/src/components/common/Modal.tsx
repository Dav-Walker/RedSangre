// Comentarios - Componente Modal
// Ventana modal reutilizable: fondo oscuro, rol "dialog", cierre con Escape o clic fuera, y el foco del
// teclado se mantiene dentro mientras está abierta. Al cerrarse, el foco vuelve al elemento que la abrió.
// El aspecto de la caja lo define cada página con className.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface ModalProps {
  className: string;
  children: ReactNode;
  // Se llama con Escape o clic fuera. Si no se pasa, el modal solo se cierra con sus propios botones.
  onCerrar?: () => void;
  // false evita cerrar con clic fuera (por ejemplo, si hay datos escritos que se perderían).
  cerrarConClicFuera?: boolean;
  idTitulo?: string;
}

const SELECTOR_ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ className, children, onCerrar, cerrarConClicFuera = true, idTitulo }: ModalProps) {
  const cajaRef = useRef<HTMLDivElement>(null);
  // onCerrar cambia en cada render de la página; se guarda en una ref para no reiniciar el efecto del teclado.
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => { onCerrarRef.current = onCerrar; });

  // Comentarios - Componente Modal
  // Al abrir: enfoca el primer control. Escape cierra y Tab recorre solo los controles del modal.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const caja = cajaRef.current;
    caja?.querySelector<HTMLElement>(SELECTOR_ENFOCABLES)?.focus();

    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCerrarRef.current) {
        e.preventDefault();
        onCerrarRef.current();
        return;
      }
      if (e.key !== 'Tab' || !caja) return;
      const enfocables = [...caja.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES)];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPresionarTecla);
    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      anterior?.focus();
    };
  }, []);

  const alHacerClicFondo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && cerrarConClicFuera) onCerrar?.();
  };

  // Se dibuja directamente en el body: así la posición del modal no depende del contenedor donde se usa
  // (por ejemplo, dentro de un filtro o de una fila con estilos propios).
  return createPortal(
    <div className={styles.fondo} onClick={alHacerClicFondo}>
      <div ref={cajaRef} className={className} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
