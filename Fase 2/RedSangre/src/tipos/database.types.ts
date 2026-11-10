export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          aal: string | null
          accion: string
          detalle: Json | null
          fecha: string
          id: string
          ip: unknown
          origen: string | null
          registro_clave: string | null
          registro_id: string | null
          tabla_afectada: string | null
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          aal?: string | null
          accion: string
          detalle?: Json | null
          fecha?: string
          id?: string
          ip?: unknown
          origen?: string | null
          registro_clave?: string | null
          registro_id?: string | null
          tabla_afectada?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          aal?: string | null
          accion?: string
          detalle?: Json | null
          fecha?: string
          id?: string
          ip?: unknown
          origen?: string | null
          registro_clave?: string | null
          registro_id?: string | null
          tabla_afectada?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      comuna: {
        Row: {
          latitud: number
          longitud: number
          nombre: string
          provincia: string
        }
        Insert: {
          latitud: number
          longitud: number
          nombre: string
          provincia: string
        }
        Update: {
          latitud?: number
          longitud?: number
          nombre?: string
          provincia?: string
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          clave: string
          descripcion: string | null
          updated_at: string
          valor: string
        }
        Insert: {
          clave: string
          descripcion?: string | null
          updated_at?: string
          valor: string
        }
        Update: {
          clave?: string
          descripcion?: string | null
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      consentimiento: {
        Row: {
          acepta_cookies: boolean
          autoriza_contacto: boolean
          created_at: string
          donante_id: string
          fecha_autoriza_contacto: string | null
          fecha_cookies: string | null
          id: string
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          acepta_cookies: boolean
          autoriza_contacto: boolean
          created_at?: string
          donante_id: string
          fecha_autoriza_contacto?: string | null
          fecha_cookies?: string | null
          id?: string
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          acepta_cookies?: boolean
          autoriza_contacto?: boolean
          created_at?: string
          donante_id?: string
          fecha_autoriza_contacto?: string | null
          fecha_cookies?: string | null
          id?: string
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimiento_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimiento_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimiento_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      donacion: {
        Row: {
          created_at: string
          detalle_reaccion: string | null
          donante_id: string
          fecha_donacion: string
          hubo_reaccion: boolean
          id: string
          registrado_por: string | null
          solicitud_id: string | null
          tipo: Database["public"]["Enums"]["tipo_donacion_enum"]
        }
        Insert: {
          created_at?: string
          detalle_reaccion?: string | null
          donante_id: string
          fecha_donacion?: string
          hubo_reaccion?: boolean
          id?: string
          registrado_por?: string | null
          solicitud_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_donacion_enum"]
        }
        Update: {
          created_at?: string
          detalle_reaccion?: string | null
          donante_id?: string
          fecha_donacion?: string
          hubo_reaccion?: boolean
          id?: string
          registrado_por?: string | null
          solicitud_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_donacion_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "donacion_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitud"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "v_solicitud_activa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "v_solicitud_listado"
            referencedColumns: ["id"]
          },
        ]
      }
      donante: {
        Row: {
          apellido: string
          codigo_donante: string | null
          comuna: string | null
          correo: string | null
          created_at: string
          fecha_ultima_donacion: string | null
          fenotipo: string | null
          fenotipo_raro: boolean
          frecuente_plaquetas: boolean
          grupo_sanguineo: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          id: string
          latitud: number | null
          longitud: number | null
          nombre: string
          observaciones: string | null
          reaccion_adversa_previa: boolean
          rut: string
          sexo: string | null
          sincronizado_registro_global: boolean
          telefono: string | null
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          apellido: string
          codigo_donante?: string | null
          comuna?: string | null
          correo?: string | null
          created_at?: string
          fecha_ultima_donacion?: string | null
          fenotipo?: string | null
          fenotipo_raro?: boolean
          frecuente_plaquetas?: boolean
          grupo_sanguineo: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre: string
          observaciones?: string | null
          reaccion_adversa_previa?: boolean
          rut: string
          sexo?: string | null
          sincronizado_registro_global?: boolean
          telefono?: string | null
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string
          codigo_donante?: string | null
          comuna?: string | null
          correo?: string | null
          created_at?: string
          fecha_ultima_donacion?: string | null
          fenotipo?: string | null
          fenotipo_raro?: boolean
          frecuente_plaquetas?: boolean
          grupo_sanguineo?: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre?: string
          observaciones?: string | null
          reaccion_adversa_previa?: boolean
          rut?: string
          sexo?: string | null
          sincronizado_registro_global?: boolean
          telefono?: string | null
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donante_comuna_fkey"
            columns: ["comuna"]
            isOneToOne: false
            referencedRelation: "comuna"
            referencedColumns: ["nombre"]
          },
        ]
      }
      etiqueta_donante: {
        Row: {
          created_at: string
          donante_id: string
          etiqueta: string
          id: string
        }
        Insert: {
          created_at?: string
          donante_id: string
          etiqueta: string
          id?: string
        }
        Update: {
          created_at?: string
          donante_id?: string
          etiqueta?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etiqueta_donante_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etiqueta_donante_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
        ]
      }
      secuencia_codigo: {
        Row: {
          anio: number
          tipo: string
          ultimo_valor: number
        }
        Insert: {
          anio: number
          tipo: string
          ultimo_valor?: number
        }
        Update: {
          anio?: number
          tipo?: string
          ultimo_valor?: number
        }
        Relationships: []
      }
      seguimiento_contacto: {
        Row: {
          canal: Database["public"]["Enums"]["canal_contacto_enum"]
          created_at: string
          donante_id: string
          fecha: string
          id: string
          observaciones: string | null
          registrado_por: string
          resultado: Database["public"]["Enums"]["resultado_contacto_enum"]
          solicitud_id: string
        }
        Insert: {
          canal: Database["public"]["Enums"]["canal_contacto_enum"]
          created_at?: string
          donante_id: string
          fecha?: string
          id?: string
          observaciones?: string | null
          registrado_por?: string
          resultado?: Database["public"]["Enums"]["resultado_contacto_enum"]
          solicitud_id: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_contacto_enum"]
          created_at?: string
          donante_id?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          registrado_por?: string
          resultado?: Database["public"]["Enums"]["resultado_contacto_enum"]
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguimiento_contacto_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_contacto_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_contacto_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_contacto_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitud"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_contacto_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "v_solicitud_activa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_contacto_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "v_solicitud_listado"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud: {
        Row: {
          codigo_solicitud: string | null
          creado_por: string
          created_at: string
          donante_asignado_id: string | null
          estado: Database["public"]["Enums"]["estado_solicitud_enum"]
          fecha_agendada: string | null
          fecha_cierre: string | null
          fenotipo_requerido: string | null
          grupo_sanguineo_requerido: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          id: string
          numero_externo: string | null
          reaccion: string | null
          updated_at: string
          urgencia: Database["public"]["Enums"]["urgencia_enum"]
        }
        Insert: {
          codigo_solicitud?: string | null
          creado_por?: string
          created_at?: string
          donante_asignado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud_enum"]
          fecha_agendada?: string | null
          fecha_cierre?: string | null
          fenotipo_requerido?: string | null
          grupo_sanguineo_requerido: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          id?: string
          numero_externo?: string | null
          reaccion?: string | null
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_enum"]
        }
        Update: {
          codigo_solicitud?: string | null
          creado_por?: string
          created_at?: string
          donante_asignado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud_enum"]
          fecha_agendada?: string | null
          fecha_cierre?: string | null
          fenotipo_requerido?: string | null
          grupo_sanguineo_requerido?: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          id?: string
          numero_externo?: string | null
          reaccion?: string | null
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_donante_asignado_id_fkey"
            columns: ["donante_asignado_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_donante_asignado_id_fkey"
            columns: ["donante_asignado_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario: {
        Row: {
          activo: boolean
          apellido: string
          correo: string
          created_at: string
          debe_cambiar_password: boolean
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          correo: string
          created_at?: string
          debe_cambiar_password?: boolean
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          correo?: string
          created_at?: string
          debe_cambiar_password?: boolean
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      consentimiento_vigente: {
        Row: {
          acepta_cookies: boolean | null
          autoriza_contacto: boolean | null
          created_at: string | null
          donante_id: string | null
          fecha_autoriza_contacto: string | null
          fecha_cookies: string | null
          id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consentimiento_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimiento_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
        ]
      }
      v_control_consentimientos: {
        Row: {
          con_ambos_consentimientos: number | null
          con_consentimiento_incompleto: number | null
          donantes_totales: number | null
          porcentaje_cumplimiento: number | null
          sin_fecha_hora: number | null
          sin_registro: number | null
        }
        Relationships: []
      }
      v_dashboard_donantes_por_grupo: {
        Row: {
          disponibles: number | null
          fenotipos_raros: number | null
          grupo_sanguineo:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          total: number | null
        }
        Relationships: []
      }
      v_dashboard_resumen: {
        Row: {
          disponibles_ahora: number | null
          donantes_totales: number | null
          fenotipos_raros: number | null
          plaquetas_frecuentes: number | null
        }
        Relationships: []
      }
      v_demanda_historica: {
        Row: {
          anio: number | null
          cerradas: number | null
          dias_promedio_cierre: number | null
          grupo_sanguineo:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          mes: number | null
          total_solicitudes: number | null
          urgencia: Database["public"]["Enums"]["urgencia_enum"] | null
        }
        Relationships: []
      }
      v_donacion_listado: {
        Row: {
          codigo_donante: string | null
          codigo_solicitud: string | null
          created_at: string | null
          detalle_reaccion: string | null
          donante: string | null
          donante_id: string | null
          fecha_donacion: string | null
          hubo_reaccion: boolean | null
          id: string | null
          registrado_por: string | null
          registrado_por_nombre: string | null
          solicitud_id: string | null
          tipo: Database["public"]["Enums"]["tipo_donacion_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "donacion_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitud"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "v_solicitud_activa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donacion_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "v_solicitud_listado"
            referencedColumns: ["id"]
          },
        ]
      }
      v_donaciones_mensuales: {
        Row: {
          anio: number | null
          con_reaccion: number | null
          mes: number | null
          por_solicitud: number | null
          tipo: Database["public"]["Enums"]["tipo_donacion_enum"] | null
          total_donaciones: number | null
        }
        Relationships: []
      }
      v_donante_listado: {
        Row: {
          apellido: string | null
          codigo_donante: string | null
          comuna: string | null
          created_at: string | null
          disponible: boolean | null
          etiquetas: string[] | null
          fecha_proxima_donacion: string | null
          fecha_ultima_donacion: string | null
          fenotipo: string | null
          fenotipo_raro: boolean | null
          frecuente_plaquetas: boolean | null
          grupo_sanguineo:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id: string | null
          meses_desde_ultima_donacion: number | null
          nombre: string | null
          nombre_completo: string | null
          puede_contactarse: boolean | null
          reaccion_adversa_previa: boolean | null
          rut: string | null
          total_donaciones: number | null
          ubicacion: string | null
        }
        Insert: {
          apellido?: string | null
          codigo_donante?: string | null
          comuna?: string | null
          created_at?: string | null
          disponible?: never
          etiquetas?: never
          fecha_proxima_donacion?: never
          fecha_ultima_donacion?: string | null
          fenotipo?: string | null
          fenotipo_raro?: boolean | null
          frecuente_plaquetas?: boolean | null
          grupo_sanguineo?:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id?: string | null
          meses_desde_ultima_donacion?: never
          nombre?: string | null
          nombre_completo?: never
          puede_contactarse?: never
          reaccion_adversa_previa?: boolean | null
          rut?: string | null
          total_donaciones?: never
          ubicacion?: string | null
        }
        Update: {
          apellido?: string | null
          codigo_donante?: string | null
          comuna?: string | null
          created_at?: string | null
          disponible?: never
          etiquetas?: never
          fecha_proxima_donacion?: never
          fecha_ultima_donacion?: string | null
          fenotipo?: string | null
          fenotipo_raro?: boolean | null
          frecuente_plaquetas?: boolean | null
          grupo_sanguineo?:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id?: string | null
          meses_desde_ultima_donacion?: never
          nombre?: string | null
          nombre_completo?: never
          puede_contactarse?: never
          reaccion_adversa_previa?: boolean | null
          rut?: string | null
          total_donaciones?: never
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donante_comuna_fkey"
            columns: ["comuna"]
            isOneToOne: false
            referencedRelation: "comuna"
            referencedColumns: ["nombre"]
          },
        ]
      }
      v_solicitud_activa: {
        Row: {
          codigo_solicitud: string | null
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_solicitud_enum"] | null
          fenotipo_requerido: string | null
          grupo_sanguineo_requerido:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id: string | null
          urgencia: Database["public"]["Enums"]["urgencia_enum"] | null
        }
        Insert: {
          codigo_solicitud?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud_enum"] | null
          fenotipo_requerido?: string | null
          grupo_sanguineo_requerido?:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id?: string | null
          urgencia?: Database["public"]["Enums"]["urgencia_enum"] | null
        }
        Update: {
          codigo_solicitud?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud_enum"] | null
          fenotipo_requerido?: string | null
          grupo_sanguineo_requerido?:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id?: string | null
          urgencia?: Database["public"]["Enums"]["urgencia_enum"] | null
        }
        Relationships: []
      }
      v_solicitud_listado: {
        Row: {
          candidato_asignado: string | null
          codigo_donante: string | null
          codigo_solicitud: string | null
          creado_por: string | null
          creado_por_nombre: string | null
          created_at: string | null
          donante_asignado_id: string | null
          estado: Database["public"]["Enums"]["estado_solicitud_enum"] | null
          fecha_agendada: string | null
          fecha_cierre: string | null
          fenotipo_requerido: string | null
          grupo_sanguineo_requerido:
            | Database["public"]["Enums"]["grupo_sanguineo_enum"]
            | null
          id: string | null
          numero_externo: string | null
          reaccion: string | null
          urgencia: Database["public"]["Enums"]["urgencia_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_donante_asignado_id_fkey"
            columns: ["donante_asignado_id"]
            isOneToOne: false
            referencedRelation: "donante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_donante_asignado_id_fkey"
            columns: ["donante_asignado_id"]
            isOneToOne: false
            referencedRelation: "v_donante_listado"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_auditar: {
        Args: {
          p_accion: string
          p_detalle?: Json
          p_registro?: string
          p_tabla?: string
        }
        Returns: undefined
      }
      fn_buscar_donantes_compatibles: {
        Args: {
          p_fenotipo_requerido?: string
          p_grupo_requerido: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          p_limite?: number
        }
        Returns: {
          apto: boolean
          asignado_activo: boolean
          codigo_donante: string
          compatibilidad: string
          disponible: boolean
          distancia_km: number
          donante_id: string
          fecha_ultima_donacion: string
          fenotipo: string
          fenotipo_raro: boolean
          frecuente_plaquetas: boolean
          grupo_sanguineo: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          meses_desde_ultima_donacion: number
          nombre_completo: string
          prioridad: number
          puede_contactarse: boolean
        }[]
      }
      fn_config: { Args: { p_clave: string }; Returns: string }
      fn_distancia_km: {
        Args: { p_lat1: number; p_lat2: number; p_lon1: number; p_lon2: number }
        Returns: number
      }
      fn_donante_disponible:
        | { Args: { p_ultima: string }; Returns: boolean }
        | { Args: { p_sexo: string; p_ultima: string }; Returns: boolean }
      fn_donante_puede_contactarse: {
        Args: { p_donante_id: string }
        Returns: boolean
      }
      fn_es_admin: { Args: never; Returns: boolean }
      fn_es_personal_activo: { Args: never; Returns: boolean }
      fn_fecha_proxima_donacion:
        | { Args: { p_ultima: string }; Returns: string }
        | { Args: { p_sexo: string; p_ultima: string }; Returns: string }
      fn_fenotipo_cumple: {
        Args: { p_donante: string; p_requerido: string }
        Returns: boolean
      }
      fn_fenotipo_tokens: { Args: { p_fenotipo: string }; Returns: string[] }
      fn_grupos_compatibles: {
        Args: {
          p_grupo_requerido: Database["public"]["Enums"]["grupo_sanguineo_enum"]
        }
        Returns: Database["public"]["Enums"]["grupo_sanguineo_enum"][]
      }
      fn_hook_limite_sesion: { Args: { event: Json }; Returns: Json }
      fn_hoy: { Args: never; Returns: string }
      fn_meses_desde: { Args: { p_fecha: string }; Returns: number }
      fn_meses_espera: { Args: { p_sexo: string }; Returns: number }
      fn_mfa_ok: { Args: never; Returns: boolean }
      fn_nombre_usuario: { Args: { p_id: string }; Returns: string }
      fn_normalizar_rut: { Args: { p_rut: string }; Returns: string }
      fn_puede_escribir: { Args: never; Returns: boolean }
      fn_registrar_donante: {
        Args: {
          p_acepta_cookies: boolean
          p_apellido: string
          p_autoriza_contacto: boolean
          p_correo?: string
          p_etiquetas?: string[]
          p_fecha_ultima_donacion: string
          p_fenotipo?: string
          p_fenotipo_raro?: boolean
          p_frecuente_plaquetas?: boolean
          p_grupo_sanguineo: Database["public"]["Enums"]["grupo_sanguineo_enum"]
          p_nombre: string
          p_observaciones?: string
          p_reaccion_adversa?: boolean
          p_rut: string
          p_sexo?: string
          p_telefono: string
          p_ubicacion?: string
        }
        Returns: string
      }
      fn_registrar_login: { Args: never; Returns: undefined }
      fn_rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      fn_rut_dv_valido: { Args: { p_rut: string }; Returns: boolean }
      fn_siguiente_codigo: {
        Args: { p_prefijo?: string; p_tipo: string }
        Returns: string
      }
      fn_texto_sin_acentos: { Args: { p_texto: string }; Returns: string }
    }
    Enums: {
      canal_contacto_enum: "telefono" | "correo" | "whatsapp"
      estado_solicitud_enum: "abierta" | "en_proceso" | "cerrada"
      grupo_sanguineo_enum:
        | "O+"
        | "O-"
        | "A+"
        | "A-"
        | "B+"
        | "B-"
        | "AB+"
        | "AB-"
      resultado_contacto_enum:
        | "enviado"
        | "confirmado"
        | "sin_respuesta"
        | "rechazado"
      rol_usuario: "administrador" | "tecnologo" | "tens"
      tipo_donacion_enum: "sangre_total" | "plaquetas"
      urgencia_enum: "alta" | "media" | "baja"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal_contacto_enum: ["telefono", "correo", "whatsapp"],
      estado_solicitud_enum: ["abierta", "en_proceso", "cerrada"],
      grupo_sanguineo_enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
      resultado_contacto_enum: [
        "enviado",
        "confirmado",
        "sin_respuesta",
        "rechazado",
      ],
      rol_usuario: ["administrador", "tecnologo", "tens"],
      tipo_donacion_enum: ["sangre_total", "plaquetas"],
      urgencia_enum: ["alta", "media", "baja"],
    },
  },
} as const
