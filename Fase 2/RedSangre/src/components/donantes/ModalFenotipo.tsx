// Comentarios - Popup de tipificación de fenotipo
// Popup con la tabla de antígenos (modo compacto con C, E, K, c, e y modo extendido con los 30 antígenos).
// Lo usan el alta de donante y los filtros de búsqueda de Donantes y Nueva solicitud.
// Trabaja sobre una copia: Cancelar, Escape o clic fuera descartan los cambios; Guardar los entrega.
import { useState } from 'react';
import { Modal } from '../common/Modal';
import { FENOTIPOS_COMPACTOS, FENOTIPOS_EXTENDIDOS, type ValoresFenotipo } from '../../utils/fenotipo';
import styles from './ModalFenotipo.module.css';

interface ModalFenotipoProps {
  valoresIniciales: ValoresFenotipo;
  onGuardar: (valores: ValoresFenotipo) => void;
  onCancelar: () => void;
  // true en el alta de donante: no se puede guardar sin elegir al menos un antígeno.
  // false en las búsquedas: guardar sin antígenos quita el filtro.
  exigirSeleccion?: boolean;
  textoGuardar?: string;
}

// Agrupa la lista de antígenos de a dos, para mostrar dos antígenos por fila.
function enPares(lista: string[]): [string, string | undefined][] {
  const filas: [string, string | undefined][] = [];
  for (let i = 0; i < lista.length; i += 2) filas.push([lista[i], lista[i + 1]]);
  return filas;
}

export function ModalFenotipo({
  valoresIniciales,
  onGuardar,
  onCancelar,
  exigirSeleccion = false,
  textoGuardar = 'Guardar',
}: ModalFenotipoProps) {
  const [valores, setValores] = useState<ValoresFenotipo>(valoresIniciales);
  const [modoExtendido, setModoExtendido] = useState(false);
  const hayAlMenosUno = FENOTIPOS_EXTENDIDOS.some((antigeno) => valores[antigeno]);

  const cambiarValor = (antigeno: string, valor: string) => {
    setValores((previos) => ({ ...previos, [antigeno]: valor }));
  };

  // Comentarios - Popup de tipificación de fenotipo
  // Select de un antígeno: sin seleccionar, positivo o negativo.
  const selectAntigeno = (antigeno: string) => (
    <select
      className={styles.selectCompacto}
      value={valores[antigeno] || ''}
      onChange={(e) => cambiarValor(antigeno, e.target.value)}
      aria-label={`Resultado de ${antigeno}`}
    >
      <option value="">Sin seleccionar</option>
      <option value="POSITIVO">POSITIVO (+)</option>
      <option value="NEGATIVO">NEGATIVO (-)</option>
    </select>
  );

  return (
    <Modal className={styles.modalContenido} idTitulo="titulo-tipificacion" onCerrar={onCancelar}>
      <div className={styles.modalCabecera}>
        <h2 id="titulo-tipificacion">{modoExtendido ? 'Tipificación Extendida' : 'Tipificación'}</h2>
      </div>

      <table className={styles.tablaCompacta}>
        <thead>
          <tr>
            <th>Antígeno</th>
            <th>Resultado</th>
            <th>Antígeno</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {enPares(modoExtendido ? FENOTIPOS_EXTENDIDOS : FENOTIPOS_COMPACTOS).map(([primero, segundo]) => (
            <tr key={primero}>
              <td className={styles.nombreAntigeno}>{primero}</td>
              <td>{selectAntigeno(primero)}</td>
              {segundo ? (
                <>
                  <td className={styles.nombreAntigeno}>{segundo}</td>
                  <td>{selectAntigeno(segundo)}</td>
                </>
              ) : (
                <><td></td><td></td></>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.modalPie}>
        <button type="button" className={styles.botonCancelarModal} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={styles.botonModoModal} onClick={() => setModoExtendido(!modoExtendido)}>
          {modoExtendido ? '← Atrás' : 'Modo Extendido'}
        </button>
        <button
          type="button"
          className={styles.botonGuardarModal}
          disabled={exigirSeleccion && !hayAlMenosUno}
          onClick={() => onGuardar(valores)}
        >
          {textoGuardar}
        </button>
      </div>
    </Modal>
  );
}
