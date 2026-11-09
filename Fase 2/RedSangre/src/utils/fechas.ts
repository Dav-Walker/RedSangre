// Comentarios - Fechas locales
// Convierte una fecha 'AAAA-MM-DD' (columna date de la base) en un Date a medianoche hora local.
// new Date('AAAA-MM-DD') la interpreta en UTC y en Chile muestra el día anterior.
export function fechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

// Comentarios - Fechas locales
// Fecha de hoy en formato 'AAAA-MM-DD' según la hora local (en-CA usa ese formato).
export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

// Comentarios - Fechas locales
// Meses completos transcurridos desde una fecha 'AAAA-MM-DD' hasta hoy (por calendario, sin contar días).
export function mesesDesde(fecha: string): number {
  const hoy = new Date();
  const desde = fechaLocal(fecha);
  return (hoy.getFullYear() - desde.getFullYear()) * 12 + (hoy.getMonth() - desde.getMonth());
}

// Comentarios - Fechas locales
// Formatea una fecha 'AAAA-MM-DD' como dd-mm-aaaa para mostrarla en pantalla.
export function formatearFecha(fecha: string): string {
  return fechaLocal(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Comentarios - Fechas locales
// Texto del tiempo transcurrido desde una fecha: "este mes", "hace 1 mes" o "hace N meses".
export function textoMesesDesde(fecha: string): string {
  const meses = mesesDesde(fecha);
  if (meses === 0) return 'este mes';
  if (meses === 1) return 'hace 1 mes';
  return `hace ${meses} meses`;
}
