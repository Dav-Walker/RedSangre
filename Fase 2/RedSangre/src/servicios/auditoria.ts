// Comentarios - Bitácora completa
// Registra en la bitácora (tabla auditoria) lo que hace el usuario y que no es un cambio en una tabla: inicio y
// cierre de sesión, páginas que visita, consultas, llamadas y operaciones que la base rechaza. Los cambios en
// tablas los registran solos los triggers de la base. Si el registro falla, la acción del usuario no se interrumpe.
import { supabase } from '../utils/supabase';
import type { Json } from '../tipos/database.types';

export type AccionBitacora =
  | 'LOGIN'
  | 'LOGIN_TOTP_FALLIDO'
  | 'LOGOUT'
  | 'SESION_EXPIRADA'
  | 'VER_PAGINA'
  | 'VER_DONANTE'
  | 'VER_SOLICITUD'
  | 'VER_USUARIO'
  | 'BUSCAR_DONANTES'
  | 'BUSCAR_SOLICITUDES'
  | 'BUSCAR_CANDIDATOS'
  | 'LLAMAR_DONANTE'
  | 'OPERACION_RECHAZADA';

interface DatosEvento {
  tabla?: string;
  registroId?: string;
  detalle?: { [clave: string]: Json | undefined };
}

export async function registrarEvento(accion: AccionBitacora, datos: DatosEvento = {}): Promise<void> {
  const { error } = await supabase.rpc('fn_auditar', {
    p_accion: accion,
    p_tabla: datos.tabla,
    p_registro: datos.registroId,
    p_detalle: datos.detalle,
  });
  if (error) console.warn('No se pudo registrar en la bitácora:', accion, error.code);
}

// Comentarios - Bitácora completa
// Registra una operación que la base rechazó (permiso o regla de negocio). Guarda solo el código del error,
// no el mensaje, porque algunos mensajes incluyen datos del donante (por ejemplo, el RUT).
export function registrarRechazo(operacion: string, codigo: string | undefined, registroId?: string): void {
  void registrarEvento('OPERACION_RECHAZADA', { registroId, detalle: { operacion, codigo: codigo ?? null } });
}
