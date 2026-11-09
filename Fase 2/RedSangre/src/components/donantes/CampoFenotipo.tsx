// Comentarios - Búsqueda por fenotipo
// Campo de filtro que no se escribe a mano: al hacer clic abre el popup de tipificación y después muestra
// lo elegido ("C+, K-"). La ✕ quita el filtro. Lo usan Donantes y Nueva solicitud.
import { useState } from 'react';
import { ModalFenotipo } from './ModalFenotipo';
import { textoFenotipo, type ValoresFenotipo } from '../../utils/fenotipo';
import styles from './CampoFenotipo.module.css';

interface CampoFenotipoProps {
  valores: ValoresFenotipo;
  onCambiar: (valores: ValoresFenotipo) => void;
}

export function CampoFenotipo({ valores, onCambiar }: CampoFenotipoProps) {
  const [abierto, setAbierto] = useState(false);
  const texto = textoFenotipo(valores);

  return (
    <div className={styles.contenedor}>
      <button
        type="button"
        className={`${styles.campo} ${texto ? '' : styles.campoVacio}`}
        onClick={() => setAbierto(true)}
        title={texto || undefined}
      >
        {texto || 'Buscar por fenotipo...'}
      </button>
      {texto && (
        <button type="button" className={styles.quitar} onClick={() => onCambiar({})} aria-label="Quitar filtro de fenotipo">
          ✕
        </button>
      )}

      {abierto && (
        <ModalFenotipo
          valoresIniciales={valores}
          textoGuardar="Buscar"
          onCancelar={() => setAbierto(false)}
          onGuardar={(nuevos) => { onCambiar(nuevos); setAbierto(false); }}
        />
      )}
    </div>
  );
}
