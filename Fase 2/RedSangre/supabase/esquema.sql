/* =============================================================================
   RedSangre — Script completo de base de datos
   Clínica Indisa · Supabase (PostgreSQL 15+)
   Versión 1.4.0 · 2026-11-10

   CAMBIOS 1.4.0
     · Bitácora completa: auditoria guarda origen, nivel de sesión, IP y navegador; los triggers registran
       también borrados, etiquetas y configuración; fn_auditar (eventos de la app: sesión, navegación,
       consultas, llamadas y rechazos) y fn_auditar_admin (acciones de las Edge Functions); la bitácora
       no se puede modificar ni borrar.

   CAMBIOS 1.3.0
     · Perfil TENS de solo lectura: valor 'tens' en rol_usuario y función fn_puede_escribir.
       Las políticas de INSERT/UPDATE/DELETE usan fn_puede_escribir; las de lectura no cambian.

   CAMBIOS 1.2.0 (sincronizado con producción el 2026-11-09)
     · Regla de espera por sexo: columna donante.sexo, parámetro meses_entre_donaciones_mujer,
       fn_meses_espera y versiones con sexo de fn_fecha_proxima_donacion / fn_donante_disponible.
       fn_buscar_donantes_compatibles excluye a los donantes con reacción adversa previa.
     · Seguridad: fn_es_personal_activo exige sesión aal2 (código TOTP) a todo el personal;
       usuario.activo nace en false (solo crear-usuario activa la cuenta); hook
       fn_hook_limite_sesion (sesión máxima de 1 hora) solo ejecutable por supabase_auth_admin.
     · Índices antiguos de producción agregados para que una base nueva quede igual.

   PROPÓSITO
     Define en un solo archivo todo lo que necesita el backend de RedSangre:
     tipos, tablas, restricciones, funciones, triggers, vistas, seguridad
     (RLS + permisos) e índices. Implementa las reglas del ERS (RF-01..RF-37,
     RNF-02) y es coherente con los mockups de escritorio y móvil.

   CÓMO EJECUTARLO
     1. Supabase → SQL Editor → pegar el archivo completo → Run.
     2. Es RE-EJECUTABLE (idempotente): sobre una base vacía crea todo; sobre la
        base actual conserva los datos y solo agrega/ajusta lo que falta.
     3. Revisar la sección 0 (diagnóstico) antes de correrlo en la base existente.
     4. Tras ejecutarlo, seguir el checklist de la sección 16 (configuración del
        panel de Supabase que NO se puede hacer por SQL).

   CONVENCIONES
     tablas / columnas ... snake_case en español, singular (donante, solicitud)
     funciones ........... fn_<verbo>_<objeto>      triggers ... trg_<accion>_<tabla>
     vistas .............. v_<nombre>               índices .... idx_ / uq_
     constraints ......... ck_<tabla>_<regla>
     Toda función usa SET search_path = '' y nombres calificados (public.xxx)
     para evitar secuestro de search_path (buena práctica Supabase).

   CÓDIGOS DE ERROR PROPIOS (SQLSTATE) — el front puede ramificar por error.code
     RS001  Falta consentimiento obligatorio al registrar un donante   (RF-16/17)
     RS002  Donante sin autorización de contacto vigente               (ERS 3.4.2)
     RS003  Donante no disponible (regla de 3 meses) o ya asignado
     RS004  Donante incompatible con el grupo/fenotipo de la solicitud (RF-25)
     RS005  Solicitud cerrada: no admite cambios ni nuevos contactos
     RS006  Operación no permitida (campo protegido, último administrador, etc.)
     RS007  Dato inválido (RUT, fecha futura, campo obligatorio, etc.)   (RF-33)

   CONTENIDO
      0. Diagnóstico previo (solo lectura)
      1. Tipos enumerados
      2. Tablas de soporte (configuracion, secuencia_codigo, comuna)
      3. Tablas principales + columnas nuevas
      4. Restricciones (CHECK / UNIQUE)
      5. Funciones puras (utilidades sin acceso a tablas)
      6. Funciones de configuración y seguridad (helpers de RLS)
      7. Funciones de negocio (disponibilidad, compatibilidad, priorización, RPC)
      8. Funciones de trigger
      9. Triggers
     10. Vistas
     11. Seguridad: RLS y políticas
     12. Permisos (GRANT / REVOKE)
     13. Índices
     14. Datos base (configuración, comunas, correlativos)
     15. Documentación en el catálogo (COMMENT ON)
     16. Checklist posterior + pruebas de verificación (comentadas)
============================================================================= */


/* =============================================================================
   0. DIAGNÓSTICO PREVIO (opcional · solo lectura · ejecutar por separado)
   -----------------------------------------------------------------------------
   -- a) Triggers que existen hoy sobre auth.users (el script deja uno solo,
   --    trg_nuevo_usuario_auth, que es el nombre que ya usa el proyecto):
   --    SELECT tgname FROM pg_trigger
   --     WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
   -- b) Auth users sin perfil en public.usuario:
   --    SELECT au.id, au.email FROM auth.users au
   --     LEFT JOIN public.usuario u ON u.id = au.id WHERE u.id IS NULL;
   -- c) Estado de RLS por tabla:
   --    SELECT relname, relrowsecurity FROM pg_class
   --     WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
============================================================================= */


/* =============================================================================
   1. TIPOS ENUMERADOS
   Se crean solo si no existen. El ORDEN de los valores importa:
     · urgencia_enum  : alta < media < baja  → ORDER BY urgencia ASC deja la alta primero.
     · grupo_sanguineo: orden de visualización de los gráficos del dashboard.
============================================================================= */
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('rol_usuario',             ARRAY['administrador','tecnologo','tens']),   -- "Coordinador" se modela como administrador (ERS 2.3)
      ('grupo_sanguineo_enum',    ARRAY['O+','O-','A+','A-','B+','B-','AB+','AB-']),
      ('urgencia_enum',           ARRAY['alta','media','baja']),
      ('estado_solicitud_enum',   ARRAY['abierta','en_proceso','cerrada']),   -- RF-32
      ('canal_contacto_enum',     ARRAY['telefono','correo','whatsapp']),     -- RF-31
      ('resultado_contacto_enum', ARRAY['enviado','confirmado','sin_respuesta','rechazado']),
      ('tipo_donacion_enum',      ARRAY['sangre_total','plaquetas'])
    ) AS t(nombre, valores)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_type ty
                    WHERE ty.typname = r.nombre AND ty.typnamespace = 'public'::regnamespace) THEN
      EXECUTE format(
        'CREATE TYPE public.%I AS ENUM (%s)',
        r.nombre,
        (SELECT string_agg(quote_literal(v), ', ' ORDER BY i)
           FROM unnest(r.valores) WITH ORDINALITY AS u(v, i))
      );
    END IF;
  END LOOP;
END $$;

-- Comentarios - Perfil TENS solo lectura
-- Agrega el rol TENS en una base que ya tenía el enum creado (el bloque anterior solo crea tipos nuevos)
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'tens';


/* =============================================================================
   2. TABLAS DE SOPORTE
============================================================================= */

