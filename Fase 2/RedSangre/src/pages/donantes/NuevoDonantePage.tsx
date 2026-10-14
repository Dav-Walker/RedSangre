import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/useAuth';
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

const ETIQUETAS_DISPONIBLES = [
  'Fenotipo sanguíneo raro',
  'Donación altruista',
  'Grupo sanguíneo de interés',
  'Donante derivado o referido',
  'Donante corporativo',
  'Donante de plaquetas',
  'Donante de plasma',
];

const FENOTIPOS_EXTENDIDOS = [
  'D', 'C', 'Cw', 'Diego', 'E', 'Fya', 'Fyb', 'I', 'JKa', 'JKb',
  'JSa', 'JSb', 'K', 'Kpa', 'Kpb', 'Lea', 'Leb', 'Lua', 'Lub'
];

export function NuevoDonantePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    rut: '',
    sexo: '',
    region: '',
    comuna: '',
    grupoSanguineo: '',
    observaciones: '',
  });

  const comunasDisponibles = form.region ? (REGIONES_CHILE[form.region] ?? []) : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [valoresFenotipos, setValoresFenotipos] = useState<Record<string, string>>({});
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [consentCookies, setConsentCookies] = useState(false);
  const [consentContacto, setConsentContacto] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleCambioFenotipo = (fenotipo: string, valor: string) => {
    setValoresFenotipos(prev => ({ ...prev, [fenotipo]: valor }));
  };

  const estanTodosCompletos = FENOTIPOS_EXTENDIDOS.every(
    f => valoresFenotipos[f] && valoresFenotipos[f] !== ''
  );

  const fenotipoTexto = estanTodosCompletos
    ? FENOTIPOS_EXTENDIDOS.map(f =>
        `${f}${valoresFenotipos[f] === 'POSITIVO' ? '+' : '-'}`
      ).join('/')
    : '';

  const filasAgrupadas: (string | undefined)[][] = [];
  for (let i = 0; i < FENOTIPOS_EXTENDIDOS.length; i += 2) {
    filasAgrupadas.push([FENOTIPOS_EXTENDIDOS[i], FENOTIPOS_EXTENDIDOS[i + 1]]);
  }

  const handleGuardar = async () => {
    if (!supabase) {
      setError('La conexión a la base de datos no está configurada.');
      return;
    }
    const camposFaltantes = [];
    if (!form.nombre.trim()) camposFaltantes.push('Nombre');
    if (!form.apellido.trim()) camposFaltantes.push('Apellido');
    if (!form.rut.trim()) camposFaltantes.push('RUT');
    if (!form.sexo) camposFaltantes.push('Sexo');
    if (!form.region) camposFaltantes.push('Región');
    if (!form.comuna) camposFaltantes.push('Comuna');
    if (!form.grupoSanguineo) camposFaltantes.push('Grupo Sanguíneo');
    if (camposFaltantes.length > 0) {
      setError(`Campos obligatorios incompletos: ${camposFaltantes.join(', ')}.`);
      return;
    }
    if (!estanTodosCompletos) {
      setError('Debe definir todos los fenotipos antes de guardar al donante.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: donante, error: donanteError } = await supabase
        .from('donante')
        .insert({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim() || null,
          rut: form.rut.trim(),
          grupo_sanguineo: form.grupoSanguineo,
          fenotipo: fenotipoTexto || null,
          fenotipo_raro: etiquetasSeleccionadas.includes('Fenotipo sanguíneo raro'),
          frecuente_plaquetas: etiquetasSeleccionadas.includes('Donante de plaquetas'),
          observaciones: form.observaciones.trim() || null,
          comuna: form.comuna || null,
          reaccion_adversa_previa: false,
          sincronizado_registro_global: false,
        })
        .select('id')
        .single();

      if (donanteError) throw donanteError;

      const donanteId = donante.id;

      const { error: consentError } = await supabase
        .from('consentimiento')
        .insert({
          donante_id: donanteId,
          acepta_cookies: consentCookies,
          fecha_cookies: consentCookies ? new Date().toISOString() : null,
          autoriza_contacto: consentContacto,
          fecha_autoriza_contacto: consentContacto ? new Date().toISOString() : null,
          registrado_por: user?.id ?? null,
        });

      if (consentError) throw consentError;

      if (etiquetasSeleccionadas.length > 0) {
        const { error: etiquetasError } = await supabase
          .from('etiqueta_donante')
          .insert(
            etiquetasSeleccionadas.map(e => ({ donante_id: donanteId, etiqueta: e }))
          );
        if (etiquetasError) throw etiquetasError;
      }

      navigate('/donantes');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el donante.');
    } finally {
      setLoading(false);
    }
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

        <div className={styles.panelIzquierdo} style={{ textAlign: 'left' }}>

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

          <div className={styles.filaFormulario}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
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

            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
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
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
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

            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
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

          <div className={styles.filaFormulario} style={{ marginTop: '15px' }}>
            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
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

            <div className={styles.grupoInput} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Fenotipo</label>
              <div
                className={styles.selectContenedor}
                onClick={() => setIsModalOpen(true)}
              >
                <input
                  type="text"
                  className={styles.select}
                  style={{ cursor: 'pointer', caretColor: 'transparent', color: '#333' }}
                  readOnly
                  value={estanTodosCompletos ? fenotipoTexto : 'Haga clic para definir...'}
                />
                <div className={styles.selectIcon}>▼</div>
              </div>
            </div>
          </div>

        </div>

        <div className={styles.panelDerecho} style={{ textAlign: 'left', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Etiquetas del donante</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {ETIQUETAS_DISPONIBLES.map(etiqueta => (
                <label key={etiqueta} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={etiquetasSeleccionadas.includes(etiqueta)}
                    onChange={() => toggleEtiqueta(etiqueta)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
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
              className={styles.input}
              placeholder="Ej: Donó sin problemas, se desmayó brevemente, requirió hidratación..."
              rows={4}
              value={form.observaciones}
              onChange={handleChange}
              style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '14px', padding: '10px' }}
            />
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
              Acepta el uso de cookies y el tratamiento de datos según la política del sistema
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
              Autoriza a ser contactado telefónicamente ante una necesidad de transfusión compatible
            </label>
          </div>

          <button
            className={styles.botonGuardar}
            style={{ marginTop: '30px' }}
            disabled={loading}
            onClick={handleGuardar}
          >
            {loading ? 'Guardando...' : 'Finalizar y guardar donante'}
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContenido}>

            <div className={styles.modalCabecera}>
              <h2>Tipificación Extendida</h2>
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
                {filasAgrupadas.map((par, index) => (
                  <tr key={index}>
                    <td className={styles.nombreAntigeno}>{par[0]}</td>
                    <td>
                      <select
                        className={styles.selectCompacto}
                        value={valoresFenotipos[par[0]!] || ''}
                        onChange={(e) => handleCambioFenotipo(par[0]!, e.target.value)}
                      >
                        <option value=""></option>
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
                            <option value=""></option>
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
                className={styles.botonGuardarModal}
                disabled={!estanTodosCompletos}
                onClick={() => setIsModalOpen(false)}
              >
                Guardar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
