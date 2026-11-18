// Comentarios - Pruebas de utilidades
// Pruebas unitarias de las funciones puras de src/utils. Se ejecutan con "npm test" y no tocan la base.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { correoCanonico, tieneFormatoCorreo, validarCorreo, MENSAJE_DOMINIO } from './validacionCorreo';
import { validarContrasena, MENSAJE_POLITICA_CONTRASENA } from './politicaContrasena';
import { fechaLocal, formatearFecha, mesesDesde } from './fechas';
import { valorFiltro } from './filtrosPostgrest';
import { obtenerEstadoSolicitud } from './estadosSolicitud';
import { calcularFenotipos, construirTendencia } from './graficosDashboard';
import { traducirErrorAuth } from './mensajesAuth';
import { esEtiquetaDeColumna } from './etiquetas';
import { antigenosElegidos, textoFenotipo } from './fenotipo';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { mensajeErrorAuth } from './mensajesAuth';
import {
  EVENTO_SESION_EXPIRADA,
  MENSAJE_SESION_EXPIRADA,
  MENSAJE_SIN_CONEXION,
  MENSAJE_SIN_PERMISO,
  mensajeError,
  restriccionDelError,
} from './mensajesError';
import { rutTieneFormatoValido, telefonoTieneFormatoValido } from './validacionDonante';

describe('validarCorreo', () => {
  it('acepta correos de los dominios permitidos', () => {
    expect(validarCorreo('jose.perez@indisa.cl')).toBeNull();
    expect(validarCorreo('  Ana@Gmail.com ')).toBeNull();
  });

  it('rechaza dominios no permitidos y formatos inválidos', () => {
    expect(validarCorreo('prueba@mailinator.com')).toBe(MENSAJE_DOMINIO);
    expect(validarCorreo('a..b@indisa.cl')).not.toBeNull();
    expect(validarCorreo('sin-arroba')).not.toBeNull();
    expect(validarCorreo('')).toBe('Ingresa el correo.');
  });
});

describe('correoCanonico', () => {
  it('trata como iguales las variantes de Gmail con puntos y "+"', () => {
    expect(correoCanonico('J.Perez+x@gmail.com')).toBe('jperez@gmail.com');
  });

  it('no altera los puntos en otros dominios', () => {
    expect(correoCanonico('j.perez@indisa.cl')).toBe('j.perez@indisa.cl');
  });
});

describe('tieneFormatoCorreo', () => {
  it('acepta cualquier dominio con formato válido', () => {
    expect(tieneFormatoCorreo('donante@empresa.com')).toBe(true);
  });

  it('rechaza textos sin formato de correo', () => {
    expect(tieneFormatoCorreo('donante@empresa')).toBe(false);
    expect(tieneFormatoCorreo('donante empresa.com')).toBe(false);
  });
});

describe('validarContrasena', () => {
  it('acepta una contraseña con minúscula, mayúscula, número y símbolo', () => {
    expect(validarContrasena('Clave.12345')).toBeNull();
  });

  // Comentarios - Política de contraseñas alineada con Supabase Auth
  // Cada caso falla por una sola regla: largo, mayúscula, minúscula, número, símbolo, ñ no es símbolo y máximo 72
  it('rechaza contraseñas que Auth también rechazaría', () => {
    expect(validarContrasena('Cl.1')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('clave.12345')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('CLAVE.12345')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('Clave.clave')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('Clave123456')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('Claveñ12345')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('Cl.1' + 'a'.repeat(69))).toBe(MENSAJE_POLITICA_CONTRASENA);
  });
});

describe('fechas locales', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('interpreta AAAA-MM-DD como fecha local, sin desfase de zona horaria', () => {
    const fecha = fechaLocal('2026-03-05');
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()]).toEqual([2026, 2, 5]);
  });

  it('formatea como dd-mm-aaaa', () => {
    expect(formatearFecha('2026-03-05')).toBe('05-03-2026');
  });

  it('cuenta los meses calendario transcurridos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9));
    expect(mesesDesde('2026-11-01')).toBe(0);
    expect(mesesDesde('2026-07-30')).toBe(4);
  });
});

