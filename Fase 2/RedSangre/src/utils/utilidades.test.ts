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
  it('acepta una contraseña con letra, número y carácter especial', () => {
    expect(validarContrasena('clave.123')).toBeNull();
  });

  it('rechaza contraseñas cortas o sin carácter especial', () => {
    expect(validarContrasena('a.1')).toBe(MENSAJE_POLITICA_CONTRASENA);
    expect(validarContrasena('clave1234')).toBe(MENSAJE_POLITICA_CONTRASENA);
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