-- configuracion: parámetros de negocio editables por el administrador sin tocar código.
CREATE TABLE IF NOT EXISTS public.configuracion (
  clave       text        PRIMARY KEY,
  valor       text        NOT NULL,
  descripcion text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- secuencia_codigo: correlativo por tipo y año, para generar códigos legibles
-- (donante 2026004 · solicitud S2026002) que reinician cada año, como en los mockups.
CREATE TABLE IF NOT EXISTS public.secuencia_codigo (
  tipo         text    NOT NULL,
  anio         integer NOT NULL,
  ultimo_valor integer NOT NULL DEFAULT 0,
  CONSTRAINT secuencia_codigo_pkey PRIMARY KEY (tipo, anio),
  CONSTRAINT ck_secuencia_codigo_tipo CHECK (tipo IN ('donante', 'solicitud'))
);

-- comuna: centroide aproximado de cada comuna de la Región Metropolitana.
-- Permite calcular "cercanía" (RF-26) sin guardar la dirección exacta del donante
-- (minimización de datos, Ley 19.628 / 21.719).
CREATE TABLE IF NOT EXISTS public.comuna (
  nombre    text          PRIMARY KEY,
  provincia text          NOT NULL,
  latitud   numeric(9, 6) NOT NULL,
  longitud  numeric(9, 6) NOT NULL
);


/* =============================================================================
   3. TABLAS PRINCIPALES
   CREATE TABLE IF NOT EXISTS = definición completa para una base nueva.
   ALTER ... ADD COLUMN IF NOT EXISTS = actualiza una base ya existente.
============================================================================= */

-- usuario: perfil interno 1:1 con auth.users (rol, nombre, estado). RF-04..RF-07.
CREATE TABLE IF NOT EXISTS public.usuario (
  id                    uuid        NOT NULL,
  nombre                text        NOT NULL,
  apellido              text        NOT NULL,
  correo                text        NOT NULL,
  rol                   public.rol_usuario NOT NULL DEFAULT 'tecnologo',
  debe_cambiar_password boolean     NOT NULL DEFAULT true,   -- fuerza cambio en el primer login
  activo                boolean     NOT NULL DEFAULT false,  -- baja lógica: nunca se borran usuarios
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_pkey      PRIMARY KEY (id),
  CONSTRAINT usuario_correo_key UNIQUE (correo),
  CONSTRAINT usuario_id_fkey   FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);
-- Comentarios - Perfil nuevo inactivo
-- Una cuenta creada fuera de crear-usuario (por ejemplo, un registro público) no recibe permisos:
-- la Edge Function crear-usuario es la que deja activo = true al crear la cuenta.
ALTER TABLE public.usuario ALTER COLUMN activo SET DEFAULT false;

-- donante: ficha del donante (RF-08..RF-15).
CREATE TABLE IF NOT EXISTS public.donante (
  id                           uuid        NOT NULL DEFAULT gen_random_uuid(),
  codigo_donante               text,                          -- lo genera trg_codigo_donante
  rut                          text        NOT NULL,          -- se normaliza a 12345678-9
  nombre                       text        NOT NULL,
  apellido                     text        NOT NULL,
  correo                       text,
  telefono                     text,
  grupo_sanguineo              public.grupo_sanguineo_enum NOT NULL,
  fenotipo                     text,                          -- p.ej. "dCe/dce", "Kell(-)"
  fenotipo_raro                boolean     NOT NULL DEFAULT false,
  frecuente_plaquetas          boolean     NOT NULL DEFAULT false,
  fecha_ultima_donacion        date,
  ubicacion                    text,                          -- "Comuna, Ciudad" (p.ej. "Peñalolén, Santiago")
  observaciones                text,
  sincronizado_registro_global boolean     NOT NULL DEFAULT false,  -- reservado: registro global (fuera de alcance v1)
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donante_pkey              PRIMARY KEY (id),
  CONSTRAINT donante_codigo_donante_key UNIQUE (codigo_donante),
  CONSTRAINT donante_rut_key           UNIQUE (rut)
);
-- Columnas nuevas (la entrevista y el criterio de cercanía las requieren):
ALTER TABLE public.donante ADD COLUMN IF NOT EXISTS latitud                 numeric(9, 6);
ALTER TABLE public.donante ADD COLUMN IF NOT EXISTS longitud                numeric(9, 6);
ALTER TABLE public.donante ADD COLUMN IF NOT EXISTS reaccion_adversa_previa boolean NOT NULL DEFAULT false;
-- comuna: DERIVADA de "ubicacion" por trg_normalizar_donante (no la envía el front). Es la relación real
-- con el catálogo public.comuna; permite integridad referencial y estadísticas por comuna.
ALTER TABLE public.donante ADD COLUMN IF NOT EXISTS comuna text;
-- Comentarios - Regla de espera entre donaciones por sexo
-- Sexo del donante: define los meses de espera entre donaciones (fn_meses_espera). Opcional.
ALTER TABLE public.donante ADD COLUMN IF NOT EXISTS sexo text;

-- consentimiento: HISTORIAL append-only. La vista consentimiento_vigente expone el último. RF-16/17.
CREATE TABLE IF NOT EXISTS public.consentimiento (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
  donante_id              uuid        NOT NULL,
  acepta_cookies          boolean     NOT NULL,
  fecha_cookies           timestamptz,
  autoriza_contacto       boolean     NOT NULL,
  fecha_autoriza_contacto timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consentimiento_pkey            PRIMARY KEY (id),
  CONSTRAINT consentimiento_donante_id_fkey FOREIGN KEY (donante_id) REFERENCES public.donante (id)
);
ALTER TABLE public.consentimiento
  ADD COLUMN IF NOT EXISTS registrado_por uuid REFERENCES public.usuario (id) DEFAULT auth.uid();

-- etiqueta_donante: etiquetas libres (p.ej. "Altruista"). Las dos etiquetas de sistema
-- ("Fenotipo raro", "Plaquetas") salen de los flags booleanos de donante.
CREATE TABLE IF NOT EXISTS public.etiqueta_donante (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  donante_id uuid        NOT NULL,
  etiqueta   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT etiqueta_donante_pkey            PRIMARY KEY (id),
  CONSTRAINT etiqueta_donante_donante_id_fkey FOREIGN KEY (donante_id) REFERENCES public.donante (id)
);

-- solicitud: necesidad de sangre y su seguimiento (RF-24..RF-32).
CREATE TABLE IF NOT EXISTS public.solicitud (
  id                        uuid        NOT NULL DEFAULT gen_random_uuid(),
  codigo_solicitud          text,                               -- lo genera trg_codigo_solicitud (S2026002)
  grupo_sanguineo_requerido public.grupo_sanguineo_enum NOT NULL,
  fenotipo_requerido        text,                               -- p.ej. "dce/dce", "Kell(-)"
  urgencia                  public.urgencia_enum          NOT NULL DEFAULT 'media',
  estado                    public.estado_solicitud_enum  NOT NULL DEFAULT 'abierta',
  donante_asignado_id       uuid,
  creado_por                uuid        NOT NULL DEFAULT auth.uid(),
  fecha_agendada            timestamptz,
  reaccion                  text,                               -- respuesta del donante a ESTA solicitud ("Donación aceptada")
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solicitud_pkey                    PRIMARY KEY (id),
  CONSTRAINT solicitud_codigo_solicitud_key    UNIQUE (codigo_solicitud),
  CONSTRAINT solicitud_donante_asignado_id_fkey FOREIGN KEY (donante_asignado_id) REFERENCES public.donante (id),
  CONSTRAINT solicitud_creado_por_fkey         FOREIGN KEY (creado_por) REFERENCES public.usuario (id)
);
ALTER TABLE public.solicitud ADD COLUMN IF NOT EXISTS fecha_cierre timestamptz;  -- mide el KPI del proyecto (tiempo de resolución)
-- Número que el banco de sangre asigna en su sistema clínico para trazabilidad (entrevista, pregunta 12).
-- Opcional: RedSangre no reemplaza ni integra e-Delphyn/Tecnigen, solo permite referenciarlos.
ALTER TABLE public.solicitud ADD COLUMN IF NOT EXISTS numero_externo text;
ALTER TABLE public.solicitud ALTER COLUMN creado_por SET DEFAULT auth.uid();     -- el front ya no necesita enviarlo (ni puede falsearlo)

-- seguimiento_contacto: bitácora de intentos de contacto (RF-31).
CREATE TABLE IF NOT EXISTS public.seguimiento_contacto (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  solicitud_id   uuid        NOT NULL,
  donante_id     uuid        NOT NULL,
  canal          public.canal_contacto_enum     NOT NULL,
  resultado      public.resultado_contacto_enum NOT NULL DEFAULT 'enviado',
  observaciones  text,
  registrado_por uuid        NOT NULL DEFAULT auth.uid(),
  fecha          timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seguimiento_contacto_pkey              PRIMARY KEY (id),
  CONSTRAINT seguimiento_contacto_solicitud_id_fkey FOREIGN KEY (solicitud_id)   REFERENCES public.solicitud (id),
  CONSTRAINT seguimiento_contacto_donante_id_fkey   FOREIGN KEY (donante_id)     REFERENCES public.donante (id),
  CONSTRAINT seguimiento_contacto_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuario (id)
);
ALTER TABLE public.seguimiento_contacto ALTER COLUMN registrado_por SET DEFAULT auth.uid();

-- donacion: HISTORIAL de donaciones realizadas (APPEND-ONLY). Cada fila actualiza la fecha de última
-- donación del donante (trg_aplicar_donacion), de modo que la regla de 3 meses (RF-18) nunca quede
-- desfasada. Permite seguimiento de donaciones, análisis histórico y registrar reacciones.
-- solicitud_id es opcional: una donación puede ser espontánea (sin solicitud).
CREATE TABLE IF NOT EXISTS public.donacion (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  donante_id      uuid        NOT NULL,
  solicitud_id    uuid,
  fecha_donacion  date        NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Santiago')::date),
  tipo            public.tipo_donacion_enum NOT NULL DEFAULT 'sangre_total',
  hubo_reaccion   boolean     NOT NULL DEFAULT false,
  detalle_reaccion text,                                  -- dato de salud: no se copia a la auditoría
  registrado_por  uuid        DEFAULT auth.uid(),         -- NULL = carga inicial / migración
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donacion_pkey              PRIMARY KEY (id),
  CONSTRAINT donacion_donante_id_fkey   FOREIGN KEY (donante_id)     REFERENCES public.donante (id),
  CONSTRAINT donacion_solicitud_id_fkey FOREIGN KEY (solicitud_id)   REFERENCES public.solicitud (id),
  CONSTRAINT donacion_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuario (id)
);

-- auditoria: bitácora de accesos y operaciones críticas (RNF-02). Append-only e inalterable.
CREATE TABLE IF NOT EXISTS public.auditoria (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid,
  accion         text        NOT NULL,   -- CREAR | EDITAR | CAMBIAR_ESTADO | ELIMINAR | eventos de fn_auditar / fn_auditar_admin
  tabla_afectada text,
  registro_id    uuid,
  registro_clave text,                   -- registros sin uuid (configuracion.clave)
  detalle        jsonb,
  origen         text,                   -- app | edge_function | auth | sql
  aal            text,                   -- nivel de la sesión (aal1 / aal2)
  ip             inet,
  user_agent     text,
  fecha          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_pkey           PRIMARY KEY (id),
  CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario (id)
);
-- Comentarios - Bitácora completa
-- Columnas de contexto para una base que ya tenía la tabla: desde dónde y en qué condiciones ocurrió cada evento
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS registro_clave text;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS origen         text;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS aal            text;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS ip             inet;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS user_agent     text;


/* =============================================================================
   4. RESTRICCIONES
   Patrón: DROP IF EXISTS + ADD ... NOT VALID.
     · NOT VALID = se exige a las filas NUEVAS/modificadas sin bloquear por datos
       históricos. Cuando los datos estén limpios: ALTER TABLE ... VALIDATE CONSTRAINT <nombre>;
============================================================================= */

-- usuario
ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS ck_usuario_correo_formato;
ALTER TABLE public.usuario ADD  CONSTRAINT ck_usuario_correo_formato
  CHECK (correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID;
-- Opcional (producción): exigir dominio institucional. Descomentar si corresponde:
-- ALTER TABLE public.usuario ADD CONSTRAINT ck_usuario_correo_dominio CHECK (correo LIKE '%@indisa.cl') NOT VALID;
ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS ck_usuario_nombre_no_vacio;
ALTER TABLE public.usuario ADD  CONSTRAINT ck_usuario_nombre_no_vacio
  CHECK (btrim(nombre) <> '' AND btrim(apellido) <> '') NOT VALID;

-- donante
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS ck_donante_rut_formato;
ALTER TABLE public.donante ADD  CONSTRAINT ck_donante_rut_formato
  CHECK (rut ~ '^[0-9]{7,8}-[0-9k]$') NOT VALID;                      -- ya normalizado por trigger
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS ck_donante_correo_formato;
ALTER TABLE public.donante ADD  CONSTRAINT ck_donante_correo_formato
  CHECK (correo IS NULL OR correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID;
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS ck_donante_telefono_formato;
ALTER TABLE public.donante ADD  CONSTRAINT ck_donante_telefono_formato
  CHECK (telefono IS NULL OR telefono ~ '^\+?[0-9][0-9 ]{7,17}$') NOT VALID;   -- "+56 9 1234 5678"
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS ck_donante_nombre_no_vacio;
ALTER TABLE public.donante ADD  CONSTRAINT ck_donante_nombre_no_vacio
  CHECK (btrim(nombre) <> '' AND btrim(apellido) <> '') NOT VALID;
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS ck_donante_raro_requiere_fenotipo;
ALTER TABLE public.donante ADD  CONSTRAINT ck_donante_raro_requiere_fenotipo
  CHECK (NOT fenotipo_raro OR fenotipo IS NOT NULL) NOT VALID;       -- un "fenotipo raro" debe indicar cuál es
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS donante_comuna_fkey;
ALTER TABLE public.donante ADD  CONSTRAINT donante_comuna_fkey
  FOREIGN KEY (comuna) REFERENCES public.comuna (nombre) ON UPDATE CASCADE ON DELETE SET NULL;
-- Comentarios - Regla de espera entre donaciones por sexo
-- Solo se aceptan los valores que ofrece el formulario.
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS donante_sexo_check;
ALTER TABLE public.donante ADD  CONSTRAINT donante_sexo_check
  CHECK (sexo IS NULL OR sexo = ANY (ARRAY['Femenino', 'Masculino', 'No especifica']));
ALTER TABLE public.donante DROP CONSTRAINT IF EXISTS ck_donante_coordenadas;
ALTER TABLE public.donante ADD  CONSTRAINT ck_donante_coordenadas
  CHECK ((latitud IS NULL) = (longitud IS NULL)
         AND (latitud  IS NULL OR latitud  BETWEEN -90  AND 90)
         AND (longitud IS NULL OR longitud BETWEEN -180 AND 180)) NOT VALID;

-- consentimiento
ALTER TABLE public.consentimiento DROP CONSTRAINT IF EXISTS ck_consentimiento_fechas;
ALTER TABLE public.consentimiento ADD  CONSTRAINT ck_consentimiento_fechas
  CHECK (fecha_cookies IS NOT NULL AND fecha_autoriza_contacto IS NOT NULL) NOT VALID;  -- trigger las completa

-- etiqueta_donante: sin duplicados (ignorando mayúsculas) y con largo razonable.
ALTER TABLE public.etiqueta_donante DROP CONSTRAINT IF EXISTS ck_etiqueta_largo;
ALTER TABLE public.etiqueta_donante ADD  CONSTRAINT ck_etiqueta_largo
  CHECK (length(btrim(etiqueta)) BETWEEN 1 AND 50) NOT VALID;
-- Limpieza previa de duplicados (conserva el más antiguo) para poder crear el índice único:
DELETE FROM public.etiqueta_donante e
 USING public.etiqueta_donante o
 WHERE e.donante_id = o.donante_id
   AND lower(btrim(e.etiqueta)) = lower(btrim(o.etiqueta))
   AND (e.created_at, e.id) > (o.created_at, o.id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_etiqueta_donante_unica
  ON public.etiqueta_donante (donante_id, lower(btrim(etiqueta)));

-- solicitud: estado y fecha de cierre siempre consistentes (los mantiene el trigger).
ALTER TABLE public.solicitud DROP CONSTRAINT IF EXISTS ck_solicitud_cierre;
ALTER TABLE public.solicitud ADD  CONSTRAINT ck_solicitud_cierre
  CHECK ((estado = 'cerrada') = (fecha_cierre IS NOT NULL)) NOT VALID;

-- donacion: el detalle de una reacción solo existe si hubo reacción (el trigger lo marca solo).
ALTER TABLE public.donacion DROP CONSTRAINT IF EXISTS ck_donacion_reaccion;
ALTER TABLE public.donacion ADD  CONSTRAINT ck_donacion_reaccion
  CHECK (hubo_reaccion OR detalle_reaccion IS NULL) NOT VALID;


/* =============================================================================
   5. FUNCIONES PURAS (no leen tablas; IMMUTABLE → deterministas y reutilizables)
============================================================================= */

-- fn_texto_sin_acentos(texto) → texto
--   Qué hace : minúsculas, sin espacios extremos y sin tildes ("Peñalolén" → "penalolen").
--   Usado por: trg_normalizar_donante para emparejar la ubicación con la tabla comuna.
CREATE OR REPLACE FUNCTION public.fn_texto_sin_acentos(p_texto text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = ''
AS $$
  SELECT translate(lower(btrim(p_texto)), 'áéíóúüñ', 'aeiouun');
$$;

-- fn_normalizar_rut(rut) → rut
--   Qué hace : deja el RUT en formato canónico sin puntos y con guion y dígito
--              verificador en minúscula: "16.804.733-K" → "16804733-k".
--   Por qué  : el mockup muestra RUT con puntos; en BD se guarda un único formato para que
--              la restricción UNIQUE detecte duplicados sin importar cómo se tipeó.
CREATE OR REPLACE FUNCTION public.fn_normalizar_rut(p_rut text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = ''
AS $$
  SELECT CASE WHEN length(s.v) < 2 THEN s.v
              ELSE left(s.v, -1) || '-' || right(s.v, 1) END
    FROM (SELECT regexp_replace(lower(btrim(p_rut)), '[^0-9k]', '', 'g') AS v) s;
$$;

-- fn_rut_dv_valido(rut_normalizado) → boolean
--   Qué hace : verifica el dígito verificador con el algoritmo módulo 11.
--   Nota     : solo se aplica si configuracion.validar_dv_rut = 'true' (los datos
--              simulados y los mockups usan RUT que no cumplen el módulo 11).
CREATE OR REPLACE FUNCTION public.fn_rut_dv_valido(p_rut text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = ''
AS $$
DECLARE
  v_num      text := split_part(p_rut, '-', 1);
  v_dv       text := split_part(p_rut, '-', 2);
  v_suma     integer := 0;
  v_mult     integer := 2;
  v_resto    integer;
  v_esperado text;
BEGIN
  IF v_num !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;
  FOR i IN REVERSE length(v_num)..1 LOOP
    v_suma := v_suma + substr(v_num, i, 1)::integer * v_mult;
    v_mult := CASE WHEN v_mult = 7 THEN 2 ELSE v_mult + 1 END;
  END LOOP;
  v_resto := 11 - (v_suma % 11);
  v_esperado := CASE v_resto WHEN 11 THEN '0' WHEN 10 THEN 'k' ELSE v_resto::text END;
  RETURN v_dv = v_esperado;
END $$;

-- fn_fenotipo_tokens(texto) → text[]
--   Qué hace : descompone un fenotipo en "componentes" comparables.
--              Separa por coma o punto y coma, quita espacios y, dentro de cada
--              componente con "/", ordena los haplotipos ("dce/dCe" = "dCe/dce").
--              Se respeta mayúscula/minúscula porque en la notación Rh/Kell tiene
--              significado clínico (D ≠ d, K ≠ k).
--   Ejemplo  : 'dCe/dce, Kell(-)'  →  {Kell(-),dCe/dce}
CREATE OR REPLACE FUNCTION public.fn_fenotipo_tokens(p_fenotipo text)
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.tok), ARRAY[]::text[])
    FROM (
      SELECT CASE
               WHEN strpos(t.parte, '/') > 0 THEN
                 (SELECT string_agg(h, '/' ORDER BY h COLLATE "C")
                    FROM unnest(string_to_array(t.parte, '/')) AS h)
               ELSE t.parte
             END AS tok
        FROM (
          SELECT regexp_replace(btrim(p), '\s+', '', 'g') AS parte
            FROM unnest(regexp_split_to_array(COALESCE(p_fenotipo, ''), '[,;]+')) AS p
        ) t
       WHERE t.parte <> ''
    ) x;
$$;

-- fn_fenotipo_cumple(fenotipo_donante, fenotipo_requerido) → boolean
--   Qué hace : TRUE si el donante tiene TODOS los componentes que pide la solicitud.
--              Si la solicitud no pide fenotipo, cualquier donante cumple.
--   Usado por: búsqueda de candidatos (RF-25) y validación al asignar (trg_validar_solicitud),
--              por lo que ambos siempre coinciden.
CREATE OR REPLACE FUNCTION public.fn_fenotipo_cumple(p_donante text, p_requerido text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT cardinality(public.fn_fenotipo_tokens(p_requerido)) = 0
      OR public.fn_fenotipo_tokens(p_donante) @> public.fn_fenotipo_tokens(p_requerido);
$$;

-- fn_distancia_km(lat1, lon1, lat2, lon2) → km (1 decimal)
--   Qué hace : distancia en línea recta (fórmula de Haversine). NULL si falta algún dato.
CREATE OR REPLACE FUNCTION public.fn_distancia_km(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT CASE
           WHEN p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN NULL
           ELSE round((6371 * 2 * asin(least(1, sqrt(
                  power(sin(radians((p_lat2 - p_lat1) / 2)), 2)
                  + cos(radians(p_lat1)) * cos(radians(p_lat2))
                    * power(sin(radians((p_lon2 - p_lon1) / 2)), 2)
                ))))::numeric, 1)
         END;
$$;

-- fn_grupos_compatibles(grupo_requerido) → grupo_sanguineo_enum[]
--   Qué hace : grupos de DONANTE cuyos glóbulos rojos pueden recibirse en un paciente
--              del grupo indicado (compatibilidad ABO/Rh estándar). El primer elemento
--              del arreglo es siempre el grupo idéntico.
--   Ejemplo  : fn_grupos_compatibles('A+') → {A+,A-,O+,O-}
CREATE OR REPLACE FUNCTION public.fn_grupos_compatibles(p_grupo_requerido public.grupo_sanguineo_enum)
RETURNS public.grupo_sanguineo_enum[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$
  SELECT (CASE p_grupo_requerido
            WHEN 'O-'  THEN ARRAY['O-']
            WHEN 'O+'  THEN ARRAY['O+','O-']
            WHEN 'A-'  THEN ARRAY['A-','O-']
            WHEN 'A+'  THEN ARRAY['A+','A-','O+','O-']
            WHEN 'B-'  THEN ARRAY['B-','O-']
            WHEN 'B+'  THEN ARRAY['B+','B-','O+','O-']
            WHEN 'AB-' THEN ARRAY['AB-','A-','B-','O-']
            WHEN 'AB+' THEN ARRAY['AB+','AB-','A+','A-','B+','B-','O+','O-']
          END)::public.grupo_sanguineo_enum[];
$$;


/* =============================================================================
   6. FUNCIONES DE CONFIGURACIÓN Y SEGURIDAD (helpers usados por RLS y triggers)
============================================================================= */

-- fn_config(clave) → texto
--   Qué hace : lee un parámetro de public.configuracion. SECURITY DEFINER para que
--              funcione aunque el llamador no tenga acceso directo a la tabla.
CREATE OR REPLACE FUNCTION public.fn_config(p_clave text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.valor FROM public.configuracion c WHERE c.clave = p_clave;
$$;

-- fn_hoy() → date
--   Qué hace : fecha de HOY en hora de Chile. Evita que, de noche, el servidor (UTC)
--              ya esté "en mañana" y la regla de 3 meses falle por un día.
CREATE OR REPLACE FUNCTION public.fn_hoy()
RETURNS date
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT (now() AT TIME ZONE 'America/Santiago')::date;
$$;

-- fn_rol_actual() → rol_usuario
--   Qué hace : rol del usuario autenticado, o NULL si no tiene perfil o está inactivo.
--              Un usuario desactivado pierde TODOS sus permisos al instante (RLS lo usa).
CREATE OR REPLACE FUNCTION public.fn_rol_actual()
RETURNS public.rol_usuario
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.rol FROM public.usuario u WHERE u.id = (SELECT auth.uid()) AND u.activo;
$$;

-- fn_mfa_ok() → boolean
--   Qué hace : si configuracion.exigir_mfa_admin = 'true', exige que el JWT tenga
--              nivel de aseguramiento aal2 (el usuario completó el TOTP). RNF-02: MFA
--              obligatoria para el administrador. El front ya implementa TOTP: en
--              producción debe estar en 'true'.
CREATE OR REPLACE FUNCTION public.fn_mfa_ok()
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT COALESCE(public.fn_config('exigir_mfa_admin'), 'false') <> 'true'
      OR (SELECT auth.jwt() ->> 'aal') = 'aal2';
$$;

-- fn_es_personal_activo() → boolean   (cualquier rol activo: administrador, tecnólogo o TENS)
-- Comentarios - Segundo factor TOTP para todo el personal
-- La base exige que la sesión haya completado el código TOTP (aal2), no solo la interfaz
CREATE OR REPLACE FUNCTION public.fn_es_personal_activo()
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT public.fn_rol_actual() IS NOT NULL
     AND (SELECT auth.jwt() ->> 'aal') = 'aal2';
$$;

-- fn_puede_escribir() → boolean   (personal activo con permiso de escritura)
-- Comentarios - Perfil TENS solo lectura
-- Solo administrador y tecnólogo pueden crear, editar o borrar; TENS y cualquier rol futuro quedan en solo lectura.
-- Se usa una lista de roles permitidos (sin nombrar 'tens') para poder crearla junto con el nuevo valor del enum.
CREATE OR REPLACE FUNCTION public.fn_puede_escribir()
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT public.fn_es_personal_activo()
     AND public.fn_rol_actual() IN ('administrador', 'tecnologo');
$$;

-- fn_es_admin() → boolean   (administrador activo y, si se exige, con MFA)
CREATE OR REPLACE FUNCTION public.fn_es_admin()
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT public.fn_rol_actual() = 'administrador' AND public.fn_mfa_ok();
$$;

-- fn_nombre_usuario(id) → texto   ("nombre apellido", solo para personal activo)
--   Qué hace : expone únicamente el nombre de un usuario. La tabla usuario solo la lee el
--              administrador (o cada uno su fila), pero el personal necesita ver "Creada por"
--              y "Registrada por" en las vistas de solicitudes y donaciones.
CREATE OR REPLACE FUNCTION public.fn_nombre_usuario(p_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.nombre || ' ' || u.apellido
    FROM public.usuario u
   WHERE u.id = p_id AND (SELECT public.fn_es_personal_activo());
$$;

-- Comentarios - Límite de sesión de 1 hora
-- Hook "Customize Access Token" de Supabase Auth: rechaza la renovación del token cuando la sesión
-- tiene más de 1 hora. Lo ejecuta solo supabase_auth_admin (permisos en la sección 12).
CREATE OR REPLACE FUNCTION public.fn_hook_limite_sesion(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v_session_id uuid := nullif(event -> 'claims' ->> 'session_id', '')::uuid;
  v_creada     timestamptz;
BEGIN
  IF v_session_id IS NULL THEN
    RETURN event;
  END IF;

  SELECT s.created_at INTO v_creada
  FROM auth.sessions s
  WHERE s.id = v_session_id;

  IF v_creada IS NOT NULL AND v_creada < now() - interval '1 hour' THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'La sesión expiró. Vuelve a iniciar sesión.'
    ));
  END IF;

  RETURN event;
END $$;


/* =============================================================================
   7. FUNCIONES DE NEGOCIO
============================================================================= */

-- Se eliminan TODAS las sobrecargas previas de fn_buscar_donantes_compatibles: su firma
-- cambia (nuevos parámetros / columnas de salida) y CREATE OR REPLACE no puede
-- modificar el tipo de retorno de una función existente.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS firma
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'fn_buscar_donantes_compatibles'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.firma;
  END LOOP;
END $$;

-- fn_meses_desde(fecha) → integer
--   Qué hace : meses completos transcurridos desde una fecha (para "hace 4 meses").
CREATE OR REPLACE FUNCTION public.fn_meses_desde(p_fecha date)
RETURNS integer
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT CASE WHEN p_fecha IS NULL THEN NULL
              ELSE (extract(year  FROM age(public.fn_hoy(), p_fecha)) * 12
                  + extract(month FROM age(public.fn_hoy(), p_fecha)))::integer END;
$$;

-- fn_fecha_proxima_donacion(ultima_donacion) → date
--   Qué hace : primer día en que el donante puede volver a donar
--              (última donación + meses_entre_donaciones, 3 por defecto). RF-18.
CREATE OR REPLACE FUNCTION public.fn_fecha_proxima_donacion(p_ultima date)
RETURNS date
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT (p_ultima + make_interval(months => COALESCE(NULLIF(public.fn_config('meses_entre_donaciones'), '')::integer, 3)))::date;
$$;

-- fn_donante_disponible(ultima_donacion) → boolean
--   Qué hace : regla de los 3 meses (RF-18/RF-21/RF-27). Sin donación registrada se
--              considera disponible (no hay restricción conocida).
CREATE OR REPLACE FUNCTION public.fn_donante_disponible(p_ultima date)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT p_ultima IS NULL OR public.fn_fecha_proxima_donacion(p_ultima) <= public.fn_hoy();
$$;

-- Comentarios - Regla de espera entre donaciones por sexo
-- Meses de espera según el sexo: mujeres y "No especifica" usan meses_entre_donaciones_mujer (4),
-- el resto meses_entre_donaciones (3). Sin sexo registrado se aplica la regla general.
CREATE OR REPLACE FUNCTION public.fn_meses_espera(p_sexo text)
RETURNS integer
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT CASE
           WHEN p_sexo IN ('Femenino', 'No especifica')
             THEN COALESCE(NULLIF(public.fn_config('meses_entre_donaciones_mujer'), '')::integer, 4)
           ELSE COALESCE(NULLIF(public.fn_config('meses_entre_donaciones'), '')::integer, 3)
         END;
$$;

-- Comentarios - Regla de espera entre donaciones por sexo
-- Versiones con sexo de la próxima fecha de donación y de la disponibilidad. Las de un solo
-- parámetro se conservan porque el front las llama cuando el donante no tiene sexo registrado.
CREATE OR REPLACE FUNCTION public.fn_fecha_proxima_donacion(p_ultima date, p_sexo text)
RETURNS date
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT (p_ultima + make_interval(months => public.fn_meses_espera(p_sexo)))::date;
$$;

CREATE OR REPLACE FUNCTION public.fn_donante_disponible(p_ultima date, p_sexo text)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT p_ultima IS NULL OR public.fn_fecha_proxima_donacion(p_ultima, p_sexo) <= public.fn_hoy();
$$;

-- fn_donante_puede_contactarse(donante_id) → boolean
--   Qué hace : TRUE si el consentimiento VIGENTE (el más reciente) autoriza el contacto.
--              Sin consentimiento registrado devuelve FALSE (ERS 3.4.2).
CREATE OR REPLACE FUNCTION public.fn_donante_puede_contactarse(p_donante_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT COALESCE((SELECT c.autoriza_contacto
                     FROM public.consentimiento c
                    WHERE c.donante_id = p_donante_id
                    ORDER BY c.created_at DESC, c.id DESC
                    LIMIT 1), false);
$$;

-- fn_buscar_donantes_compatibles(grupo, fenotipo, limite) → tabla priorizada   RF-25 / RF-26 / RF-27
--   Qué hace : devuelve los candidatos compatibles con la solicitud, ya ordenados.
--   Filtros  : (1) grupo del donante ∈ fn_grupos_compatibles(grupo requerido)
--              (2) si se pide fenotipo, el donante lo cumple (fn_fenotipo_cumple)
--   Orden de prioridad (criterios del ERS: compatibilidad, disponibilidad, cercanía):
--              1º  APTOS (disponible 3 meses + autoriza contacto + no asignado a otra solicitud)
--              2º  grupo idéntico antes que compatible (se cuida al donante universal O-)
--              3º  menor distancia a la clínica (sin ubicación → al final)
--              4º  quien lleva más tiempo sin donar
--   Seguridad: SECURITY INVOKER → aplica RLS; solo personal activo obtiene filas.
--   Ejemplo  : SELECT * FROM public.fn_buscar_donantes_compatibles('O-', 'dce/dce', 10);
CREATE FUNCTION public.fn_buscar_donantes_compatibles(
  p_grupo_requerido    public.grupo_sanguineo_enum,
  p_fenotipo_requerido text    DEFAULT NULL,
  p_limite             integer DEFAULT 20
)
RETURNS TABLE (
  prioridad                   integer,
  donante_id                  uuid,
  codigo_donante              text,
  nombre_completo             text,
  grupo_sanguineo             public.grupo_sanguineo_enum,
  fenotipo                    text,
  fenotipo_raro               boolean,
  frecuente_plaquetas         boolean,
  fecha_ultima_donacion       date,
  meses_desde_ultima_donacion integer,
  disponible                  boolean,   -- cumple la regla de 3 meses (badge "Disponible / No disponible")
  puede_contactarse           boolean,   -- consentimiento de contacto vigente
  asignado_activo             boolean,   -- ya está asignado a otra solicitud abierta/en proceso
  apto                        boolean,   -- disponible AND puede_contactarse AND NOT asignado_activo
  distancia_km                numeric,
  compatibilidad              text       -- 'exacta' | 'compatible'
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  -- RENDIMIENTO (RNF-01: búsqueda ≤ 3 s con 5.000 donantes). Medido: ~0,05–0,2 s.
  --   · cfg  : parámetros, fecha de hoy y fenotipo requerido se calculan UNA vez (no por fila).
  --   · La regla de disponibilidad se evalúa en línea con esos parámetros: es la misma regla de
  --     fn_donante_disponible(), solo que sin releer la configuración por cada donante.
  --   · fn_meses_desde() se aplica únicamente a las filas finales (como máximo 100).
  WITH cfg AS (
    SELECT public.fn_config('sede_latitud')::double precision  AS lat,
           public.fn_config('sede_longitud')::double precision AS lon,
           COALESCE(NULLIF(public.fn_config('meses_entre_donaciones'), '')::integer, 3) AS meses,
           COALESCE(NULLIF(public.fn_config('meses_entre_donaciones_mujer'), '')::integer, 4) AS meses_mujer,
           public.fn_hoy()                                     AS hoy,
           public.fn_fenotipo_tokens(p_fenotipo_requerido)     AS req
  ),
  candidatos AS (
    SELECT d.id, d.codigo_donante, d.nombre, d.apellido, d.grupo_sanguineo, d.fenotipo,
           d.fenotipo_raro, d.frecuente_plaquetas, d.fecha_ultima_donacion,
           (d.fecha_ultima_donacion IS NULL
            OR (d.fecha_ultima_donacion + make_interval(months => CASE WHEN d.sexo IN ('Femenino', 'No especifica')
                                                                  THEN cfg.meses_mujer ELSE cfg.meses END))::date <= cfg.hoy) AS disponible,
           COALESCE(cv.autoriza_contacto, false)                              AS puede_contactarse,
           EXISTS (SELECT 1 FROM public.solicitud so
                    WHERE so.donante_asignado_id = d.id AND so.estado <> 'cerrada') AS asignado_activo,
           public.fn_distancia_km(cfg.lat, cfg.lon,
                                  d.latitud::double precision, d.longitud::double precision) AS distancia_km,
           (d.grupo_sanguineo = p_grupo_requerido)                            AS coincide_exacto
      FROM public.donante d
      CROSS JOIN cfg
      LEFT JOIN LATERAL (
        SELECT c.autoriza_contacto
          FROM public.consentimiento c
         WHERE c.donante_id = d.id
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT 1
      ) cv ON true
     WHERE d.grupo_sanguineo = ANY (public.fn_grupos_compatibles(p_grupo_requerido))
       AND NOT d.reaccion_adversa_previa   -- donante bloqueado por reacción adversa: nunca es candidato
       AND (cardinality(cfg.req) = 0 OR public.fn_fenotipo_tokens(d.fenotipo) @> cfg.req)
  ),
  ordenados AS (
    SELECT c.*,
           row_number() OVER (
             ORDER BY (c.disponible AND c.puede_contactarse AND NOT c.asignado_activo) DESC,
                      c.coincide_exacto DESC,
                      c.distancia_km ASC NULLS LAST,
                      c.fecha_ultima_donacion ASC NULLS LAST,
                      c.codigo_donante) AS rn
      FROM candidatos c
  ),
  finales AS (
    SELECT o.*
      FROM ordenados o
     ORDER BY o.rn
     LIMIT LEAST(GREATEST(COALESCE(p_limite, 20), 1), 100)
  )
  SELECT f.rn::integer,
         f.id,
         f.codigo_donante,
         f.nombre || ' ' || f.apellido,
         f.grupo_sanguineo,
         f.fenotipo,
         f.fenotipo_raro,
         f.frecuente_plaquetas,
         f.fecha_ultima_donacion,
         public.fn_meses_desde(f.fecha_ultima_donacion),
         f.disponible,
         f.puede_contactarse,
         f.asignado_activo,
         (f.disponible AND f.puede_contactarse AND NOT f.asignado_activo),
         f.distancia_km,
         CASE WHEN f.coincide_exacto THEN 'exacta' ELSE 'compatible' END
    FROM finales f
   ORDER BY f.rn;
$$;

-- fn_registrar_donante(...) → uuid   RPC · RF-08, RF-16, RF-17, RF-33
--   Qué hace : registra donante + consentimiento + etiquetas EN UNA SOLA TRANSACCIÓN.
--              Es la forma de garantizar que NO existe un donante sin consentimiento
--              (con inserts separados desde el front no se puede asegurar atomicidad).
--   Reglas   : obligatorios nombre, apellido, rut, grupo, teléfono, fecha última donación
--              y AMBOS consentimientos en true (si no → RS001 / RS007).
--   Seguridad: SECURITY INVOKER → pasa por RLS y por los triggers de validación/auditoría.
--   Uso (supabase-js): supabase.rpc('fn_registrar_donante', { p_nombre: 'María', ... })
-- Comentarios - Regla de espera entre donaciones por sexo
-- Se elimina la versión anterior sin p_sexo: si quedaran las dos, PostgREST no sabría cuál llamar.
DROP FUNCTION IF EXISTS public.fn_registrar_donante(text, text, text, public.grupo_sanguineo_enum, text, date,
  boolean, boolean, text, text, text, text, boolean, boolean, boolean, text[]);
CREATE OR REPLACE FUNCTION public.fn_registrar_donante(
  p_nombre                text,
  p_apellido              text,
  p_rut                   text,
  p_grupo_sanguineo       public.grupo_sanguineo_enum,
  p_telefono              text,
  p_fecha_ultima_donacion date,
  p_acepta_cookies        boolean,
  p_autoriza_contacto     boolean,
  p_correo                text    DEFAULT NULL,
  p_fenotipo              text    DEFAULT NULL,
  p_ubicacion             text    DEFAULT NULL,
  p_observaciones         text    DEFAULT NULL,
  p_fenotipo_raro         boolean DEFAULT false,
  p_frecuente_plaquetas   boolean DEFAULT false,
  p_reaccion_adversa      boolean DEFAULT false,
  p_etiquetas             text[]  DEFAULT ARRAY[]::text[],
  p_sexo                  text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Comentarios - Perfil TENS solo lectura
  -- El alta de donantes exige permiso de escritura: TENS no puede registrar donantes
  IF NOT public.fn_puede_escribir() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(btrim(p_nombre), '') = '' OR COALESCE(btrim(p_apellido), '') = ''
     OR COALESCE(btrim(p_rut), '') = '' OR COALESCE(btrim(p_telefono), '') = ''
     OR p_fecha_ultima_donacion IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios: nombre, apellido, RUT, teléfono y fecha de última donación'
      USING ERRCODE = 'RS007';
  END IF;

  IF NOT (COALESCE(p_acepta_cookies, false) AND COALESCE(p_autoriza_contacto, false)) THEN
    RAISE EXCEPTION 'Debe registrarse el consentimiento de cookies/tratamiento de datos y la autorización de contacto'
      USING ERRCODE = 'RS001';
  END IF;

  INSERT INTO public.donante (
    rut, nombre, apellido, correo, telefono, grupo_sanguineo, fenotipo, fenotipo_raro,
    frecuente_plaquetas, fecha_ultima_donacion, ubicacion, observaciones, reaccion_adversa_previa, sexo)
  VALUES (
    p_rut, p_nombre, p_apellido, p_correo, p_telefono, p_grupo_sanguineo, p_fenotipo,
    COALESCE(p_fenotipo_raro, false), COALESCE(p_frecuente_plaquetas, false),
    p_fecha_ultima_donacion, p_ubicacion, p_observaciones, COALESCE(p_reaccion_adversa, false), p_sexo)
  RETURNING id INTO v_id;

  INSERT INTO public.consentimiento (donante_id, acepta_cookies, autoriza_contacto)
  VALUES (v_id, true, true);   -- las fechas las completa trg_validar_consentimiento

  INSERT INTO public.etiqueta_donante (donante_id, etiqueta)
  SELECT v_id, btrim(e)
    FROM unnest(COALESCE(p_etiquetas, ARRAY[]::text[])) AS e
   WHERE btrim(e) <> ''
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END $$;

-- Comentarios - Bitácora completa
-- Única puerta de escritura en auditoria: agrega el contexto de cada evento (origen, nivel de sesión, IP y
-- navegador). Es interna: la usan los triggers, fn_auditar y fn_auditar_admin; nadie la llama por la API.
-- El origen sale del rol de la petición: la app (authenticated), una Edge Function (service_role),
-- Supabase Auth (supabase_auth_admin) o el SQL Editor / un script (sin rol de API).
CREATE OR REPLACE FUNCTION public.fn_insertar_auditoria(
  p_usuario    uuid,
  p_accion     text,
  p_tabla      text,
  p_registro   uuid,
  p_clave      text,
  p_detalle    jsonb,
  p_ip         text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_headers jsonb;
  v_ip_txt  text;
  v_ip      inet;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  v_ip_txt := COALESCE(p_ip, v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip',
                       split_part(v_headers ->> 'x-forwarded-for', ',', 1));
  BEGIN
    v_ip := NULLIF(btrim(v_ip_txt), '')::inet;
  EXCEPTION WHEN others THEN
    v_ip := NULL;   -- valor que no es una IP: se ignora
  END;

  INSERT INTO public.auditoria (usuario_id, accion, tabla_afectada, registro_id, registro_clave,
                                detalle, origen, aal, ip, user_agent)
  VALUES (
    (SELECT u.id FROM public.usuario u WHERE u.id = p_usuario),   -- solo si tiene perfil (FK)
    p_accion, p_tabla, p_registro, p_clave, p_detalle,
    CASE (SELECT auth.role())
      WHEN 'authenticated' THEN 'app'
      WHEN 'service_role'  THEN 'edge_function'
      ELSE CASE WHEN session_user::text = 'supabase_auth_admin' THEN 'auth' ELSE 'sql' END
    END,
    (SELECT auth.jwt() ->> 'aal'),
    v_ip,
    left(COALESCE(p_user_agent, v_headers ->> 'user-agent'), 300)
  );
END $$;

-- Comentarios - Bitácora completa
-- Registra un evento de la aplicación que no es un cambio en una tabla: sesión, navegación, consultas,
-- llamadas y operaciones rechazadas. El autor es siempre la sesión actual (no se puede falsificar) y solo
-- se aceptan acciones conocidas. Evita duplicados de 5 s y limita a 200 eventos por minuto por usuario.
CREATE OR REPLACE FUNCTION public.fn_auditar(
  p_accion   text,
  p_tabla    text  DEFAULT NULL,
  p_registro uuid  DEFAULT NULL,
  p_detalle  jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid     uuid  := (SELECT auth.uid());
  v_detalle jsonb := p_detalle;
BEGIN
  IF p_accion NOT IN ('LOGIN', 'LOGIN_TOTP_FALLIDO', 'LOGOUT', 'SESION_EXPIRADA',
                      'VER_PAGINA', 'VER_DONANTE', 'VER_SOLICITUD', 'VER_USUARIO',
                      'BUSCAR_DONANTES', 'BUSCAR_SOLICITUDES', 'BUSCAR_CANDIDATOS',
                      'LLAMAR_DONANTE', 'OPERACION_RECHAZADA', 'ACCESO_DENEGADO', 'CORREO_FALLIDO') THEN
    RAISE EXCEPTION 'Acción de bitácora no permitida: %', p_accion USING ERRCODE = 'RS006';
  END IF;

  -- Sin perfil activo no se registra (cuenta inexistente o desactivada)
  IF v_uid IS NULL OR public.fn_rol_actual() IS NULL THEN
    RETURN;
  END IF;

  -- El detalle describe la acción; no se aceptan textos largos
  IF v_detalle IS NOT NULL AND length(v_detalle::text) > 2000 THEN
    v_detalle := jsonb_build_object('detalle_recortado', true);
  END IF;

  -- Evita duplicados (doble clic, doble render) y que alguien llene la bitácora llamando en bucle
  IF EXISTS (SELECT 1 FROM public.auditoria a
              WHERE a.usuario_id = v_uid AND a.accion = p_accion
                AND a.registro_id IS NOT DISTINCT FROM p_registro
                AND a.detalle IS NOT DISTINCT FROM v_detalle
                AND a.fecha > now() - interval '5 seconds')
     OR (SELECT count(*) FROM public.auditoria a
          WHERE a.usuario_id = v_uid AND a.fecha > now() - interval '1 minute') >= 200 THEN
    RETURN;
  END IF;

  PERFORM public.fn_insertar_auditoria(v_uid, p_accion, p_tabla, p_registro, NULL, v_detalle);
END $$;

-- Comentarios - Bitácora completa
-- Registra las acciones de administración que ocurren en Supabase Auth (crear usuario, cambiar contraseña,
-- reenviar activación) y los accesos denegados a esas funciones. Solo la ejecuta service_role, desde las
-- Edge Functions, que ya verificaron al administrador y envían su id, su IP y su navegador.
CREATE OR REPLACE FUNCTION public.fn_auditar_admin(
  p_actor      uuid,
  p_accion     text,
  p_tabla      text  DEFAULT NULL,
  p_registro   uuid  DEFAULT NULL,
  p_detalle    jsonb DEFAULT NULL,
  p_ip         text  DEFAULT NULL,
  p_user_agent text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_accion NOT IN ('CREAR_USUARIO', 'CAMBIAR_CONTRASENA', 'REENVIAR_ACTIVACION', 'ACCESO_DENEGADO') THEN
    RAISE EXCEPTION 'Acción de bitácora no permitida: %', p_accion USING ERRCODE = 'RS006';
  END IF;
  PERFORM public.fn_insertar_auditoria(p_actor, p_accion, p_tabla, p_registro, NULL, p_detalle, p_ip, p_user_agent);
END $$;

-- fn_registrar_login() → void   RPC · RNF-02 (auditoría de inicios de sesión)
-- Comentarios - Bitácora completa
-- Se conserva para las pestañas que aún tengan cargada la versión anterior de la app; ahora registra el
-- inicio de sesión mediante fn_auditar, con el mismo contexto que el resto de los eventos.
CREATE OR REPLACE FUNCTION public.fn_registrar_login()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.fn_auditar('LOGIN', 'usuario', (SELECT auth.uid()));
END $$;

-- fn_siguiente_codigo(tipo, prefijo) → texto   (interna; solo la usan los triggers de código)
--   Qué hace : incrementa de forma atómica el correlativo del año y arma el código:
--              donante → '2026004'   solicitud → 'S2026002'  (3 dígitos mínimo; crece si pasa de 999).
--   Cómo     : INSERT ... ON CONFLICT DO UPDATE bloquea la fila del contador, así dos
--              inserciones simultáneas jamás obtienen el mismo número.
CREATE OR REPLACE FUNCTION public.fn_siguiente_codigo(p_tipo text, p_prefijo text DEFAULT '')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_anio integer := extract(year FROM public.fn_hoy())::integer;
  v_n    integer;
BEGIN
  INSERT INTO public.secuencia_codigo AS s (tipo, anio, ultimo_valor)
  VALUES (p_tipo, v_anio, 1)
  ON CONFLICT (tipo, anio) DO UPDATE SET ultimo_valor = s.ultimo_valor + 1
  RETURNING s.ultimo_valor INTO v_n;

  RETURN p_prefijo || v_anio::text || repeat('0', greatest(3 - length(v_n::text), 0)) || v_n::text;
END $$;


/* =============================================================================
   8. FUNCIONES DE TRIGGER
   Todas devuelven `trigger`. Los errores de negocio usan los códigos RS00x.
============================================================================= */

-- fn_set_updated_at: BEFORE UPDATE · mantiene updated_at (tablas con esa columna).
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- fn_generar_codigo_donante: BEFORE INSERT · asigna codigo_donante si viene vacío.
CREATE OR REPLACE FUNCTION public.fn_generar_codigo_donante()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.codigo_donante IS NULL OR btrim(NEW.codigo_donante) = '' THEN
    NEW.codigo_donante := public.fn_siguiente_codigo('donante');
  END IF;
  RETURN NEW;
END $$;

-- fn_generar_codigo_solicitud: BEFORE INSERT · asigna codigo_solicitud (S + año + correlativo).
CREATE OR REPLACE FUNCTION public.fn_generar_codigo_solicitud()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.codigo_solicitud IS NULL OR btrim(NEW.codigo_solicitud) = '' THEN
    NEW.codigo_solicitud := public.fn_siguiente_codigo('solicitud', 'S');
  END IF;
  RETURN NEW;
END $$;

-- fn_normalizar_donante: BEFORE INSERT/UPDATE en donante · RF-33 / RF-35
--   · Normaliza RUT, correo, teléfono y textos (recorta espacios, vacío → NULL).
--   · Valida formato de RUT (y dígito verificador si está activado en configuracion).
--   · Rechaza fecha de última donación futura.
--   · Impide cambiar el código del donante desde la app.
--   · Deriva "comuna" (FK a public.comuna) a partir de "ubicacion" cuando se inserta o cambia.
--   · Completa latitud/longitud con el centroide de esa comuna (solo si no se enviaron
--     coordenadas o si cambió la ubicación sin tocar las coordenadas).
CREATE OR REPLACE FUNCTION public.fn_normalizar_donante()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_comuna    text;
  v_lat       numeric;
  v_lon       numeric;
  v_rut_orig  text := NEW.rut;   -- se conserva para mostrarlo en el mensaje de error
BEGIN
  IF TG_OP = 'UPDATE' AND (SELECT auth.uid()) IS NOT NULL
     AND NEW.codigo_donante IS DISTINCT FROM OLD.codigo_donante THEN
    RAISE EXCEPTION 'El código del donante no puede modificarse' USING ERRCODE = 'RS006';
  END IF;

  NEW.nombre        := btrim(NEW.nombre);
  NEW.apellido      := btrim(NEW.apellido);
  NEW.rut           := public.fn_normalizar_rut(NEW.rut);
  NEW.correo        := NULLIF(lower(btrim(NEW.correo)), '');
  NEW.telefono      := NULLIF(regexp_replace(btrim(NEW.telefono), '\s+', ' ', 'g'), '');
  NEW.fenotipo      := NULLIF(btrim(NEW.fenotipo), '');
  NEW.ubicacion     := NULLIF(btrim(NEW.ubicacion), '');
  NEW.observaciones := NULLIF(btrim(NEW.observaciones), '');

  IF NEW.rut !~ '^[0-9]{7,8}-[0-9k]$' THEN
    RAISE EXCEPTION 'RUT con formato inválido: %', v_rut_orig USING ERRCODE = 'RS007';
  END IF;
  IF COALESCE(public.fn_config('validar_dv_rut'), 'false') = 'true'
     AND NOT public.fn_rut_dv_valido(NEW.rut) THEN
    RAISE EXCEPTION 'El dígito verificador del RUT no es válido: %', v_rut_orig USING ERRCODE = 'RS007';
  END IF;

  IF NEW.fecha_ultima_donacion > public.fn_hoy() THEN
    RAISE EXCEPTION 'La fecha de última donación no puede ser futura' USING ERRCODE = 'RS007';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.ubicacion IS DISTINCT FROM OLD.ubicacion THEN
    SELECT c.nombre, c.latitud, c.longitud INTO v_comuna, v_lat, v_lon
      FROM public.comuna c
     WHERE public.fn_texto_sin_acentos(c.nombre)
         = public.fn_texto_sin_acentos(split_part(NEW.ubicacion, ',', 1))
     LIMIT 1;
    NEW.comuna := v_comuna;   -- NULL si la comuna no se reconoce
    IF (TG_OP = 'INSERT' AND NEW.latitud IS NULL)
       OR (TG_OP = 'UPDATE' AND NEW.latitud  IS NOT DISTINCT FROM OLD.latitud
                            AND NEW.longitud IS NOT DISTINCT FROM OLD.longitud) THEN
      NEW.latitud  := v_lat;
      NEW.longitud := v_lon;
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- fn_validar_usuario: BEFORE INSERT/UPDATE en usuario · RF-04..RF-07
--   SECURITY DEFINER para ver a todos los administradores sin que RLS lo impida.
--   · Normaliza nombre y correo (minúsculas).
--   · Un NO administrador solo puede cambiar su propio debe_cambiar_password (true→false).
--     Evita que un tecnólogo se auto-promueva a administrador o se reactive.
--   · Nunca permite dejar al sistema sin administradores activos.
--   · Sin sesión de usuario (SQL Editor / service_role) las reglas de permisos no aplican,
--     pero la del "último administrador" sí.
CREATE OR REPLACE FUNCTION public.fn_validar_usuario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  NEW.nombre   := btrim(NEW.nombre);
  NEW.apellido := btrim(NEW.apellido);
  NEW.correo   := lower(btrim(NEW.correo));

  IF TG_OP = 'UPDATE' THEN
    IF v_uid IS NOT NULL AND NOT public.fn_es_admin() THEN
      IF OLD.id <> v_uid THEN
        RAISE EXCEPTION 'Solo un administrador puede modificar a otros usuarios' USING ERRCODE = 'RS006';
      END IF;
      IF (NEW.id, NEW.nombre, NEW.apellido, NEW.correo, NEW.rol, NEW.activo)
           IS DISTINCT FROM (OLD.id, OLD.nombre, OLD.apellido, OLD.correo, OLD.rol, OLD.activo)
         OR (NEW.debe_cambiar_password AND NOT OLD.debe_cambiar_password) THEN
        RAISE EXCEPTION 'Solo puede marcar como realizado su cambio de contraseña' USING ERRCODE = 'RS006';
      END IF;
    END IF;

    IF OLD.rol = 'administrador' AND OLD.activo
       AND (NEW.rol <> 'administrador' OR NOT NEW.activo)
       AND NOT EXISTS (SELECT 1 FROM public.usuario u
                        WHERE u.rol = 'administrador' AND u.activo AND u.id <> OLD.id) THEN
      RAISE EXCEPTION 'Debe existir al menos un administrador activo' USING ERRCODE = 'RS006';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- fn_manejar_nuevo_usuario_auth: AFTER INSERT en auth.users · crea el perfil en public.usuario.
--   SEGURIDAD CRÍTICA: el rol se lee SOLO de raw_app_meta_data (editable únicamente con la
--   service_role key, p.ej. desde una Edge Function de administración). raw_user_meta_data
--   lo puede escribir el propio usuario en signUp, por lo que NUNCA se usa para el rol.
--   Metadatos esperados al crear un usuario con la Admin API (Edge Function con service_role):
--     app_metadata  : { "rol": "tecnologo|administrador", "debe_cambiar_password": true,
--                       "creado_por": "<uuid del administrador que lo crea>" }
--     user_metadata : { "nombre": "...", "apellido": "..." }
--   AUDITORÍA (RNF-02: "creación de usuario"): la Admin API no tiene sesión de usuario, así que
--   auth.uid() sería NULL y la bitácora no sabría quién creó la cuenta. Por eso, si app_metadata trae
--   "creado_por" y corresponde a un administrador activo, se atribuye la acción a él mientras se inserta
--   el perfil (solo dentro de esta transacción; después se restaura). app_metadata no puede ser escrito
--   por el propio usuario, de modo que el dato no se puede falsificar.
CREATE OR REPLACE FUNCTION public.fn_manejar_nuevo_usuario_auth()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_local    text := split_part(COALESCE(NEW.email, ''), '@', 1);
  v_rol      public.rol_usuario := 'tecnologo';
  v_nombre   text;
  v_apellido text;
  v_creador  uuid;
  v_sub_prev text;
BEGIN
  -- Comentarios - Perfil TENS solo lectura
  -- Acepta también el rol TENS cuando viene en app_metadata
  IF (NEW.raw_app_meta_data ->> 'rol') IN ('administrador', 'tecnologo', 'tens') THEN
    v_rol := (NEW.raw_app_meta_data ->> 'rol')::public.rol_usuario;
  END IF;

  v_nombre   := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'nombre'), ''),
                         NULLIF(initcap(split_part(v_local, '.', 1)), ''), 'Usuario');
  v_apellido := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'apellido'), ''),
                         NULLIF(initcap(split_part(v_local, '.', 2)), ''), 'Sin apellido');

  -- Atribución de la auditoría al administrador que creó la cuenta (si viene y es válido).
  BEGIN
    v_creador := (NEW.raw_app_meta_data ->> 'creado_por')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_creador := NULL;                                   -- valor mal formado: se ignora
  END;
  IF v_creador IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.usuario u
                                            WHERE u.id = v_creador AND u.rol = 'administrador' AND u.activo) THEN
    v_creador := NULL;                                   -- no es un administrador activo: se ignora
  END IF;
  IF v_creador IS NOT NULL THEN
    v_sub_prev := current_setting('request.jwt.claim.sub', true);
    PERFORM set_config('request.jwt.claim.sub', v_creador::text, true);
  END IF;

  INSERT INTO public.usuario (id, nombre, apellido, correo, rol, debe_cambiar_password)
  VALUES (NEW.id, v_nombre, v_apellido, lower(COALESCE(NEW.email, NEW.id::text || '@sin-correo.local')), v_rol,
          COALESCE((NEW.raw_app_meta_data ->> 'debe_cambiar_password')::boolean, true))
  ON CONFLICT (id) DO NOTHING;

  IF v_creador IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(v_sub_prev, ''), true);   -- se restaura el valor previo
  END IF;

  RETURN NEW;
END $$;

-- fn_validar_consentimiento: BEFORE INSERT en consentimiento · RF-16
--   Completa la fecha/hora de cada decisión (si no viene) para dejar evidencia temporal.
CREATE OR REPLACE FUNCTION public.fn_validar_consentimiento()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.fecha_cookies           := COALESCE(NEW.fecha_cookies, now());
  NEW.fecha_autoriza_contacto := COALESCE(NEW.fecha_autoriza_contacto, now());
  RETURN NEW;
END $$;

-- fn_consentimiento_inmutable: BEFORE UPDATE/DELETE en consentimiento
--   El historial es evidencia legal (Ley 19.628 / 21.719): no se edita ni se borra.
--   Para revocar o conceder, se INSERTA una fila nueva; la vista consentimiento_vigente
--   siempre muestra la última. Solo un acceso directo de DBA (sin sesión de usuario) puede
--   alterar el historial, p.ej. para atender una solicitud de eliminación de datos.
CREATE OR REPLACE FUNCTION public.fn_consentimiento_inmutable()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'El historial de consentimientos es inmutable: registre un nuevo consentimiento'
      USING ERRCODE = 'RS006';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- fn_validar_solicitud: BEFORE INSERT/UPDATE en solicitud · RF-24, RF-25, RF-32, RF-35
--   · Impide cambiar código y creador desde la app.
--   · Una solicitud cerrada es de solo lectura; para editarla se reabre (cambiando el estado).
--   · Mantiene fecha_cierre: se fija al cerrar y se borra si se reabre.
--   · Al asignar/cambiar donante valida (los mismos criterios de la búsqueda):
--       grupo compatible y fenotipo cumplido  → RS004
--       disponible por regla de 3 meses       → RS003
--       no asignado a otra solicitud activa   → RS003
CREATE OR REPLACE FUNCTION public.fn_validar_solicitud()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_donante public.donante%ROWTYPE;
BEGIN
  NEW.fenotipo_requerido := NULLIF(btrim(NEW.fenotipo_requerido), '');

  IF TG_OP = 'UPDATE' THEN
    IF (SELECT auth.uid()) IS NOT NULL
       AND (NEW.codigo_solicitud IS DISTINCT FROM OLD.codigo_solicitud OR NEW.creado_por <> OLD.creado_por) THEN
      RAISE EXCEPTION 'El código y el creador de la solicitud no pueden modificarse' USING ERRCODE = 'RS006';
    END IF;
    IF OLD.estado = 'cerrada' AND NEW.estado = 'cerrada' THEN
      RAISE EXCEPTION 'La solicitud está cerrada: reábrala para modificarla' USING ERRCODE = 'RS005';
    END IF;
  END IF;

  IF NEW.estado = 'cerrada' THEN
    NEW.fecha_cierre := COALESCE(NEW.fecha_cierre, now());
  ELSE
    NEW.fecha_cierre := NULL;
  END IF;

  IF NEW.donante_asignado_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.donante_asignado_id IS DISTINCT FROM OLD.donante_asignado_id) THEN

    SELECT * INTO v_donante FROM public.donante WHERE id = NEW.donante_asignado_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El donante asignado no existe o no es accesible' USING ERRCODE = 'RS007';
    END IF;

    IF NOT (v_donante.grupo_sanguineo = ANY (public.fn_grupos_compatibles(NEW.grupo_sanguineo_requerido))) THEN
      RAISE EXCEPTION 'El grupo % del donante no es compatible con el grupo requerido %',
        v_donante.grupo_sanguineo, NEW.grupo_sanguineo_requerido USING ERRCODE = 'RS004';
    END IF;
    IF NOT public.fn_fenotipo_cumple(v_donante.fenotipo, NEW.fenotipo_requerido) THEN
      RAISE EXCEPTION 'El fenotipo del donante no cumple el fenotipo requerido (%)', NEW.fenotipo_requerido
        USING ERRCODE = 'RS004';
    END IF;

    IF NEW.estado <> 'cerrada' THEN
      IF NOT public.fn_donante_disponible(v_donante.fecha_ultima_donacion, v_donante.sexo) THEN
        RAISE EXCEPTION 'El donante no está disponible: donó hace menos de % meses',
          public.fn_meses_espera(v_donante.sexo) USING ERRCODE = 'RS003';
      END IF;
      IF EXISTS (SELECT 1 FROM public.solicitud s
                  WHERE s.donante_asignado_id = NEW.donante_asignado_id
                    AND s.estado <> 'cerrada' AND s.id <> NEW.id) THEN
        RAISE EXCEPTION 'El donante ya está asignado a otra solicitud activa' USING ERRCODE = 'RS003';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- fn_validar_contacto: BEFORE INSERT en seguimiento_contacto · RF-31 / ERS 3.4.2
--   · No se registran contactos en solicitudes cerradas (RS005).
--   · No se puede contactar a un donante sin autorización de contacto vigente (RS002).
CREATE OR REPLACE FUNCTION public.fn_validar_contacto()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_estado public.estado_solicitud_enum;
BEGIN
  SELECT s.estado INTO v_estado FROM public.solicitud s WHERE s.id = NEW.solicitud_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud indicada no existe o no es accesible' USING ERRCODE = 'RS007';
  END IF;
  IF v_estado = 'cerrada' THEN
    RAISE EXCEPTION 'La solicitud está cerrada: no admite nuevos contactos' USING ERRCODE = 'RS005';
  END IF;
  IF NOT public.fn_donante_puede_contactarse(NEW.donante_id) THEN
    RAISE EXCEPTION 'El donante no tiene autorización de contacto vigente' USING ERRCODE = 'RS002';
  END IF;
  RETURN NEW;
END $$;

-- fn_aplicar_contacto_a_solicitud: AFTER INSERT en seguimiento_contacto
--   Automatiza el seguimiento "de inicio a término" (RF-31/RF-32):
--   · El primer contacto mueve la solicitud de 'abierta' a 'en_proceso'.
--   · Si el contacto es con el donante ASIGNADO, actualiza "reaccion":
--     confirmado → 'Donación aceptada' · rechazado → 'Donación rechazada'.
--   El cierre sigue siendo manual (botón "Finalizar solicitud").
CREATE OR REPLACE FUNCTION public.fn_aplicar_contacto_a_solicitud()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  UPDATE public.solicitud s
     SET estado   = CASE WHEN s.estado = 'abierta' THEN 'en_proceso' ELSE s.estado END,
         reaccion = CASE
                      WHEN s.donante_asignado_id = NEW.donante_id AND NEW.resultado = 'confirmado' THEN 'Donación aceptada'
                      WHEN s.donante_asignado_id = NEW.donante_id AND NEW.resultado = 'rechazado'  THEN 'Donación rechazada'
                      ELSE s.reaccion
                    END
   WHERE s.id = NEW.solicitud_id
     AND s.estado <> 'cerrada';
  RETURN NULL;
END $$;

-- fn_registrar_auditoria: AFTER INSERT/UPDATE/DELETE · RNF-02 (auditoría de operaciones críticas)
--   Escribe en auditoria quién, cuándo, qué tabla/registro y qué cambió.
--   · INSERT → accion 'CREAR' con los valores no sensibles (sin datos personales).
--   · DELETE → accion 'ELIMINAR' con los valores no sensibles de la fila borrada.
--   · Las tablas sin columna id (configuracion) se identifican por registro_clave.
--   · UPDATE → accion 'EDITAR' (o 'CAMBIAR_ESTADO' en solicitud) con antes/después SOLO
--     de columnas no sensibles; de las sensibles (nombre, RUT, correo, teléfono,
--     ubicación, observaciones...) registra únicamente el NOMBRE de la columna
--     modificada. Así la bitácora no se convierte en una segunda copia de datos
--     personales; la persona afectada se identifica por registro_id.
--   · Un UPDATE sin cambios reales (solo updated_at) no genera registro.
--   SECURITY DEFINER: el usuario final no tiene (ni debe tener) permiso de escritura en auditoria.
CREATE OR REPLACE FUNCTION public.fn_registrar_auditoria()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c_sensibles constant text[] := ARRAY['nombre','apellido','rut','correo','telefono','ubicacion','comuna','observaciones','latitud','longitud','detalle_reaccion','sexo'];
  v_new       jsonb;
  v_old       jsonb;
  v_fila      jsonb;
  v_cambios   jsonb := '{}'::jsonb;
  v_sens_mod  text[] := ARRAY[]::text[];
  v_detalle   jsonb;
  v_accion    text;
  k           text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new     := to_jsonb(NEW);
    v_fila    := v_new;
    v_accion  := 'CREAR';
    v_detalle := jsonb_build_object('valores', v_new - c_sensibles - ARRAY['created_at','updated_at']);
  -- Comentarios - Bitácora completa
  -- Un borrado queda registrado con los valores no sensibles de la fila eliminada
  ELSIF TG_OP = 'DELETE' THEN
    v_old     := to_jsonb(OLD);
    v_fila    := v_old;
    v_accion  := 'ELIMINAR';
    v_detalle := jsonb_build_object('valores', v_old - c_sensibles - ARRAY['created_at','updated_at']);
  ELSE
    v_new    := to_jsonb(NEW);
    v_old    := to_jsonb(OLD);
    v_fila   := v_new;
    v_accion := 'EDITAR';
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN k = 'updated_at' OR (v_new -> k) IS NOT DISTINCT FROM (v_old -> k);
      IF k = ANY (c_sensibles) THEN
        v_sens_mod := v_sens_mod || k;
      ELSE
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('antes', v_old -> k, 'despues', v_new -> k));
      END IF;
    END LOOP;
    IF v_cambios = '{}'::jsonb AND cardinality(v_sens_mod) = 0 THEN
      RETURN NULL;
    END IF;
    IF TG_TABLE_NAME = 'solicitud' AND (v_new ->> 'estado') IS DISTINCT FROM (v_old ->> 'estado') THEN
      v_accion := 'CAMBIAR_ESTADO';
    END IF;
    v_detalle := jsonb_build_object('cambios', v_cambios, 'campos_sensibles_modificados', to_jsonb(v_sens_mod));
  END IF;

  -- Comentarios - Bitácora completa
  -- fn_insertar_auditoria agrega el contexto (origen, sesión, IP, navegador) y solo referencia al usuario
  -- si tiene perfil. Las filas sin id (configuracion) se identifican por su clave.
  PERFORM public.fn_insertar_auditoria(
    (SELECT auth.uid()), v_accion, TG_TABLE_NAME,
    CASE WHEN v_fila ? 'id' THEN (v_fila ->> 'id')::uuid END,
    CASE WHEN v_fila ? 'id' THEN NULL ELSE v_fila ->> 'clave' END,
    v_detalle);

  RETURN NULL;
END $$;

-- Comentarios - Bitácora completa
-- La bitácora es inalterable: nadie puede modificar, borrar ni vaciar filas de auditoria, tampoco
-- service_role ni el SQL Editor. Solo el dueño de la base podría desactivar este trigger a propósito.
CREATE OR REPLACE FUNCTION public.fn_auditoria_inmutable()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar' USING ERRCODE = 'RS006';
END $$;


-- fn_validar_donacion: BEFORE INSERT en donacion
--   · Si viene solicitud_id sin donante_id, toma el donante ASIGNADO a esa solicitud
--     (así el front solo envía { solicitud_id, tipo }).
--   · Si viene solicitud, el donante debe ser el asignado a ella (RS007).
--   · La fecha no puede ser futura (RS007).
--   · Si se informa un detalle de reacción, marca hubo_reaccion = true.
--   No se bloquea una donación "cercana" a la anterior: sirve para cargar historial pasado y,
--   en la práctica clínica, la decisión de aceptar al donante la toma el banco de sangre.
CREATE OR REPLACE FUNCTION public.fn_validar_donacion()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_asignado uuid;
BEGIN
  NEW.detalle_reaccion := NULLIF(btrim(NEW.detalle_reaccion), '');
  IF NEW.detalle_reaccion IS NOT NULL THEN
    NEW.hubo_reaccion := true;
  END IF;

  IF NEW.solicitud_id IS NOT NULL THEN
    SELECT s.donante_asignado_id INTO v_asignado FROM public.solicitud s WHERE s.id = NEW.solicitud_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La solicitud indicada no existe o no es accesible' USING ERRCODE = 'RS007';
    END IF;
    NEW.donante_id := COALESCE(NEW.donante_id, v_asignado);
    IF v_asignado IS DISTINCT FROM NEW.donante_id THEN
      RAISE EXCEPTION 'La donación debe corresponder al donante asignado a la solicitud' USING ERRCODE = 'RS007';
    END IF;
  END IF;

  IF NEW.donante_id IS NULL THEN
    RAISE EXCEPTION 'Indique el donante (o una solicitud que tenga donante asignado)' USING ERRCODE = 'RS007';
  END IF;
  IF NEW.fecha_donacion > public.fn_hoy() THEN
    RAISE EXCEPTION 'La fecha de la donación no puede ser futura' USING ERRCODE = 'RS007';
  END IF;
  RETURN NEW;
END $$;

-- fn_aplicar_donacion: AFTER INSERT en donacion · mantiene coherente el resto del sistema
--   · donante.fecha_ultima_donacion = la más reciente (GREATEST): cargar una donación antigua
--     nunca "retrocede" la fecha. Con esto la regla de 3 meses se actualiza sola (RF-18/27).
--   · Si hubo reacción, marca donante.reaccion_adversa_previa = true (dato de la entrevista).
--   · Si pertenece a una solicitud NO cerrada, deja solicitud.reaccion = 'Donación realizada'.
--     No cierra la solicitud: tras donar siguen las pruebas de compatibilidad (entrevista, pregunta 12).
CREATE OR REPLACE FUNCTION public.fn_aplicar_donacion()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  UPDATE public.donante d
     SET fecha_ultima_donacion   = GREATEST(COALESCE(d.fecha_ultima_donacion, NEW.fecha_donacion), NEW.fecha_donacion),
         reaccion_adversa_previa = d.reaccion_adversa_previa OR NEW.hubo_reaccion
   WHERE d.id = NEW.donante_id;

  IF NEW.solicitud_id IS NOT NULL THEN
    UPDATE public.solicitud s
       SET reaccion = 'Donación realizada'
     WHERE s.id = NEW.solicitud_id AND s.estado <> 'cerrada';
  END IF;
  RETURN NULL;
END $$;

-- fn_sincronizar_donacion_inicial: AFTER INSERT / UPDATE OF fecha_ultima_donacion en donante
--   Si se registra o edita a mano la fecha de última donación y no hay una donación con esa fecha,
--   se crea la fila correspondiente en el historial. Así el historial es coherente sin importar si
--   la fecha entró por el formulario de alta, la edición o el RPC fn_registrar_donante.
--   No genera bucle: fn_aplicar_donacion vuelve a actualizar el donante con la MISMA fecha y esta
--   función ve que la donación ya existe.
CREATE OR REPLACE FUNCTION public.fn_sincronizar_donacion_inicial()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.fecha_ultima_donacion IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.fecha_ultima_donacion IS DISTINCT FROM OLD.fecha_ultima_donacion)
     AND NOT EXISTS (SELECT 1 FROM public.donacion x
                      WHERE x.donante_id = NEW.id AND x.fecha_donacion = NEW.fecha_ultima_donacion) THEN
    INSERT INTO public.donacion (donante_id, fecha_donacion, tipo, registrado_por)
    VALUES (NEW.id, NEW.fecha_ultima_donacion,
            CASE WHEN NEW.frecuente_plaquetas THEN 'plaquetas' ELSE 'sangre_total' END::public.tipo_donacion_enum,
            (SELECT u.id FROM public.usuario u WHERE u.id = (SELECT auth.uid())));
  END IF;
  RETURN NULL;
END $$;

-- fn_donacion_inmutable: BEFORE UPDATE/DELETE en donacion
--   El historial de donaciones no se edita ni se borra desde la app (trazabilidad). Una corrección la
--   hace un DBA desde el SQL Editor (sesión sin usuario); luego conviene revisar fecha_ultima_donacion.
CREATE OR REPLACE FUNCTION public.fn_donacion_inmutable()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'El historial de donaciones es inmutable: registre una donación nueva'
      USING ERRCODE = 'RS006';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;


/* =============================================================================
   9. TRIGGERS
   Primero se eliminan TODOS los triggers de las tablas de la app (incluidos los
   antiguos con otros nombres) y luego se recrean, para que el conjunto final sea
   exactamente el documentado aquí. Los BEFORE de una misma tabla se ejecutan en
   orden alfabético por nombre.
============================================================================= */
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tabla, t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relname IN ('usuario','donante','consentimiento','etiqueta_donante',
                         'solicitud','seguimiento_contacto','auditoria','configuracion','donacion')
       AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.tabla);
  END LOOP;
END $$;

-- usuario
CREATE TRIGGER trg_updated_at_usuario  BEFORE UPDATE ON public.usuario
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_validar_usuario     BEFORE INSERT OR UPDATE ON public.usuario
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_usuario();
-- Comentarios - Bitácora completa
-- Todas las tablas de la app registran altas, ediciones y borrados (los borrados solo son posibles por SQL o
-- por las tablas que los permiten, como etiqueta_donante, pero igual deben quedar en la bitácora)
CREATE TRIGGER trg_auditoria_usuario   AFTER INSERT OR UPDATE OR DELETE ON public.usuario
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- donante
CREATE TRIGGER trg_codigo_donante      BEFORE INSERT ON public.donante
  FOR EACH ROW EXECUTE FUNCTION public.fn_generar_codigo_donante();
CREATE TRIGGER trg_normalizar_donante  BEFORE INSERT OR UPDATE ON public.donante
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalizar_donante();
CREATE TRIGGER trg_updated_at_donante  BEFORE UPDATE ON public.donante
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_auditoria_donante   AFTER INSERT OR UPDATE OR DELETE ON public.donante
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();
CREATE TRIGGER trg_sincronizar_donacion AFTER INSERT OR UPDATE OF fecha_ultima_donacion ON public.donante
  FOR EACH ROW EXECUTE FUNCTION public.fn_sincronizar_donacion_inicial();

-- consentimiento (append-only; ya no necesita updated_at)
CREATE TRIGGER trg_validar_consentimiento     BEFORE INSERT ON public.consentimiento
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_consentimiento();
CREATE TRIGGER trg_consentimiento_inmutable   BEFORE UPDATE OR DELETE ON public.consentimiento
  FOR EACH ROW EXECUTE FUNCTION public.fn_consentimiento_inmutable();
CREATE TRIGGER trg_auditoria_consentimiento   AFTER INSERT OR UPDATE OR DELETE ON public.consentimiento
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- etiqueta_donante
-- Comentarios - Bitácora completa
-- Agregar o quitar una etiqueta del donante queda en la bitácora
CREATE TRIGGER trg_auditoria_etiqueta  AFTER INSERT OR UPDATE OR DELETE ON public.etiqueta_donante
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- solicitud
CREATE TRIGGER trg_codigo_solicitud    BEFORE INSERT ON public.solicitud
  FOR EACH ROW EXECUTE FUNCTION public.fn_generar_codigo_solicitud();
CREATE TRIGGER trg_updated_at_solicitud BEFORE UPDATE ON public.solicitud
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_validar_solicitud   BEFORE INSERT OR UPDATE ON public.solicitud
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_solicitud();
CREATE TRIGGER trg_auditoria_solicitud AFTER INSERT OR UPDATE OR DELETE ON public.solicitud
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- seguimiento_contacto
CREATE TRIGGER trg_validar_contacto    BEFORE INSERT ON public.seguimiento_contacto
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_contacto();
CREATE TRIGGER trg_aplicar_contacto    AFTER INSERT ON public.seguimiento_contacto
  FOR EACH ROW EXECUTE FUNCTION public.fn_aplicar_contacto_a_solicitud();
CREATE TRIGGER trg_auditoria_contacto  AFTER INSERT OR UPDATE OR DELETE ON public.seguimiento_contacto
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- donacion (append-only)
CREATE TRIGGER trg_validar_donacion    BEFORE INSERT ON public.donacion
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_donacion();
CREATE TRIGGER trg_donacion_inmutable  BEFORE UPDATE OR DELETE ON public.donacion
  FOR EACH ROW EXECUTE FUNCTION public.fn_donacion_inmutable();
CREATE TRIGGER trg_aplicar_donacion    AFTER INSERT ON public.donacion
  FOR EACH ROW EXECUTE FUNCTION public.fn_aplicar_donacion();
CREATE TRIGGER trg_auditoria_donacion  AFTER INSERT OR UPDATE OR DELETE ON public.donacion
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- configuracion
CREATE TRIGGER trg_updated_at_configuracion BEFORE UPDATE ON public.configuracion
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
-- Comentarios - Bitácora completa
-- Cambiar un parámetro (meses de espera, MFA del administrador, sede) queda con el valor anterior y el nuevo
CREATE TRIGGER trg_auditoria_configuracion AFTER INSERT OR UPDATE OR DELETE ON public.configuracion
  FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- auditoria
-- Comentarios - Bitácora completa
-- La bitácora no admite modificaciones, borrados ni vaciado (TRUNCATE)
CREATE TRIGGER trg_auditoria_inmutable    BEFORE UPDATE OR DELETE ON public.auditoria
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_inmutable();
CREATE TRIGGER trg_auditoria_sin_truncate BEFORE TRUNCATE ON public.auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_auditoria_inmutable();

-- auth.users → crea el perfil en public.usuario (Supabase permite triggers sobre auth.users).
-- Se conserva el nombre que ya usa el proyecto (trg_nuevo_usuario_auth) y se elimina el
-- nombre estándar de Supabase por si alguna vez se creó, para que quede UN solo trigger.
DROP TRIGGER IF EXISTS on_auth_user_created  ON auth.users;
DROP TRIGGER IF EXISTS trg_nuevo_usuario_auth ON auth.users;
CREATE TRIGGER trg_nuevo_usuario_auth AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_manejar_nuevo_usuario_auth();


/* =============================================================================
   10. VISTAS
   Todas con security_invoker = true: se evalúan con los permisos (y RLS) de quien
   consulta, nunca con los del dueño. Se recrean (DROP + CREATE) porque CREATE OR
   REPLACE VIEW no permite cambiar columnas.
============================================================================= */
-- Orden: primero las vistas que dependen de otras (v_control_consentimientos usa consentimiento_vigente).
DROP VIEW IF EXISTS public.v_control_consentimientos;
DROP VIEW IF EXISTS public.consentimiento_vigente;
DROP VIEW IF EXISTS public.v_donante_listado;
DROP VIEW IF EXISTS public.v_solicitud_listado;
DROP VIEW IF EXISTS public.v_solicitud_activa;
DROP VIEW IF EXISTS public.v_dashboard_resumen;
DROP VIEW IF EXISTS public.v_dashboard_donantes_por_grupo;
DROP VIEW IF EXISTS public.v_demanda_historica;
DROP VIEW IF EXISTS public.v_donacion_listado;
DROP VIEW IF EXISTS public.v_donaciones_mensuales;

-- consentimiento_vigente: último consentimiento de cada donante (pantalla "Contacto y consentimiento").
CREATE VIEW public.consentimiento_vigente WITH (security_invoker = true) AS
SELECT DISTINCT ON (c.donante_id)
       c.id, c.donante_id, c.acepta_cookies, c.fecha_cookies,
       c.autoriza_contacto, c.fecha_autoriza_contacto, c.created_at, c.updated_at
  FROM public.consentimiento c
 ORDER BY c.donante_id, c.created_at DESC, c.id DESC;

-- v_donante_listado: pantalla "Donantes" (RF-10..RF-12). Incluye etiquetas, disponibilidad y "hace N meses".
CREATE VIEW public.v_donante_listado WITH (security_invoker = true) AS
SELECT d.id,
       d.codigo_donante,
       d.rut,
       d.nombre,
       d.apellido,
       d.nombre || ' ' || d.apellido                              AS nombre_completo,
       d.grupo_sanguineo,
       d.fenotipo,
       d.fenotipo_raro,
       d.frecuente_plaquetas,
       ARRAY(
         SELECT x.e
           FROM (SELECT 'Fenotipo raro' AS e, 1 AS o WHERE d.fenotipo_raro
                 UNION ALL
                 SELECT 'Plaquetas', 2 WHERE d.frecuente_plaquetas
                 UNION ALL
                 SELECT t.etiqueta, 3
                   FROM public.etiqueta_donante t
                  WHERE t.donante_id = d.id
                    AND lower(btrim(t.etiqueta)) NOT IN ('fenotipo raro', 'plaquetas')) x
          ORDER BY x.o, x.e
       )                                                          AS etiquetas,
       d.fecha_ultima_donacion,
       (SELECT count(*) FROM public.donacion dn WHERE dn.donante_id = d.id)::integer AS total_donaciones,
       public.fn_meses_desde(d.fecha_ultima_donacion)             AS meses_desde_ultima_donacion,
       public.fn_fecha_proxima_donacion(d.fecha_ultima_donacion, d.sexo) AS fecha_proxima_donacion,
       public.fn_donante_disponible(d.fecha_ultima_donacion, d.sexo)     AS disponible,
       public.fn_donante_puede_contactarse(d.id)                  AS puede_contactarse,
       d.ubicacion,
       d.comuna,
       d.reaccion_adversa_previa,
       d.created_at
  FROM public.donante d;

-- v_solicitud_listado: pantalla "Solicitudes" y "Detalle de solicitud" (RF-28..RF-30).
CREATE VIEW public.v_solicitud_listado WITH (security_invoker = true) AS
SELECT s.id,
       s.codigo_solicitud,
       s.grupo_sanguineo_requerido,
       s.fenotipo_requerido,
       s.urgencia,
       s.estado,
       s.donante_asignado_id,
       d.codigo_donante,
       d.nombre || ' ' || d.apellido  AS candidato_asignado,
       s.creado_por,
       public.fn_nombre_usuario(s.creado_por) AS creado_por_nombre,
       s.reaccion,
       s.fecha_agendada,
       s.numero_externo,
       s.created_at,
       s.fecha_cierre
  FROM public.solicitud s
  LEFT JOIN public.donante d ON d.id = s.donante_asignado_id;

-- v_solicitud_activa: tarjeta "Solicitudes activas o pendientes" del dashboard (RF-23).
--   Más urgentes primero y, dentro de cada urgencia, las más recientes.
CREATE VIEW public.v_solicitud_activa WITH (security_invoker = true) AS
SELECT s.id, s.codigo_solicitud, s.grupo_sanguineo_requerido, s.fenotipo_requerido,
       s.urgencia, s.estado, s.created_at
  FROM public.solicitud s
 WHERE s.estado <> 'cerrada'
 ORDER BY s.urgencia, s.created_at DESC;

-- v_dashboard_resumen: las 4 tarjetas de indicadores (RF-19..RF-21). Una sola fila.
CREATE VIEW public.v_dashboard_resumen WITH (security_invoker = true) AS
SELECT count(*)::integer                                                                  AS donantes_totales,
       (count(*) FILTER (WHERE d.fenotipo_raro))::integer                                 AS fenotipos_raros,
       (count(*) FILTER (WHERE d.frecuente_plaquetas))::integer                           AS plaquetas_frecuentes,
       (count(*) FILTER (WHERE public.fn_donante_disponible(d.fecha_ultima_donacion, d.sexo)))::integer AS disponibles_ahora
  FROM public.donante d;

-- v_dashboard_donantes_por_grupo: agrupación por grupo sanguíneo (RF-22). Incluye grupos con 0 donantes.
CREATE VIEW public.v_dashboard_donantes_por_grupo WITH (security_invoker = true) AS
SELECT g.grupo                                                                          AS grupo_sanguineo,
       count(d.id)::integer                                                             AS total,
       (count(d.id) FILTER (WHERE public.fn_donante_disponible(d.fecha_ultima_donacion, d.sexo)))::integer AS disponibles,
       (count(d.id) FILTER (WHERE d.fenotipo_raro))::integer                            AS fenotipos_raros
  FROM unnest(enum_range(NULL::public.grupo_sanguineo_enum)) AS g(grupo)
  LEFT JOIN public.donante d ON d.grupo_sanguineo = g.grupo
 GROUP BY g.grupo
 ORDER BY g.grupo;

-- v_demanda_historica: análisis histórico de la demanda (alcance del proyecto, gráfico de línea del dashboard).
--   dias_promedio_cierre mide el objetivo del proyecto: cuánto tarda en resolverse una solicitud.
CREATE VIEW public.v_demanda_historica WITH (security_invoker = true) AS
SELECT extract(year  FROM (s.created_at AT TIME ZONE 'America/Santiago'))::integer AS anio,
       extract(month FROM (s.created_at AT TIME ZONE 'America/Santiago'))::integer AS mes,
       s.grupo_sanguineo_requerido                                                  AS grupo_sanguineo,
       s.urgencia,
       count(*)::integer                                                            AS total_solicitudes,
       (count(*) FILTER (WHERE s.estado = 'cerrada'))::integer                      AS cerradas,
       round((avg(extract(epoch FROM (s.fecha_cierre - s.created_at)) / 86400.0)
               FILTER (WHERE s.fecha_cierre IS NOT NULL))::numeric, 1)              AS dias_promedio_cierre
  FROM public.solicitud s
 GROUP BY 1, 2, 3, 4
 ORDER BY 1 DESC, 2 DESC, 3, 4;


-- v_donacion_listado: historial de donaciones para la ficha del donante y el detalle de la solicitud.
CREATE VIEW public.v_donacion_listado WITH (security_invoker = true) AS
SELECT dn.id,
       dn.donante_id,
       d.codigo_donante,
       d.nombre || ' ' || d.apellido  AS donante,
       dn.solicitud_id,
       s.codigo_solicitud,
       dn.fecha_donacion,
       dn.tipo,
       dn.hubo_reaccion,
       dn.detalle_reaccion,
       dn.registrado_por,
       public.fn_nombre_usuario(dn.registrado_por) AS registrado_por_nombre,
       dn.created_at
  FROM public.donacion dn
  JOIN public.donante d        ON d.id = dn.donante_id
  LEFT JOIN public.solicitud s ON s.id = dn.solicitud_id;

-- v_donaciones_mensuales: análisis histórico de donaciones (gráfico del dashboard).
CREATE VIEW public.v_donaciones_mensuales WITH (security_invoker = true) AS
SELECT extract(year  FROM dn.fecha_donacion)::integer AS anio,
       extract(month FROM dn.fecha_donacion)::integer AS mes,
       dn.tipo,
       count(*)::integer                              AS total_donaciones,
       (count(*) FILTER (WHERE dn.hubo_reaccion))::integer AS con_reaccion,
       (count(*) FILTER (WHERE dn.solicitud_id IS NOT NULL))::integer AS por_solicitud
  FROM public.donacion dn
 GROUP BY 1, 2, 3
 ORDER BY 1 DESC, 2 DESC, 3;

-- v_control_consentimientos: indicador de aceptación del Acta de Constitución:
--   "100 % de los donantes registrados cuentan con ambos consentimientos con fecha y hora".
--   Una sola fila; porcentaje_cumplimiento debe ser 100. Úsese en la Fase 3.1 (pruebas).
CREATE VIEW public.v_control_consentimientos WITH (security_invoker = true) AS
SELECT count(*)::integer                                                              AS donantes_totales,
       (count(*) FILTER (WHERE cv.id IS NOT NULL AND cv.acepta_cookies AND cv.autoriza_contacto
                          AND cv.fecha_cookies IS NOT NULL
                          AND cv.fecha_autoriza_contacto IS NOT NULL))::integer       AS con_ambos_consentimientos,
       (count(*) FILTER (WHERE cv.id IS NULL))::integer                               AS sin_registro,
       (count(*) FILTER (WHERE cv.id IS NOT NULL
                          AND NOT (cv.acepta_cookies AND cv.autoriza_contacto)))::integer AS con_consentimiento_incompleto,
       (count(*) FILTER (WHERE cv.id IS NOT NULL
                          AND (cv.fecha_cookies IS NULL
                               OR cv.fecha_autoriza_contacto IS NULL)))::integer       AS sin_fecha_hora,
       round(100.0 * count(*) FILTER (WHERE cv.id IS NOT NULL AND cv.acepta_cookies AND cv.autoriza_contacto
                                       AND cv.fecha_cookies IS NOT NULL
                                       AND cv.fecha_autoriza_contacto IS NOT NULL)
             / NULLIF(count(*), 0), 1)                                                AS porcentaje_cumplimiento
  FROM public.donante d
  LEFT JOIN public.consentimiento_vigente cv ON cv.donante_id = d.id;


/* =============================================================================
   11. SEGURIDAD: ROW LEVEL SECURITY (RNF-02)
   Modelo: "personal activo" = administrador o tecnólogo con perfil activo.
     · Administrador : todo lo del tecnólogo + usuarios, auditoría y configuración.
     · Tecnólogo     : donantes, consentimientos, solicitudes y contactos.
     · anon          : sin acceso a nada.
     · Nadie borra datos desde la app (el ERS no define eliminación de donantes, solicitudes
       ni usuarios; los usuarios se desactivan con activo = false). Las políticas DELETE de
       administrador que existían antes se retiraron a propósito: con las claves foráneas y el
       historial de consentimientos esos borrados fallaban o dejaban datos huérfanos.
     · consentimiento y seguimiento_contacto son append-only (solo SELECT e INSERT).
   (SELECT fn()) se usa para que Postgres evalúe la función UNA vez por consulta y no por fila.
============================================================================= */
ALTER TABLE public.usuario              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donante              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimiento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etiqueta_donante     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitud            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donacion             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comuna               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuencia_codigo     ENABLE ROW LEVEL SECURITY;   -- sin políticas: solo funciones SECURITY DEFINER

-- Se eliminan las políticas previas para que el conjunto final sea el documentado aquí.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('usuario','donante','consentimiento','etiqueta_donante','solicitud',
                         'seguimiento_contacto','auditoria','configuracion','comuna','secuencia_codigo','donacion')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- usuario: solo el administrador ve el directorio (pantalla Configuración); cada uno ve su fila.
--          El personal obtiene "Creada por" / "Registrada por" mediante fn_nombre_usuario.
--          Solo el administrador crea/edita usuarios; cada uno puede tocar su propia fila
--          (el trigger fn_validar_usuario limita eso a marcar el cambio de contraseña).
CREATE POLICY usuario_select ON public.usuario FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_admin()) OR id = (SELECT auth.uid()));
CREATE POLICY usuario_insert_admin ON public.usuario FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_es_admin()));
CREATE POLICY usuario_update_admin ON public.usuario FOR UPDATE TO authenticated
  USING ((SELECT public.fn_es_admin())) WITH CHECK ((SELECT public.fn_es_admin()));