describe('valorFiltro', () => {
  it('encierra el texto entre comillas y escapa comillas y barras', () => {
    expect(valorFiltro('%perez, juan%')).toBe('"%perez, juan%"');
    expect(valorFiltro('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe('obtenerEstadoSolicitud', () => {
  it('devuelve el estado si es válido y "abierta" si no lo es', () => {
    expect(obtenerEstadoSolicitud('cerrada')).toBe('cerrada');
    expect(obtenerEstadoSolicitud('otro')).toBe('abierta');
    expect(obtenerEstadoSolicitud(null)).toBe('abierta');
  });
});

describe('construirTendencia', () => {
  it('une donaciones y solicitudes por mes en orden cronológico y omite filas sin fecha', () => {
    const puntos = construirTendencia(
      [{ anio: 2026, mes: 2, total_donaciones: 3 }, { anio: null, mes: 1, total_donaciones: 9 }],
      [{ anio: 2026, mes: 1, total_solicitudes: 2 }, { anio: 2026, mes: 2, total_solicitudes: null }],
    );
    expect(puntos).toEqual([
      { clave: '2026-01', name: 'Ene 26', donaciones: 0, solicitudes: 2 },
      { clave: '2026-02', name: 'Feb 26', donaciones: 3, solicitudes: 0 },
    ]);
  });
});

describe('calcularFenotipos', () => {
  it('cuenta los fenotipos y filtra por grupo', () => {
    const donantes = [
      { grupo_sanguineo: 'O+' as const, fenotipo: 'K+' },
      { grupo_sanguineo: 'O+' as const, fenotipo: 'K+' },
      { grupo_sanguineo: 'A+' as const, fenotipo: 'C-' },
      { grupo_sanguineo: 'A+' as const, fenotipo: null },
    ];
    expect(calcularFenotipos(donantes, 'Todos')).toEqual([{ name: 'K+', value: 2 }, { name: 'C-', value: 1 }]);
    expect(calcularFenotipos(donantes, 'A+')).toEqual([{ name: 'C-', value: 1 }]);
  });
});

describe('traducirErrorAuth', () => {
  it('traduce los códigos conocidos y usa el mensaje por defecto para los demás', () => {
    expect(traducirErrorAuth('invalid_credentials', 'x')).toBe('Correo o contraseña incorrectos.');
    expect(traducirErrorAuth('codigo_desconocido', 'Mensaje por defecto')).toBe('Mensaje por defecto');
    expect(traducirErrorAuth(undefined, 'Mensaje por defecto')).toBe('Mensaje por defecto');
  });
});

describe('etiquetas de donante', () => {
  it('reconoce las etiquetas que también son columnas de donante', () => {
    expect(esEtiquetaDeColumna('Fenotipo sanguíneo raro')).toBe(true);
    expect(esEtiquetaDeColumna('Donante de plaquetas')).toBe(true);
    expect(esEtiquetaDeColumna('Donación altruista')).toBe(false);
  });
});

describe('fenotipo', () => {
  it('arma el texto con cada antígeno separado por coma, en el orden del modo extendido', () => {
    const valores = { K: 'POSITIVO', C: 'NEGATIVO', e: '', Fya: 'POSITIVO' };
    expect(antigenosElegidos(valores)).toEqual(['C-', 'Fya+', 'K+']);
    expect(textoFenotipo(valores)).toBe('C-, Fya+, K+');
  });

  it('devuelve texto vacío si no se eligió ningún antígeno', () => {
    expect(textoFenotipo({ C: '', K: '' })).toBe('');
  });
});

// Comentarios - Manejo de errores y excepciones
// El traductor nunca debe devolver el texto original de la base: siempre un mensaje fijo en español.
describe('mensajeError', () => {
  const PALABRAS_INTERNAS = /constraint|violates|relation|policy|PGRST|function|column|duplicate|JWT|TypeError|_key|ck_|fn_/i;

  it('elige el mensaje propio de la operación por el nombre de la restricción', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "donante_rut_key"' };
    expect(restriccionDelError(error)).toBe('donante_rut_key');
    expect(mensajeError(error, 'Por defecto', { donante_rut_key: 'Ya existe un donante registrado con ese RUT.' }))
      .toBe('Ya existe un donante registrado con ese RUT.');
  });

  it('usa el mensaje general del código cuando la operación no tiene uno propio', () => {
    const error = { code: '42501', message: 'new row violates row-level security policy for table "solicitud"' };
    expect(mensajeError(error, 'Por defecto')).toBe(MENSAJE_SIN_PERMISO);
  });

  it('reconoce la falta de conexión', () => {
    expect(mensajeError({ code: '', message: 'TypeError: Failed to fetch' }, 'Por defecto')).toBe(MENSAJE_SIN_CONEXION);
  });

  it('reconoce la sesión vencida y avisa a la aplicación', () => {
    const ventana = new EventTarget();
    vi.stubGlobal('window', ventana);
    const escuchar = vi.fn();
    ventana.addEventListener(EVENTO_SESION_EXPIRADA, escuchar);
    expect(mensajeError({ code: 'PGRST303', message: 'JWT expired' }, 'Por defecto')).toBe(MENSAJE_SESION_EXPIRADA);
    expect(escuchar).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('usa el mensaje por defecto para códigos desconocidos y nunca devuelve el texto de la base', () => {
    const errores = [
      { code: 'XX000', message: 'internal error in function fn_registrar_donante' },
      { code: '23514', message: 'new row for relation "donante" violates check constraint "ck_donante_telefono_formato"' },
      { code: '23503', message: 'insert or update on table "donante" violates foreign key constraint "donante_comuna_fkey"' },
      { code: 'RS007', message: 'RUT con formato inválido: 12.345' },
      { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    ];
    for (const error of errores) {
      const mensaje = mensajeError(error, 'No se pudo completar la operación.');
      expect(mensaje).not.toBe(error.message);
      expect(mensaje).not.toMatch(PALABRAS_INTERNAS);
    }
  });
});

describe('mensajeErrorAuth', () => {
  it('reconoce la falta de conexión de Auth y traduce los códigos conocidos', () => {
    expect(mensajeErrorAuth(new AuthRetryableFetchError('Failed to fetch', 0), 'x')).toBe(MENSAJE_SIN_CONEXION);
    expect(mensajeErrorAuth({ code: 'invalid_credentials' }, 'x')).toBe('Correo o contraseña incorrectos.');
    expect(mensajeErrorAuth({ code: 'otro' }, 'Por defecto')).toBe('Por defecto');
  });
});

describe('validación de donante', () => {
  it('acepta el RUT con o sin puntos y rechaza formatos que la base no acepta', () => {
    expect(rutTieneFormatoValido('12.345.678-5')).toBe(true);
    expect(rutTieneFormatoValido('1234567-k')).toBe(true);
    expect(rutTieneFormatoValido('12345')).toBe(false);
    expect(rutTieneFormatoValido('123456789-0')).toBe(false);
  });

  it('acepta teléfonos con el formato de la base', () => {
    expect(telefonoTieneFormatoValido('+56 9 1234 5678')).toBe(true);
    expect(telefonoTieneFormatoValido('912345678')).toBe(true);
    expect(telefonoTieneFormatoValido('abc')).toBe(false);
    expect(telefonoTieneFormatoValido('123')).toBe(false);
  });
});
