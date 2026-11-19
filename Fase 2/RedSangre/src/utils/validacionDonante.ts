// Comentarios - Manejo de errores y excepciones
// Validaciones del formulario de donante que repiten las reglas de la base (fn_normalizar_donante y las
// restricciones ck_donante_*). Así el error se avisa en el formulario, antes de que la base lo rechace.
// El dígito verificador del RUT se revisa solo en el alta (rutDvValido), igual que la base: los donantes
// simulados ya registrados no cumplen el módulo 11 y se siguen pudiendo editar.

export const LARGO_MAXIMO_NOMBRE = 80;
export const LARGO_MAXIMO_ETIQUETA = 50;
export const LARGO_MAXIMO_OBSERVACIONES = 1000;
export const LARGO_MAXIMO_CORREO = 254;
export const LARGO_MAXIMO_TELEFONO = 20;
export const LARGO_MAXIMO_RUT = 12;

export const MENSAJE_RUT_INVALIDO = 'El RUT no tiene un formato válido. Ejemplo: 12345678-9.';
export const MENSAJE_TELEFONO_INVALIDO = 'El teléfono no es válido. Ejemplo: +56 9 1234 5678.';
export const MENSAJE_NOMBRE_LARGO = `El nombre y el apellido admiten hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`;

// Comentarios - Manejo de errores y excepciones
// Mismo formato que exige la base después de normalizar: se quitan puntos, guion y espacios, y deben quedar
// 7 u 8 dígitos más el dígito verificador (número o k).
export function rutTieneFormatoValido(rut: string): boolean {
  const limpio = rut.trim().toLowerCase().replace(/[^0-9k]/g, '');
  return /^[0-9]{7,8}[0-9k]$/.test(limpio);
}

// Comentarios - Dígito verificador solo para RUT nuevos
// Revisa el dígito verificador con el módulo 11, el mismo cálculo de fn_rut_dv_valido en la base.
// Se usa en el alta del donante, después de comprobar el formato con rutTieneFormatoValido.
export const MENSAJE_RUT_DV_INVALIDO = 'El dígito verificador del RUT no es válido. Revisa el número ingresado.';

export function rutDvValido(rut: string): boolean {
  const limpio = rut.trim().toLowerCase().replace(/[^0-9k]/g, '');
  const numero = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^[0-9]+$/.test(numero)) return false;
  let suma = 0;
  let multiplicador = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'k' : String(resto);
  return dv === esperado;
}

// Comentarios - Manejo de errores y excepciones
// Mismo formato que ck_donante_telefono_formato, después de juntar los espacios repetidos como hace la base.
export function telefonoTieneFormatoValido(telefono: string): boolean {
  const normalizado = telefono.trim().replace(/\s+/g, ' ');
  return /^\+?[0-9][0-9 ]{7,17}$/.test(normalizado);
}