CREATE POLICY usuario_update_propio ON public.usuario FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- Comentarios - Perfil TENS solo lectura
-- Lectura: todo el personal activo (fn_es_personal_activo). Escritura: solo administrador y tecnólogo (fn_puede_escribir)
-- donante: personal activo ve; administrador y tecnólogo crean y editan. Sin DELETE.
CREATE POLICY donante_select ON public.donante FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY donante_insert ON public.donante FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_puede_escribir()));
-- Para blindar RF-17 al 100% cuando el front use fn_registrar_donante, se puede eliminar
-- la política donante_insert y dejar el alta solo vía RPC.
CREATE POLICY donante_update ON public.donante FOR UPDATE TO authenticated
  USING ((SELECT public.fn_puede_escribir())) WITH CHECK ((SELECT public.fn_puede_escribir()));

-- consentimiento: historial append-only (solo SELECT e INSERT).
CREATE POLICY consentimiento_select ON public.consentimiento FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY consentimiento_insert ON public.consentimiento FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_puede_escribir()));

-- etiqueta_donante: se pueden agregar y quitar etiquetas libres.
CREATE POLICY etiqueta_select ON public.etiqueta_donante FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY etiqueta_insert ON public.etiqueta_donante FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_puede_escribir()));
CREATE POLICY etiqueta_delete ON public.etiqueta_donante FOR DELETE TO authenticated
  USING ((SELECT public.fn_puede_escribir()));

