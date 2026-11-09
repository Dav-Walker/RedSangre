// Comentarios - Tipos de la base de datos
// Nombres cortos para los tipos generados desde el esquema (database.types.ts).
// Si cambia la base, se regenera database.types.ts con "npm run tipos" y estos alias se actualizan solos.
import type { Enums, Tables } from './database.types';

export type GrupoSanguineo = Enums<'grupo_sanguineo_enum'>;
export type Urgencia = Enums<'urgencia_enum'>;
export type EstadoSolicitudBase = Enums<'estado_solicitud_enum'>;
export type ResultadoContacto = Enums<'resultado_contacto_enum'>;
export type TipoDonacion = Enums<'tipo_donacion_enum'>;
export type RolUsuario = Enums<'rol_usuario'>;

export type Donante = Tables<'donante'>;
export type Solicitud = Tables<'solicitud'>;
export type Usuario = Tables<'usuario'>;
