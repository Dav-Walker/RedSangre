// Comentarios - Manejo de errores y excepciones
// Validaciones del formulario de donante que repiten las reglas de la base (fn_normalizar_donante y las
// restricciones ck_donante_*). Así el error se avisa en el formulario, antes de que la base lo rechace.
// El dígito verificador del RUT no se revisa aquí: la base solo lo exige si validar_dv_rut está activo,
// y está desactivado porque los datos simulados no cumplen el módulo 11.

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

// Comentarios - Manejo de errores y excepciones
// Mismo formato que ck_donante_telefono_formato, después de juntar los espacios repetidos como hace la base.
export function telefonoTieneFormatoValido(telefono: string): boolean {
  const normalizado = telefono.trim().replace(/\s+/g, ' ');
  return /^\+?[0-9][0-9 ]{7,17}$/.test(normalizado);
}