-- solicitud: el creador queda registrado y no se puede falsear (creado_por = quien está logueado).
CREATE POLICY solicitud_select ON public.solicitud FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY solicitud_insert ON public.solicitud FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_puede_escribir()) AND creado_por = (SELECT auth.uid()));
CREATE POLICY solicitud_update ON public.solicitud FOR UPDATE TO authenticated
  USING ((SELECT public.fn_puede_escribir())) WITH CHECK ((SELECT public.fn_puede_escribir()));

-- seguimiento_contacto: bitácora APPEND-ONLY (solo SELECT e INSERT, igual que la configuración
-- previa). Un nuevo intento o un nuevo resultado se registra como una fila nueva; quien
-- registra queda identificado y no se puede falsear.
CREATE POLICY contacto_select ON public.seguimiento_contacto FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY contacto_insert ON public.seguimiento_contacto FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_puede_escribir()) AND registrado_por = (SELECT auth.uid()));

-- donacion: historial APPEND-ONLY. Quien registra queda identificado y no se puede falsear.
CREATE POLICY donacion_select ON public.donacion FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY donacion_insert ON public.donacion FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.fn_puede_escribir()) AND registrado_por = (SELECT auth.uid()));

-- auditoria: solo lectura para el administrador. Se escribe únicamente vía triggers/RPC.
CREATE POLICY auditoria_select_admin ON public.auditoria FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_admin()));

