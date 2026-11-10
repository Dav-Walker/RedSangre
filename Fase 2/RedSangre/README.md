# RedSangre

Sistema web de gestión de donantes y solicitudes de sangre para el Banco de Sangre de Clínica Indisa.
Prototipo académico (Portafolio de Título, Duoc UC) que trabaja solo con datos simulados.

## Tecnologías

- React 19, TypeScript y Vite.
- Supabase: PostgreSQL con RLS, Auth (contraseña, captcha Turnstile y segundo factor TOTP) y Edge Functions (Deno).
- Correo por el SMTP del hosting (`notificaciones@redsangre.cl`) con nodemailer, desde las Edge Functions.
- Vitest para las pruebas unitarias.

## Puesta en marcha

1. Copia `.env.example` a `.env` y completa los valores de tu proyecto de Supabase:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publicable
   VITE_TURNSTILE_SITE_KEY=tu-site-key-de-turnstile
   ```

   En el navegador solo va la clave publicable (o la anon key antigua). Nunca pongas la service role
   ni otra clave secreta en una variable `VITE_`. El archivo `.env` está en `.gitignore`.
   Después de cambiar el `.env`, reinicia el servidor de desarrollo.

2. Instala las dependencias y levanta la aplicación (usar Git Bash; PowerShell bloquea `npm`):

   ```sh
   npm install
   npm run dev
   ```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173`. |
| `npm run build` | Revisa los tipos y genera `dist/` para el hosting. |
| `npm run typecheck` | Revisa los tipos sin generar archivos. |
| `npm run lint` | ESLint. |
| `npm test` | Pruebas unitarias de `src/utils` (no tocan la base). |
| `npm run test:seguridad` | Pruebas de permisos contra Supabase (`scripts/pruebas-seguridad.mjs`). Necesita en el entorno `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TECNO_EMAIL` y `TECNO_PASSWORD`. |
| `npm run desplegar` | Compila y sube `dist/` a `public_html` por FTPS (`scripts/desplegar.mjs`). Necesita en `.env` `FTP_HOST`, `FTP_USUARIO` y `FTP_CONTRASENA`. Con `npm run desplegar -- --limpiar` borra además los archivos viejos de `assets/`. |
| `npm run tipos` | Regenera `src/tipos/database.types.ts` desde el esquema de Supabase (requiere `npx supabase login`). |

## Estructura

```
src/
  pages/         Una carpeta por módulo: auth, dashboard, donantes, solicitudes, configuracion.
  servicios/     Consultas y escrituras a Supabase. Las páginas no llaman a Supabase directamente.
  components/    Componentes compartidos: Badge, Button, Modal, Navbar y rutas por rol.
  contexts/      Sesión, perfil del usuario y segundo factor.
  utils/         Funciones puras (fechas, validaciones, etiquetas, gráficos) y el cliente de Supabase.
  tipos/         Tipos generados del esquema de la base y alias del dominio.
supabase/
  functions/     Edge Functions: crear-usuario, reenviar-activacion, cambiar-contrasena y enviar-correo-contacto.
    _shared/     Código común: CORS, respuestas, verificación de administrador, correo y validaciones.
  config.toml    Configuración local del CLI de Supabase.
scripts/         Pruebas de seguridad y despliegue al hosting.
public/          Archivos estáticos, incluido el .htaccess del hosting (HTTPS y rutas de la SPA).
```

Las reglas de correo y de contraseña viven una sola vez en `supabase/functions/_shared/validaciones.ts`;
el frontend las importa desde `src/utils`, así el formulario y el servidor aplican exactamente lo mismo.

## Base de datos

El script de la base y los datos simulados están fuera del repositorio. Varias reglas de negocio viven en
triggers y funciones de la base (por ejemplo RS002, contacto sin consentimiento, y RS005, solicitud cerrada),
así que conviene revisar el script antes de cambiar una regla en el frontend.

## Edge Functions

Secretos que usan (se configuran en Supabase → Edge Functions → Secrets):

| Secreto | Uso |
|---|---|
| `APP_URL` | URL pública de la aplicación (`https://redsangre.cl`). Arma los enlaces de activación y el origen permitido por CORS. Es obligatorio. |
| `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD` | Servidor SMTP del hosting, cuenta (`notificaciones@redsangre.cl`) y su contraseña para enviar correos. Puerto 465 fijo en el código. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los entrega Supabase automáticamente.

Para probarlas en local, crea `supabase/functions/.env` con `APP_URL=http://localhost:5173` y los secretos
SMTP, y ejecuta `npx supabase functions serve`. Para publicar un cambio:

```sh
npx supabase functions deploy <nombre>
```

## Despliegue del frontend

`npm run build` genera `dist/`. Su contenido (que incluye `public/.htaccess`) se sube a `public_html` del hosting.
