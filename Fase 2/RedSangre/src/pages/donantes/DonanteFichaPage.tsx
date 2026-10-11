import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import styles from './DonanteFichaPage.module.css';
import { supabase } from '../../utils/supabase';

interface DonanteDetalle {
  id: string;
  codigo_donante: string;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string | null;
  telefono: string | null;
  grupo_sanguineo: string;
  fenotipo: string | null;
  fenotipo_raro: boolean;
  frecuente_plaquetas: boolean;
  fecha_ultima_donacion: string | null;
  ubicacion: string | null;
  observaciones: string | null;
}

function calcularUltimaDonacion(fecha: string | null): string {
  if (!fecha) return '-';
  const hoy = new Date();
  const donacion = new Date(fecha);
  const meses = (hoy.getFullYear() - donacion.getFullYear()) * 12 + (hoy.getMonth() - donacion.getMonth());
  if (meses === 0) return 'este mes';
  if (meses === 1) return 'hace 1 mes';
  return `hace ${meses} meses`;
}

export function DonanteFichaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentimiento, setConsentimiento] = useState<{ acepta_cookies: boolean; autoriza_contacto: boolean } | null>(null);
  const [donante, setDonante] = useState<DonanteDetalle | null>(null);

  useEffect(() => {
    async function cargarDonante() {
      setCargando(true);
      setError(null);

      const { data, error: err } = await supabase!
        .from('donante')
        .select('*')
        .eq('codigo_donante', id)
        .single();

      if (err || !data) {
        setError('No se encontró el donante.');
        setCargando(false);
        return;
      }

      setDonante(data);

      const { data: consent } = await supabase!
        .from('consentimiento')
        .select('acepta_cookies, autoriza_contacto')
        .eq('donante_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setConsentimiento(consent ?? { acepta_cookies: false, autoriza_contacto: false });
      setCargando(false);
    }
    cargarDonante();
  }, [id]);

  const handleGuardar = async () => {
    if (!donante) return;
    const { error: err } = await supabase!
      .from('donante')
      .update({
        nombre: donante.nombre,
        apellido: donante.apellido,
        telefono: donante.telefono,
        ubicacion: donante.ubicacion,
        observaciones: donante.observaciones,
        grupo_sanguineo: donante.grupo_sanguineo,
        fenotipo: donante.fenotipo,
      })
      .eq('id', donante.id);

    if (err) {
      alert('Error al guardar: ' + err.message);
    } else {
      setIsEditing(false);
      alert('¡Cambios guardados exitosamente!');
    }
  };

  if (cargando) return <p style={{ textAlign: 'center', padding: '40px' }}>Cargando donante...</p>;
  if (error || !donante) return <p style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</p>;

  const etiquetas = [
    ...(donante.fenotipo_raro ? [{ texto: 'Fenotipo raro', color: 'morado' }] : []),
    ...(donante.frecuente_plaquetas ? [{ texto: 'Plaquetas', color: 'azul' }] : []),
  ];

  return (
    <div className={styles.contenedor}>

      <div className={styles.cabecera}>
        <button onClick={() => navigate('/donantes')} className={styles.botonVolver}>
          ← Volver a donantes
        </button>
        <h2 className={styles.tituloPagina}>Ficha de donante · {donante.codigo_donante}</h2>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <input className={styles.inputEdit} style={{ fontSize: '24px', fontWeight: 'bold', flex: 1 }}
            value={donante.nombre} onChange={(e) => setDonante({ ...donante, nombre: e.target.value })} placeholder="Nombre" />
          <input className={styles.inputEdit} style={{ fontSize: '24px', fontWeight: 'bold', flex: 1 }}
            value={donante.apellido} onChange={(e) => setDonante({ ...donante, apellido: e.target.value })} placeholder="Apellido" />
        </div>
      ) : (
        <h1 className={styles.nombreDonante}>{donante.nombre} {donante.apellido}</h1>
      )}

      <div className={styles.layoutColumnas}>

        {/* COLUMNA 1 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Datos clínicos</h3>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>RUT</span>
            <span className={styles.valorDato}>{donante.rut}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Grupo sanguíneo</span>
            {isEditing ? (
              <select className={styles.selectEdit} value={donante.grupo_sanguineo} onChange={(e) => setDonante({ ...donante, grupo_sanguineo: e.target.value })}>
                {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}
              </select>
            ) : (
              <span className={styles.valorDato}>{donante.grupo_sanguineo}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Fenotipo</span>
            {isEditing ? (
              <input type="text" className={styles.inputEdit} value={donante.fenotipo || ''} onChange={(e) => setDonante({ ...donante, fenotipo: e.target.value })} />
            ) : (
              <span className={styles.valorDato}>{donante.fenotipo || '-'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Última donación</span>
            <span className={styles.valorDato}>{calcularUltimaDonacion(donante.fecha_ultima_donacion)}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Etiquetas</span>
            <div className={styles.contenedorEtiquetas}>
              {etiquetas.length > 0 ? etiquetas.map((eti, i) => (
                <Badge key={i} texto={eti.texto} color={eti.color as any} />
              )) : <span style={{ color: '#aaa' }}>-</span>}
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Observaciones</span>
            {isEditing ? (
              <textarea className={styles.inputEdit} style={{ minHeight: '80px', resize: 'vertical' }}
                value={donante.observaciones || ''}
                onChange={(e) => setDonante({ ...donante, observaciones: e.target.value })} />
            ) : (
              <span className={styles.valorDato}>{donante.observaciones || '-'}</span>
            )}
          </div>
        </div>

        {/* COLUMNA 2 */}
        <div className={styles.tarjeta}>
          <h3 className={styles.tarjetaHeader}>Contacto y consentimiento</h3>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Correo</span>
            <span className={styles.valorDato}>{donante.correo || '-'}</span>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Teléfono</span>
            {isEditing ? (
              <input type="text" className={styles.inputEdit} value={donante.telefono || ''} onChange={(e) => setDonante({ ...donante, telefono: e.target.value })} />
            ) : (
              <span className={styles.valorDato}>{donante.telefono || '-'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Ubicación</span>
            {isEditing ? (
              <input type="text" className={styles.inputEdit} value={donante.ubicacion || ''} onChange={(e) => setDonante({ ...donante, ubicacion: e.target.value })} />
            ) : (
              <span className={styles.valorDato}>{donante.ubicacion || '-'}</span>
            )}
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Cookies aceptadas</span>
            <div className={styles.contenedorEtiquetas}>
              <Badge texto={consentimiento?.acepta_cookies ? 'Sí' : 'No'} color={consentimiento?.acepta_cookies ? 'verde' : 'gris'} />
            </div>
          </div>

          <div className={styles.filaDatos}>
            <span className={styles.etiquetaDato}>Autoriza contacto</span>
            <div className={styles.contenedorEtiquetas}>
              <Badge texto={consentimiento?.autoriza_contacto ? 'Sí' : 'No'} color={consentimiento?.autoriza_contacto ? 'verde' : 'gris'} />
            </div>
          </div>
        </div>

      </div>

      <div className={styles.pieFicha}>
        {isEditing ? (
          <div className={styles.botonesPie}>
            <button className={styles.botonCancelar} onClick={() => setIsEditing(false)}>Cancelar</button>
            <Button texto="Guardar cambios" onClick={handleGuardar} />
          </div>
        ) : (
          <Button texto="Editar donante" onClick={() => setIsEditing(true)} />
        )}
      </div>
    </div>
  );
}