-- configuracion: lectura para el personal, edición solo del administrador.
CREATE POLICY configuracion_select ON public.configuracion FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));
CREATE POLICY configuracion_update_admin ON public.configuracion FOR UPDATE TO authenticated
  USING ((SELECT public.fn_es_admin())) WITH CHECK ((SELECT public.fn_es_admin()));

-- comuna: catálogo de solo lectura.
CREATE POLICY comuna_select ON public.comuna FOR SELECT TO authenticated
  USING ((SELECT public.fn_es_personal_activo()));

-- realtime.messages: presencia "Conectado ahora" de la pantalla Configuración.
--   Cada usuario se anuncia en su canal privado presencia:<id>. Lo leen el dueño y el administrador.
--   La lectura NO filtra por extension: Realtime evalúa el permiso de unirse al canal sin
--   extension = 'presence', y con ese filtro rechaza a todos. El tema ya limita el alcance.
--   El administrador se valida con fn_rol_actual (sin MFA): fn_es_admin no autorizó en Realtime.
DROP POLICY IF EXISTS presencia_leer     ON realtime.messages;
DROP POLICY IF EXISTS presencia_anunciar ON realtime.messages;
CREATE POLICY presencia_leer ON realtime.messages FOR SELECT TO authenticated
  USING (realtime.topic() = 'presencia:' || (SELECT auth.uid())::text
         OR (realtime.topic() LIKE 'presencia:%'
             AND (SELECT public.fn_rol_actual()) = 'administrador'));
