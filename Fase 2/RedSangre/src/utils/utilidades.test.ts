// Comentarios - Pruebas de utilidades
// Pruebas unitarias de las funciones puras de src/utils. Se ejecutan con "npm test" y no tocan la base.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { correoCanonico, tieneFormatoCorreo, validarCorreo, MENSAJE_DOMINIO } from './validacionCorreo';
import { validarContrasena, MENSAJE_POLITICA_CONTRASENA } from './politicaContrasena';
import { fechaLocal, formatearFecha, mesesDesde } from './fechas';
import { valorFiltro } from './filtrosPostgrest';
import { obtenerEstadoSolicitud } from './estadosSolicitud';

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
