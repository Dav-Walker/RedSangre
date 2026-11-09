// Comentarios - Registro de donante
// Formulario de alta de donante con tipificación de fenotipo, etiquetas y consentimientos.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hoyISO } from '../../utils/fechas';
import type { GrupoSanguineo } from '../../tipos/dominio';
import { Modal } from '../../components/common/Modal';
import { ETIQUETA_FENOTIPO_RARO, ETIQUETA_PLAQUETAS, ETIQUETAS_DONANTE } from '../../utils/etiquetas';
import { registrarDonante } from '../../servicios/donantes';
import styles from './NuevoDonantePage.module.css';

const REGIONES_CHILE: Record<string, string[]> = {
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

const FENOTIPOS_COMPACTOS = ['C', 'E', 'K', 'c', 'e'];

const FENOTIPOS_EXTENDIDOS = [
  'C', 'Cw', 'Diego', 'E', 'Fya', 'Fyb', 'I', 'JKa', 'JKb',
  'JSa', 'JSb', 'K', 'Kpa', 'Kpb', 'Lea', 'Leb', 'Lua', 'Lub',
  'M', 'Mia', 'N', 'P1', 'S', 'V', 'Xga', 'c', 'e', 'f', 'k', 's'
];

export function NuevoDonantePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    telefono: '',
    rut: '',
    sexo: '',
    region: '',
    comuna: '',
    grupoSanguineo: '',
    fechaUltimaDonacion: '',
    observaciones: '',
  });

  const comunasDisponibles = form.region ? (REGIONES_CHILE[form.region] ?? []) : [];

  const [modalFenotipoAbierto, setModalFenotipoAbierto] = useState(false);
  const [modoExtendido, setModoExtendido] = useState(false);
  const [valoresFenotipos, setValoresFenotipos] = useState<Record<string, string>>({});
  const [valoresFenotiposBackup, setValoresFenotiposBackup] = useState<Record<string, string>>({});
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [reaccionAdversaPrevia, setReaccionAdversaPrevia] = useState(false);
  const [consentCookies, setConsentCookies] = useState(false);
  const [consentContacto, setConsentContacto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'region' ? { comuna: '' } : {}),
    }));
  };

  const toggleEtiqueta = (etiqueta: string) => {
    setEtiquetasSeleccionadas(prev =>
      prev.includes(etiqueta) ? prev.filter(e => e !== etiqueta) : [...prev, etiqueta]
    );
  };

  // Comentarios - Modal de tipificación
  // Cancelar (botón, Escape o clic fuera) restaura los valores que había al abrir el modal.
  const cancelarTipificacion = () => {
    setValoresFenotipos(valoresFenotiposBackup);
    setModoExtendido(false);
    setModalFenotipoAbierto(false);
  };

  const handleCambioFenotipo = (fenotipo: string, valor: string) => {
    setValoresFenotipos(prev => ({ ...prev, [fenotipo]: valor }));
  };

  const hayAlMenosUnoSeleccionado = FENOTIPOS_EXTENDIDOS.some(
    f => valoresFenotipos[f] && valoresFenotipos[f] !== ''
  );

  const fenotipoTexto = FENOTIPOS_EXTENDIDOS
    .filter(f => valoresFenotipos[f] && valoresFenotipos[f] !== '')
    .map(f => `${f}${valoresFenotipos[f] === 'POSITIVO' ? '+' : '-'}`)
    .join('/');

  const buildFilas = (lista: string[]): (string | undefined)[][] => {
    const filas: (string | undefined)[][] = [];
    for (let i = 0; i < lista.length; i += 2) {
      filas.push([lista[i], lista[i + 1]]);
    }
    return filas;
  };

  const handleGuardar = async () => {
    // Comentarios - Registro atómico de donante
    // fn_registrar_donante exige ambos consentimientos; se avisa antes de llamar a la base.
    if (!consentCookies || !consentContacto) {
      setError('Debe aceptar el tratamiento de datos y la autorización de contacto para registrar al donante.');
      return;
    }

    const camposFaltantes = [];
    if (!form.nombre.trim()) camposFaltantes.push('Nombre');
    if (!form.apellido.trim()) camposFaltantes.push('Apellido');
    if (!form.telefono.trim()) camposFaltantes.push('Teléfono');
    if (!form.rut.trim()) camposFaltantes.push('RUT');
    if (!form.sexo) camposFaltantes.push('Sexo');
    if (!form.region) camposFaltantes.push('Región');
    if (!form.comuna) camposFaltantes.push('Comuna');
    if (!form.grupoSanguineo) camposFaltantes.push('Grupo Sanguíneo');
    if (!form.fechaUltimaDonacion) camposFaltantes.push('Fecha de última donación');
    if (camposFaltantes.length > 0) {
      setError(`Campos obligatorios incompletos: ${camposFaltantes.join(', ')}.`);
      return;
    }
    if (!hayAlMenosUnoSeleccionado) {
      setError('Debe seleccionar al menos un fenotipo antes de guardar al donante.');
      return;
    }

    setGuardando(true);
    setError(null);

    // Comentarios - Registro atómico de donante
    // Guarda donante, consentimiento y etiquetas en una sola transacción con fn_registrar_donante:
    // si algo falla, no queda un donante sin consentimiento. La ubicación va como "Comuna, Región";
    // la base deriva de ahí la comuna y las coordenadas para medir la cercanía.
    // Los campos opcionales vacíos van como undefined: se omiten y la función usa su valor por defecto (NULL).
    const errorRegistro = await registrarDonante({
      p_nombre: form.nombre.trim(),
      p_apellido: form.apellido.trim(),
      p_rut: form.rut.trim(),
      p_grupo_sanguineo: form.grupoSanguineo as GrupoSanguineo,
      p_telefono: form.telefono.trim(),
      p_fecha_ultima_donacion: form.fechaUltimaDonacion,
      p_acepta_cookies: consentCookies,
      p_autoriza_contacto: consentContacto,
      p_correo: form.correo.trim() || undefined,
      p_fenotipo: fenotipoTexto || undefined,
      p_ubicacion: `${form.comuna}, ${form.region}`,
      p_observaciones: form.observaciones.trim() || undefined,
      p_fenotipo_raro: etiquetasSeleccionadas.includes(ETIQUETA_FENOTIPO_RARO),
      p_frecuente_plaquetas: etiquetasSeleccionadas.includes(ETIQUETA_PLAQUETAS),
      p_reaccion_adversa: reaccionAdversaPrevia,
      p_etiquetas: etiquetasSeleccionadas,
      p_sexo: form.sexo,
    });

    setGuardando(false);
    if (errorRegistro) {
      setError(errorRegistro);
      return;
    }
    navigate('/donantes');
  };

  return (
    <div className={styles.contenedor}>

      <div className={styles.headerSuperior}>
        <button className={styles.botonVolver} onClick={() => navigate('/donantes')}>
          ← Volver a donantes
        </button>
      </div>

      <h1 className={styles.tituloPrincipal}>Nuevo donante</h1>

      {error && (
        <div className={styles.mensajeError}>
          {error}
        </div>
      )}

      <div className={styles.layoutPrincipal}>

        <div className={styles.panelIzquierdo}>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Nombre <span className={styles.requerido}>*</span></label>
            <input
              type="text"
              name="nombre"
              className={styles.input}
              placeholder="Ej: María"
              value={form.nombre}
              onChange={handleChange}
            />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Apellido <span className={styles.requerido}>*</span></label>
            <input
              type="text"
              name="apellido"
              className={styles.input}
              placeholder="Ej: Fernández Soto"
              value={form.apellido}
              onChange={handleChange}
            />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Correo electrónico</label>
            <input
              type="email"
              name="correo"
              className={styles.input}
              placeholder="ejemplo@correo.com"
              value={form.correo}
              onChange={handleChange}
            />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Número telefónico <span className={styles.requerido}>*</span></label>
            <input
              type="tel"
              name="telefono"
              className={styles.input}
              placeholder="+56 9 1234 5678"
              value={form.telefono}
              onChange={handleChange}
            />
          </div>

          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput}>
              <label className={styles.label}>RUT <span className={styles.requerido}>*</span></label>
              <input
                type="text"
                name="rut"
                className={styles.input}
                placeholder="12345678-9"
                value={form.rut}
                onChange={handleChange}
              />
            </div>

            <div className={styles.grupoInput}>
              <label className={styles.label}>Sexo <span className={styles.requerido}>*</span></label>
              <div className={styles.selectContenedor}>
                <select
                  name="sexo"
                  className={styles.select}
                  value={form.sexo}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="No especifica">No especifica</option>
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput}>
              <label className={styles.label}>Región <span className={styles.requerido}>*</span></label>
              <div className={styles.selectContenedor}>
                <select
                  name="region"
                  className={styles.select}
                  value={form.region}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar región...</option>
                  {Object.keys(REGIONES_CHILE).map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>

            <div className={styles.grupoInput}>
              <label className={styles.label}>Comuna <span className={styles.requerido}>*</span></label>
              <div className={styles.selectContenedor}>
                <select
                  name="comuna"
                  className={styles.select}
                  value={form.comuna}
                  onChange={handleChange}
                  disabled={!form.region}
                >
                  <option value="">Seleccionar comuna...</option>
                  {comunasDisponibles.map((comuna) => (
                    <option key={comuna} value={comuna}>{comuna}</option>
                  ))}
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

          <div className={`${styles.filaFormulario} ${styles.filaConMargen}`}>
            <div className={styles.grupoInput}>
              <label className={styles.label}>Grupo sanguíneo <span className={styles.requerido}>*</span></label>
              <div className={styles.selectContenedor}>
                <select
                  name="grupoSanguineo"
                  className={styles.select}
                  value={form.grupoSanguineo}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar...</option>
                  <option value="O-">O (-)</option>
                  <option value="O+">O (+)</option>
                  <option value="A-">A (-)</option>
                  <option value="A+">A (+)</option>
                  <option value="B-">B (-)</option>
                  <option value="B+">B (+)</option>
                  <option value="AB-">AB (-)</option>
                  <option value="AB+">AB (+)</option>
                </select>
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>

            <div className={styles.grupoInput}>
              <label className={styles.label}>Fenotipo <span className={styles.requerido}>*</span></label>
              <div
                className={styles.selectContenedor}
                onClick={() => { setValoresFenotiposBackup({ ...valoresFenotipos }); setModoExtendido(false); setModalFenotipoAbierto(true); }}
              >
                <input
                  type="text"
                  className={`${styles.select} ${styles.inputFenotipo}`}
                  readOnly
                  value={hayAlMenosUnoSeleccionado ? fenotipoTexto : 'Seleccionar...'}
                />
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

          {/* Comentarios - Registro atómico de donante */}
          {/* Fecha de la última donación: la exige fn_registrar_donante y define cuándo puede volver a donar. */}
          <div className={styles.grupoInput}>
            <label className={styles.label} htmlFor="fecha-ultima-donacion">
              Fecha de última donación <span className={styles.requerido}>*</span>
            </label>
            <input
              id="fecha-ultima-donacion"
              type="date"
              name="fechaUltimaDonacion"
              className={styles.input}
              value={form.fechaUltimaDonacion}
              max={hoyISO()}
              onChange={handleChange}
            />
          </div>

        </div>

        <div className={styles.panelDerecho}>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Etiquetas del donante</label>
            <div className={styles.listaEtiquetas}>
              {ETIQUETAS_DONANTE.map(etiqueta => (
                <label key={etiqueta} className={styles.opcionMarcable}>
                  <input
                    type="checkbox"
                    checked={etiquetasSeleccionadas.includes(etiqueta)}
                    onChange={() => toggleEtiqueta(etiqueta)}
                    className={styles.casillaPequena}
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Observaciones / Comentarios</label>
            <textarea
              name="observaciones"
              placeholder="Ej: Donó sin problemas, se desmayó brevemente, requirió hidratación..."
              rows={4}
              value={form.observaciones}
              onChange={handleChange}
              className={`${styles.input} ${styles.textareaObservaciones}`}
            />
            <label className={`${styles.opcionMarcable} ${styles.opcionReaccion} ${reaccionAdversaPrevia ? styles.opcionReaccionActiva : ''}`}>
              <input
                type="checkbox"
                checked={reaccionAdversaPrevia}
                onChange={e => setReaccionAdversaPrevia(e.target.checked)}
                className={styles.casillaPequena}
              />
              El donante tiene reacción adversa (esto bloqueará al donante para futuras donaciones)
            </label>
          </div>

          <h3 className={styles.tituloConsentimiento}>Consentimiento del donante</h3>

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              className={styles.checkbox}
              id="ck1"
              checked={consentCookies}
              onChange={e => setConsentCookies(e.target.checked)}
            />
            <label htmlFor="ck1" className={styles.checkboxLabel}>
              Acepta el uso de cookies y el tratamiento de datos según la política del sistema <span className={styles.requerido}>*</span>
            </label>
          </div>

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              className={styles.checkbox}
              id="ck2"
              checked={consentContacto}
              onChange={e => setConsentContacto(e.target.checked)}
            />
            <label htmlFor="ck2" className={styles.checkboxLabel}>
              Autoriza ser contactado (teléfono, correo o WhatsApp) ante una necesidad de transfusión compatible <span className={styles.requerido}>*</span>
            </label>
          </div>

          <button
            className={styles.botonGuardar}
            disabled={guardando}
            onClick={handleGuardar}
          >
            {guardando ? 'Guardando...' : 'Finalizar y guardar donante'}
          </button>
        </div>
      </div>

      {modalFenotipoAbierto && (
        <Modal className={styles.modalContenido} idTitulo="titulo-tipificacion" onCerrar={cancelarTipificacion}>

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
                {buildFilas(modoExtendido ? FENOTIPOS_EXTENDIDOS : FENOTIPOS_COMPACTOS).map((par, index) => (
                  <tr key={index}>
                    <td className={styles.nombreAntigeno}>{par[0]}</td>
                    <td>
                      <select
                        className={styles.selectCompacto}
                        value={valoresFenotipos[par[0]!] || ''}
                        onChange={(e) => handleCambioFenotipo(par[0]!, e.target.value)}
                      >
                        <option value="">Sin seleccionar</option>
                        <option value="POSITIVO">POSITIVO (+)</option>
                        <option value="NEGATIVO">NEGATIVO (-)</option>
                      </select>
                    </td>

                    {par[1] ? (
                      <>
                        <td className={styles.nombreAntigeno}>{par[1]}</td>
                        <td>
                          <select
                            className={styles.selectCompacto}
                            value={valoresFenotipos[par[1]] || ''}
                            onChange={(e) => handleCambioFenotipo(par[1]!, e.target.value)}
                          >
                            <option value="">Sin seleccionar</option>
                            <option value="POSITIVO">POSITIVO (+)</option>
                            <option value="NEGATIVO">NEGATIVO (-)</option>
                          </select>
                        </td>
                      </>
                    ) : (
                      <><td></td><td></td></>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.modalPie}>
              <button
                className={styles.botonCancelarModal}
                onClick={cancelarTipificacion}
              >
                Cancelar
              </button>

              {modoExtendido ? (
                <button
                  className={styles.botonModoModal}
                  onClick={() => setModoExtendido(false)}
                >
                  ← Atrás
                </button>
              ) : (
                <button
                  className={styles.botonModoModal}
                  onClick={() => setModoExtendido(true)}
                >
                  Modo Extendido
                </button>
              )}

              <button
                className={styles.botonGuardarModal}
                disabled={!hayAlMenosUnoSeleccionado}
                onClick={() => { setModoExtendido(false); setModalFenotipoAbierto(false); }}
              >
                Guardar
              </button>
            </div>

        </Modal>
      )}

    </div>
  );
}