CREATE POLICY presencia_anunciar ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (extension = 'presence'
              AND realtime.topic() = 'presencia:' || (SELECT auth.uid())::text
              AND (SELECT public.fn_es_personal_activo()));


/* =============================================================================
   12. PERMISOS (privilegio mínimo)
   RLS decide QUÉ FILAS; los GRANT deciden QUÉ OPERACIONES. Ambas capas deben permitir.
============================================================================= */
REVOKE ALL ON TABLE
  public.usuario, public.donante, public.consentimiento, public.etiqueta_donante,
  public.solicitud, public.seguimiento_contacto, public.auditoria, public.configuracion,
  public.comuna, public.secuencia_codigo, public.donacion,
  public.consentimiento_vigente, public.v_donante_listado, public.v_solicitud_listado,
  public.v_solicitud_activa, public.v_dashboard_resumen, public.v_dashboard_donantes_por_grupo,
  public.v_demanda_historica, public.v_control_consentimientos, public.v_donacion_listado, public.v_donaciones_mensuales
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.usuario              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.donante              TO authenticated;
GRANT SELECT, INSERT         ON public.consentimiento       TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.etiqueta_donante     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.solicitud            TO authenticated;
GRANT SELECT, INSERT         ON public.seguimiento_contacto TO authenticated;
GRANT SELECT, INSERT         ON public.donacion             TO authenticated;
GRANT SELECT                 ON public.auditoria            TO authenticated;
GRANT SELECT                 ON public.configuracion        TO authenticated;
GRANT UPDATE (valor)         ON public.configuracion        TO authenticated;
GRANT SELECT                 ON public.comuna               TO authenticated;
GRANT SELECT ON
  public.consentimiento_vigente, public.v_donante_listado, public.v_solicitud_listado,
  public.v_solicitud_activa, public.v_dashboard_resumen, public.v_dashboard_donantes_por_grupo,
  public.v_demanda_historica, public.v_control_consentimientos, public.v_donacion_listado, public.v_donaciones_mensuales
