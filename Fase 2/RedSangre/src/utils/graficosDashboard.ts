// Comentarios - Gráficos del dashboard
// Preparan los datos de las vistas para los gráficos de Recharts. Son funciones puras: se prueban sin la base.
import type { DemandaMes, DonacionesMes, DonanteFenotipo } from '../servicios/dashboard';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface PuntoTendencia {
  clave: string;
  name: string;
  donaciones: number;
  solicitudes: number;
}

// Comentarios - Gráficos del dashboard
// Une donaciones y solicitudes por mes (AAAA-MM), en orden cronológico.
// Las vistas pueden devolver null en sus columnas: esas filas se omiten o cuentan como 0.
export function construirTendencia(donaciones: DonacionesMes[], demanda: DemandaMes[]): PuntoTendencia[] {
  const puntos = new Map<string, PuntoTendencia>();

  const obtenerPunto = (anio: number, mes: number) => {
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    const existente = puntos.get(clave);
    if (existente) return existente;

    const nuevo = { clave, name: `${MESES[mes - 1]} ${String(anio).slice(-2)}`, donaciones: 0, solicitudes: 0 };
    puntos.set(clave, nuevo);
    return nuevo;
  };

  donaciones.forEach((d) => {
    if (d.anio !== null && d.mes !== null) obtenerPunto(d.anio, d.mes).donaciones += d.total_donaciones ?? 0;
  });
  demanda.forEach((s) => {
    if (s.anio !== null && s.mes !== null) obtenerPunto(s.anio, s.mes).solicitudes += s.total_solicitudes ?? 0;
  });

  return [...puntos.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

// Comentarios - Gráficos del dashboard
// Los 5 fenotipos más frecuentes entre los donantes, filtrados por grupo ('Todos' no filtra).
export function calcularFenotipos(donantes: DonanteFenotipo[], grupo: string): { name: string; value: number }[] {
  const conteo: Record<string, number> = {};

  donantes.forEach((d) => {
    const fenotipo = d.fenotipo?.trim();
    if (!fenotipo) return;
    if (grupo !== 'Todos' && d.grupo_sanguineo !== grupo) return;
    conteo[fenotipo] = (conteo[fenotipo] || 0) + 1;
  });

  return Object.entries(conteo)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));
}
