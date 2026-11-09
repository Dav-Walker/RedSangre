// Comentarios - Servicio del dashboard
// Lee en paralelo las vistas del dashboard. Cada parte informa su propio error, para que un panel que falla
// no deje vacío el resto de la pantalla.
import { supabase } from '../utils/supabase';
import type { Tables } from '../tipos/database.types';

export type SolicitudActiva = Pick<Tables<'v_solicitud_activa'>, 'id' | 'codigo_solicitud' | 'grupo_sanguineo_requerido' | 'urgencia' | 'estado'>;
export type DonacionesMes = Pick<Tables<'v_donaciones_mensuales'>, 'anio' | 'mes' | 'total_donaciones'>;
export type DemandaMes = Pick<Tables<'v_demanda_historica'>, 'anio' | 'mes' | 'total_solicitudes'>;
export type DonanteFenotipo = Pick<Tables<'donante'>, 'grupo_sanguineo' | 'fenotipo'>;

export interface DatosDashboard {
  resumen: Tables<'v_dashboard_resumen'> | null;
  porGrupo: Pick<Tables<'v_dashboard_donantes_por_grupo'>, 'grupo_sanguineo' | 'disponibles'>[];
  solicitudesActivas: SolicitudActiva[];
  donaciones: DonacionesMes[];
  demanda: DemandaMes[];
  donantes: DonanteFenotipo[];
  errores: { kpis: boolean; grupos: boolean; solicitudes: boolean; tendencia: boolean; fenotipos: boolean };
}

export async function cargarDashboard(): Promise<DatosDashboard> {
  const [resumen, grupos, activas, donaciones, demanda, donantes] = await Promise.all([
    supabase.from('v_dashboard_resumen').select('*').single(),
    supabase.from('v_dashboard_donantes_por_grupo').select('grupo_sanguineo, disponibles'),
    supabase.from('v_solicitud_activa')
      .select('id, codigo_solicitud, grupo_sanguineo_requerido, urgencia, estado')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('v_donaciones_mensuales').select('anio, mes, total_donaciones'),
    supabase.from('v_demanda_historica').select('anio, mes, total_solicitudes'),
    supabase.from('donante').select('grupo_sanguineo, fenotipo'),
  ]);

  [resumen.error, grupos.error, activas.error, donaciones.error, demanda.error, donantes.error]
    .filter(Boolean)
    .forEach((error) => console.error('Error cargando dashboard:', error));

  return {
    resumen: resumen.data,
    porGrupo: grupos.data ?? [],
    solicitudesActivas: activas.data ?? [],
    donaciones: donaciones.data ?? [],
    demanda: demanda.data ?? [],
    donantes: donantes.data ?? [],
    errores: {
      kpis: !!resumen.error,
      grupos: !!grupos.error,
      solicitudes: !!activas.error,
      tendencia: !!(donaciones.error || demanda.error),
      fenotipos: !!donantes.error,
    },
  };
}