TO authenticated;

-- Funciones: nada para anon/PUBLIC. authenticated puede ejecutarlas (las usan RLS, vistas y
-- triggers con permisos del usuario), salvo las internas.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_siguiente_codigo(text, text)  FROM authenticated;
-- Comentarios - Límite de sesión de 1 hora
-- El hook de Auth solo lo ejecuta supabase_auth_admin; ningún usuario puede llamarlo por la API.
REVOKE EXECUTE ON FUNCTION public.fn_hook_limite_sesion(jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_hook_limite_sesion(jsonb) TO supabase_auth_admin;
-- Comentarios - Bitácora completa
-- fn_insertar_auditoria es interna. fn_auditar_admin solo la usan las Edge Functions (service_role).
-- fn_auditar la llama la app con la sesión del usuario.
REVOKE EXECUTE ON FUNCTION public.fn_insertar_auditoria(uuid, text, text, uuid, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_auditar_admin(uuid, text, text, uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_auditar_admin(uuid, text, text, uuid, jsonb, text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.fn_auditar(text, text, uuid, jsonb) TO authenticated;


/* =============================================================================
   13. ÍNDICES
============================================================================= */
-- Comentarios - Índices originales de la base
-- Existían en producción desde antes de este script; se declaran para que una base nueva quede igual.
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha            ON public.auditoria (fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario          ON public.auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_donante_fenotipo_raro      ON public.donante (fenotipo_raro) WHERE fenotipo_raro = true;
CREATE INDEX IF NOT EXISTS idx_etiqueta_donante_donante   ON public.etiqueta_donante (donante_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_solicitud      ON public.seguimiento_contacto (solicitud_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_donante_asignado ON public.solicitud (donante_asignado_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_estado           ON public.solicitud (estado);

-- Reemplazos por índices compuestos (el compuesto cubre también las búsquedas del antiguo):
DROP INDEX IF EXISTS public.idx_consentimiento_donante;
CREATE INDEX IF NOT EXISTS idx_consentimiento_donante_fecha
  ON public.consentimiento (donante_id, created_at DESC);      -- "consentimiento vigente" y búsqueda de candidatos
DROP INDEX IF EXISTS public.idx_donante_grupo_sanguineo;
CREATE INDEX IF NOT EXISTS idx_donante_grupo_ultima_donacion
  ON public.donante (grupo_sanguineo, fecha_ultima_donacion);  -- filtro por grupo + disponibilidad

-- Llaves foráneas sin índice (acelera JOIN y evita lecturas completas al borrar/actualizar):
CREATE INDEX IF NOT EXISTS idx_donante_comuna              ON public.donante (comuna);
CREATE INDEX IF NOT EXISTS idx_donacion_donante_fecha      ON public.donacion (donante_id, fecha_donacion DESC);  -- historial del donante
CREATE INDEX IF NOT EXISTS idx_donacion_solicitud          ON public.donacion (solicitud_id) WHERE solicitud_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donacion_registrado_por     ON public.donacion (registrado_por);
CREATE INDEX IF NOT EXISTS idx_donacion_fecha              ON public.donacion (fecha_donacion DESC);               -- análisis mensual
CREATE INDEX IF NOT EXISTS idx_seguimiento_donante         ON public.seguimiento_contacto (donante_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_registrado_por  ON public.seguimiento_contacto (registrado_por);
CREATE INDEX IF NOT EXISTS idx_solicitud_creado_por        ON public.solicitud (creado_por);
CREATE INDEX IF NOT EXISTS idx_consentimiento_registrado   ON public.consentimiento (registrado_por);

-- Consultas frecuentes:
CREATE INDEX IF NOT EXISTS idx_solicitud_created_at ON public.solicitud (created_at DESC);          -- histórico / listado
CREATE INDEX IF NOT EXISTS idx_solicitud_activa     ON public.solicitud (urgencia, created_at DESC)
  WHERE estado <> 'cerrada';                                                                        -- dashboard
CREATE INDEX IF NOT EXISTS idx_auditoria_registro   ON public.auditoria (tabla_afectada, registro_id); -- historial de un registro
-- Comentarios - Bitácora completa
-- Actividad de un usuario por fecha: la usan el control de duplicados de fn_auditar y la consulta de la bitácora
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_fecha ON public.auditoria (usuario_id, fecha DESC);

-- Integridad con índices únicos:
-- Una solicitud no registra dos veces la misma donación del mismo donante (doble clic):
CREATE UNIQUE INDEX IF NOT EXISTS uq_donacion_solicitud_donante ON public.donacion (solicitud_id, donante_id)
  WHERE solicitud_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_correo_lower ON public.usuario (lower(correo));
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_numero_externo ON public.solicitud (numero_externo)
  WHERE numero_externo IS NOT NULL;                                   -- un número externo = una solicitud
-- Un donante no puede estar asignado a dos solicitudes activas a la vez (a prueba de concurrencia):
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_donante_activa
  ON public.solicitud (donante_asignado_id)
  WHERE estado <> 'cerrada' AND donante_asignado_id IS NOT NULL;


/* =============================================================================
   14. DATOS BASE
============================================================================= */

-- Parámetros del sistema (no pisa valores ya cambiados por el administrador).
INSERT INTO public.configuracion (clave, valor, descripcion) VALUES
  ('meses_entre_donaciones', '3',
   'Meses que deben pasar desde la última donación para considerar disponible a un donante (regla de 3 meses).'),
  ('meses_entre_donaciones_mujer', '4',
   'Meses de espera entre donaciones para mujeres y sexo "No especifica" (fn_meses_espera).'),
  ('sede_nombre', 'Clínica Indisa',
   'Nombre del establecimiento desde el cual se mide la cercanía de los donantes.'),
  ('sede_latitud', '-33.4240',
   'Latitud de la clínica (APROXIMADA: ajustar con las coordenadas reales de la sede).'),
  ('sede_longitud', '-70.6150',
   'Longitud de la clínica (APROXIMADA: ajustar con las coordenadas reales de la sede).'),
  ('exigir_mfa_admin', 'true',
   'true = las acciones de administrador exigen sesión MFA (aal2). El front ya implementa TOTP: debe quedar en true.'),
  ('validar_dv_rut', 'false',
   'true = valida el dígito verificador (módulo 11) del RUT. Dejar en false mientras se usen datos simulados.')
ON CONFLICT (clave) DO NOTHING;

-- Comunas de la Región Metropolitana (52). Coordenadas = centroide APROXIMADO.
INSERT INTO public.comuna (nombre, provincia, latitud, longitud) VALUES
  ('Santiago','Santiago',-33.4569,-70.6483), ('Cerrillos','Santiago',-33.4986,-70.7117),
  ('Cerro Navia','Santiago',-33.4222,-70.7333), ('Conchalí','Santiago',-33.3833,-70.6750),
  ('El Bosque','Santiago',-33.5667,-70.6750), ('Estación Central','Santiago',-33.4511,-70.6786),
  ('Huechuraba','Santiago',-33.3667,-70.6333), ('Independencia','Santiago',-33.4167,-70.6667),
  ('La Cisterna','Santiago',-33.5333,-70.6633), ('La Florida','Santiago',-33.5167,-70.5833),
  ('La Granja','Santiago',-33.5367,-70.6267), ('La Pintana','Santiago',-33.5833,-70.6333),
  ('La Reina','Santiago',-33.4500,-70.5333), ('Las Condes','Santiago',-33.4083,-70.5667),
  ('Lo Barnechea','Santiago',-33.3500,-70.5167), ('Lo Espejo','Santiago',-33.5239,-70.6911),
  ('Lo Prado','Santiago',-33.4469,-70.7228), ('Macul','Santiago',-33.4850,-70.5990),
  ('Maipú','Santiago',-33.5167,-70.7667), ('Ñuñoa','Santiago',-33.4569,-70.5975),
  ('Pedro Aguirre Cerda','Santiago',-33.4917,-70.6750), ('Peñalolén','Santiago',-33.4850,-70.5400),
  ('Providencia','Santiago',-33.4333,-70.6167), ('Pudahuel','Santiago',-33.4417,-70.7583),
  ('Quilicura','Santiago',-33.3583,-70.7283), ('Quinta Normal','Santiago',-33.4333,-70.6978),
  ('Recoleta','Santiago',-33.4000,-70.6417), ('Renca','Santiago',-33.4000,-70.7167),
  ('San Joaquín','Santiago',-33.4967,-70.6250), ('San Miguel','Santiago',-33.4975,-70.6533),
  ('San Ramón','Santiago',-33.5392,-70.6411), ('Vitacura','Santiago',-33.3833,-70.5667),
  ('Puente Alto','Cordillera',-33.6117,-70.5758), ('Pirque','Cordillera',-33.6667,-70.5833),
  ('San José de Maipo','Cordillera',-33.6422,-70.3500),
  ('Colina','Chacabuco',-33.2000,-70.6750), ('Lampa','Chacabuco',-33.2833,-70.8833),
  ('Tiltil','Chacabuco',-33.0833,-70.9333),
  ('San Bernardo','Maipo',-33.5925,-70.6997), ('Buin','Maipo',-33.7333,-70.7333),
  ('Calera de Tango','Maipo',-33.6333,-70.7833), ('Paine','Maipo',-33.8167,-70.7500),
  ('Melipilla','Melipilla',-33.6833,-71.2167), ('Alhué','Melipilla',-34.0333,-71.1000),
  ('Curacaví','Melipilla',-33.4000,-71.1333), ('María Pinto','Melipilla',-33.5167,-71.1167),
  ('San Pedro','Melipilla',-33.9000,-71.4667),
  ('Talagante','Talagante',-33.6667,-70.9333), ('El Monte','Talagante',-33.6833,-70.9833),
  ('Isla de Maipo','Talagante',-33.7500,-70.9000), ('Padre Hurtado','Talagante',-33.5667,-70.8167),
  ('Peñaflor','Talagante',-33.6167,-70.8767)
ON CONFLICT (nombre) DO NOTHING;

-- Correlativos: se alinean con los códigos que YA existen para no repetirlos.
INSERT INTO public.secuencia_codigo (tipo, anio, ultimo_valor)
SELECT 'donante', substr(codigo_donante, 1, 4)::integer, max(substr(codigo_donante, 5)::integer)
  FROM public.donante
 WHERE codigo_donante ~ '^[0-9]{5,}$'
 GROUP BY 1, 2
ON CONFLICT (tipo, anio) DO UPDATE
  SET ultimo_valor = GREATEST(public.secuencia_codigo.ultimo_valor, EXCLUDED.ultimo_valor);

INSERT INTO public.secuencia_codigo (tipo, anio, ultimo_valor)
SELECT 'solicitud', substr(codigo_solicitud, 2, 4)::integer, max(substr(codigo_solicitud, 6)::integer)
  FROM public.solicitud
 WHERE codigo_solicitud ~ '^S[0-9]{5,}$'
 GROUP BY 1, 2
ON CONFLICT (tipo, anio) DO UPDATE
  SET ultimo_valor = GREATEST(public.secuencia_codigo.ultimo_valor, EXCLUDED.ultimo_valor);


-- Normalización de donantes YA existentes (RUT sin puntos y coordenadas desde la comuna).
-- Se desactivan los triggers de usuario solo durante este UPDATE para no llenar la
-- auditoría con 80 "ediciones" generadas por el propio script.
ALTER TABLE public.donante DISABLE TRIGGER USER;
UPDATE public.donante d
   SET rut = public.fn_normalizar_rut(d.rut)
 WHERE d.rut <> public.fn_normalizar_rut(d.rut);
UPDATE public.donante d
   SET comuna   = c.nombre,
       latitud  = COALESCE(d.latitud,  c.latitud),
       longitud = COALESCE(d.longitud, c.longitud)
  FROM public.comuna c
 WHERE d.comuna IS NULL
   AND public.fn_texto_sin_acentos(c.nombre) = public.fn_texto_sin_acentos(split_part(d.ubicacion, ',', 1));
ALTER TABLE public.donante ENABLE TRIGGER USER;

-- Historial de donaciones: cada donante existente con fecha de última donación recibe UNA donación
-- inicial (carga/migración, registrado_por NULL). Solo para donantes que aún no tienen historial.
ALTER TABLE public.donacion DISABLE TRIGGER USER;
INSERT INTO public.donacion (donante_id, fecha_donacion, tipo, registrado_por, created_at)
SELECT d.id, d.fecha_ultima_donacion,
       CASE WHEN d.frecuente_plaquetas THEN 'plaquetas' ELSE 'sangre_total' END::public.tipo_donacion_enum,
       NULL, d.created_at
  FROM public.donante d
 WHERE d.fecha_ultima_donacion IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.donacion x WHERE x.donante_id = d.id);
ALTER TABLE public.donacion ENABLE TRIGGER USER;


/* =============================================================================
   15. DOCUMENTACIÓN EN EL CATÁLOGO (visible en Supabase → Table Editor / Database)
============================================================================= */
COMMENT ON TABLE public.usuario IS
  'Perfil interno del personal (rol, nombre, estado) vinculado 1:1 a auth.users. El login lo hace Supabase Auth; esta tabla define permisos. Baja lógica con activo=false.';
COMMENT ON TABLE public.donante IS
  'Ficha del donante. Datos personales sensibles: protegidos por RLS. RUT normalizado (12345678-9). Las coordenadas se derivan de la comuna.';
COMMENT ON TABLE public.consentimiento IS
  'Historial INMUTABLE de consentimientos (cookies/tratamiento de datos y autorización de contacto). Para cambiar una decisión se inserta una fila nueva. Usar la vista consentimiento_vigente.';
COMMENT ON TABLE public.etiqueta_donante IS
  'Etiquetas libres del donante (p.ej. Altruista). Las etiquetas de sistema (Fenotipo raro, Plaquetas) salen de los flags de donante.';
COMMENT ON TABLE public.solicitud IS
  'Solicitud de sangre. estado: abierta → en_proceso → cerrada. fecha_cierre se mantiene sola. Un donante solo puede estar en una solicitud activa a la vez.';
COMMENT ON TABLE public.donacion IS
  'Historial APPEND-ONLY de donaciones realizadas (sangre total o plaquetas), opcionalmente ligadas a una solicitud. Cada fila actualiza donante.fecha_ultima_donacion y, si hubo reacción, donante.reaccion_adversa_previa.';
COMMENT ON TABLE public.seguimiento_contacto IS
  'Bitácora APPEND-ONLY de intentos de contacto por solicitud (teléfono, correo, WhatsApp). Exige consentimiento de contacto vigente. Un nuevo resultado se registra como una fila nueva.';
COMMENT ON TABLE public.auditoria IS
  'Bitácora inalterable de todo lo que hacen los usuarios: sesión, navegación, consultas, cambios en tablas, acciones de administración y rechazos. No copia datos personales (nombre, RUT, contacto, ubicación): solo registra qué columnas sensibles cambiaron; el afectado se identifica por registro_id o registro_clave.';
COMMENT ON TABLE public.configuracion IS
  'Tabla independiente a propósito (clave/valor, sin relaciones). Parámetros de negocio editables por el administrador: meses entre donaciones, ubicación de la sede, MFA y validación de RUT.';
COMMENT ON TABLE public.secuencia_codigo IS
  'Tabla independiente a propósito (sin relaciones). Contadores anuales para los códigos de donante y solicitud; solo la usan funciones internas.';
COMMENT ON TABLE public.comuna IS
  'Catálogo de comunas de la Región Metropolitana con centroide aproximado. Se relaciona con donante.comuna (FK) y se usa para calcular cercanía.';

COMMENT ON COLUMN public.donante.fenotipo IS 'Notación libre (p.ej. "dCe/dce, Kell(-)"). Se compara por componentes con fn_fenotipo_cumple; distingue mayúsculas.';
COMMENT ON COLUMN public.donante.ubicacion IS 'Formato "Comuna, Ciudad". La comuna se usa para estimar distancia a la clínica.';
COMMENT ON COLUMN public.donante.comuna IS 'Derivada automáticamente de ubicacion (FK a public.comuna). No se edita directamente.';
COMMENT ON COLUMN public.donante.reaccion_adversa_previa IS 'Indica si tuvo una reacción en una donación anterior (dato pedido en la entrevista de levantamiento). El detalle va en observaciones.';
COMMENT ON COLUMN public.donante.sincronizado_registro_global IS 'Reservado para el futuro registro global entre instituciones. Sin uso en la versión 1.';
COMMENT ON COLUMN public.solicitud.reaccion IS 'Respuesta del donante a ESTA solicitud (p.ej. "Donación aceptada"). Se completa automáticamente desde la bitácora de contacto.';
COMMENT ON COLUMN public.donacion.detalle_reaccion IS 'Descripción de la reacción adversa (dato de salud: no se copia a la auditoría).';
COMMENT ON COLUMN public.donacion.registrado_por IS 'Usuario que registró la donación. NULL = carga inicial o migración.';
COMMENT ON COLUMN public.solicitud.numero_externo IS 'Número asignado en el sistema clínico del banco de sangre (trazabilidad). Opcional y único.';
COMMENT ON COLUMN public.solicitud.fecha_cierre IS 'Se fija al pasar a cerrada y se limpia al reabrir. Base del indicador de tiempo de resolución.';
COMMENT ON COLUMN public.usuario.debe_cambiar_password IS 'true = el front debe forzar cambio de contraseña en el primer inicio de sesión.';

COMMENT ON VIEW public.consentimiento_vigente IS 'Último consentimiento registrado de cada donante.';
COMMENT ON VIEW public.v_donante_listado IS 'Listado de donantes con etiquetas, "hace N meses" y disponibilidad (regla de 3 meses).';
COMMENT ON VIEW public.v_solicitud_listado IS 'Listado/detalle de solicitudes con nombre del candidato asignado y del creador.';
COMMENT ON VIEW public.v_solicitud_activa IS 'Solicitudes abiertas o en proceso, más urgentes y recientes primero (dashboard).';
COMMENT ON VIEW public.v_dashboard_resumen IS 'Indicadores del dashboard: total, fenotipos raros, plaquetas frecuentes y disponibles ahora.';
COMMENT ON VIEW public.v_dashboard_donantes_por_grupo IS 'Donantes por grupo sanguíneo (total, disponibles, fenotipos raros).';
COMMENT ON VIEW public.v_control_consentimientos IS 'Control de calidad: % de donantes con ambos consentimientos y fecha/hora (meta del Acta: 100 %).';
COMMENT ON VIEW public.v_donacion_listado IS 'Historial de donaciones con nombre del donante, código de solicitud y quién la registró.';
COMMENT ON VIEW public.v_donaciones_mensuales IS 'Donaciones por año, mes y tipo, con cuántas tuvieron reacción y cuántas fueron por solicitud.';
COMMENT ON VIEW public.v_demanda_historica IS 'Solicitudes por mes, grupo y urgencia, con días promedio de cierre.';

COMMENT ON FUNCTION public.fn_buscar_donantes_compatibles(public.grupo_sanguineo_enum, text, integer) IS
  'Candidatos compatibles priorizados por aptitud, compatibilidad exacta, cercanía y tiempo sin donar.';
COMMENT ON FUNCTION public.fn_registrar_donante(text, text, text, public.grupo_sanguineo_enum, text, date, boolean, boolean, text, text, text, text, boolean, boolean, boolean, text[], text) IS
  'Alta atómica de donante + consentimiento + etiquetas. Exige ambos consentimientos.';
COMMENT ON FUNCTION public.fn_registrar_login() IS 'Compatibilidad con la versión anterior de la app: registra LOGIN mediante fn_auditar.';
COMMENT ON FUNCTION public.fn_insertar_auditoria(uuid, text, text, uuid, text, jsonb, text, text) IS 'Interna: única escritura en auditoria, con origen, nivel de sesión, IP y navegador.';
COMMENT ON FUNCTION public.fn_auditar(text, text, uuid, jsonb) IS 'Eventos de la app (sesión, navegación, consultas, llamadas, rechazos). El autor es la sesión actual.';
COMMENT ON FUNCTION public.fn_auditar_admin(uuid, text, text, uuid, jsonb, text, text) IS 'Acciones de administración hechas desde las Edge Functions. Solo service_role.';
COMMENT ON FUNCTION public.fn_grupos_compatibles(public.grupo_sanguineo_enum) IS 'Grupos de donante compatibles con el grupo del receptor (ABO/Rh, glóbulos rojos).';
COMMENT ON FUNCTION public.fn_donante_disponible(date) IS 'Regla de los 3 meses desde la última donación.';
COMMENT ON FUNCTION public.fn_donante_disponible(date, text) IS 'Disponibilidad según los meses de espera del sexo del donante (fn_meses_espera).';
COMMENT ON FUNCTION public.fn_meses_espera(text) IS 'Meses de espera entre donaciones según el sexo del donante.';
COMMENT ON FUNCTION public.fn_hook_limite_sesion(jsonb) IS 'Hook Customize Access Token: rechaza renovar el token si la sesión tiene más de 1 hora.';
COMMENT ON COLUMN public.donante.sexo IS 'Femenino, Masculino o No especifica. Define los meses de espera entre donaciones.';
COMMENT ON FUNCTION public.fn_aplicar_donacion() IS 'Trigger: al registrar una donación actualiza la fecha de última donación del donante, su reacción previa y la solicitud asociada.';
COMMENT ON FUNCTION public.fn_rol_actual() IS 'Rol del usuario autenticado (NULL si inactivo o sin perfil). Base de las políticas RLS.';
COMMENT ON FUNCTION public.fn_puede_escribir() IS 'Personal activo con permiso de escritura (administrador o tecnólogo). TENS queda en solo lectura.';
COMMENT ON FUNCTION public.fn_registrar_auditoria() IS 'Trigger de auditoría: registra creaciones, ediciones y borrados sin copiar datos personales.';
COMMENT ON FUNCTION public.fn_manejar_nuevo_usuario_auth() IS 'Crea el perfil en public.usuario al crearse un auth.users. El rol solo se toma de app_metadata.';


/* =============================================================================
   16. CHECKLIST POSTERIOR Y PRUEBAS (todo comentado)
   -----------------------------------------------------------------------------
   A) Configuración que NO se hace por SQL (Supabase Dashboard):
      · Authentication → Providers → Email: DESACTIVAR "Allow new users to sign up"
        (los usuarios los crea el administrador con la Admin API desde una Edge Function).
      · Authentication → Attack Protection: activar CAPTCHA (hCaptcha / Turnstile)  [RF-37].
      · Authentication → Multi-Factor: habilitar TOTP                                [RF-36].
      · Authentication → Hooks: "Customize Access Token" → public.fn_hook_limite_sesion, y
        JWT expiry = 600 s (sesión máxima de 1 hora).
      · Una base creada antes de la versión 1.2.0 conserva exigir_mfa_admin = 'false' (los datos base
        no pisan valores existentes). Activarlo a mano:
          UPDATE public.configuracion SET valor = 'true' WHERE clave = 'exigir_mfa_admin';
      · Realtime → Settings: DESACTIVAR "Allow public access", para que solo existan canales
        privados y las políticas de presencia de la sección 11 no se puedan saltar.
      · Sesión 8 h e inactividad 30 min: según el plan de Supabase pueden no estar
        disponibles; si no lo están, implementar el cierre por inactividad en el front.
      · Recuperación de contraseña (ERS 3.3.2): enlace de un solo uso y 30 min de validez →
        Authentication → Email → "Email OTP Expiration" = 1800 segundos.
      · Restablecimiento forzado por el administrador (ERS 3.3.2): poner
        usuario.debe_cambiar_password = true (la política lo permite al administrador) y/o
        enviar el correo de recuperación desde una Edge Function con la Admin API.
      · La VPN (Tailscale) protege el PANEL WEB, no la API REST de Supabase: quien tenga la URL y la
        anon key puede llamarla. La barrera real son RLS + permisos de la sección 12 (anon no
        puede leer nada); no se debe exponer nunca la service_role key en el front.
      · Respaldos: el plan gratuito no garantiza backups automáticos; programar un
        `supabase db dump` periódico (p.ej. GitHub Actions) y documentarlo.
      · Crear el primer administrador (una sola vez, desde el SQL Editor):
          UPDATE public.usuario SET rol = 'administrador' WHERE correo = 'david.walker@indisa.cl';
      · Ajustar sede_latitud / sede_longitud con las coordenadas reales de la clínica:
          UPDATE public.configuracion SET valor = '-33.xxxx' WHERE clave = 'sede_latitud';

   B) Pruebas rápidas (ejecutar dentro de BEGIN; ... ROLLBACK;):
      -- Candidatos para una solicitud O- con fenotipo dce/dce:
      --   SELECT * FROM public.fn_buscar_donantes_compatibles('O-', 'dce/dce');
      -- Indicadores del dashboard:
      --   SELECT * FROM public.v_dashboard_resumen;
      -- Historial de donaciones de un donante y análisis mensual:
      --   SELECT * FROM public.v_donacion_listado WHERE codigo_donante = '2026001' ORDER BY fecha_donacion DESC;
      --   SELECT * FROM public.v_donaciones_mensuales LIMIT 12;
      -- Registrar una donación del donante asignado a una solicitud (el donante se toma de la solicitud):
      --   INSERT INTO public.donacion (solicitud_id, tipo) VALUES ('<id_solicitud>', 'sangre_total');
      -- Meta del Acta (100 % de donantes con ambos consentimientos y fecha/hora):
      --   SELECT * FROM public.v_control_consentimientos;
      --   (si hay filas con fecha NULL en datos antiguos, completar con created_at desde el
      --    SQL Editor: UPDATE public.consentimiento SET
      --      fecha_cookies = COALESCE(fecha_cookies, created_at),
      --      fecha_autoriza_contacto = COALESCE(fecha_autoriza_contacto, created_at);)
      -- Códigos de error esperados:
      --   RS001 → fn_registrar_donante(..., p_autoriza_contacto => false)
      --   RS002 → insertar seguimiento_contacto de un donante sin consentimiento de contacto
      --   RS003 → asignar un donante que donó hace menos de 3 meses
      --   RS004 → asignar un donante de grupo incompatible
      --   RS005 → insertar un contacto en una solicitud cerrada
============================================================================= */
