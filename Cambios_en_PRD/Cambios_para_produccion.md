# RedSangre — Cambios al pasar a producción (sitio público con URL)

Documento de trabajo. Lista todo lo que hay que cambiar, configurar o decidir cuando la aplicación deje de correr en `localhost` y se publique en una URL pública.

- **Fecha del análisis:** 2026-11-04
- **Proyecto Supabase actual:** `igipfzkmpkkgcabopbhs` (compartido por el equipo, con datos simulados)
- **Aplicación:** `Fase 2/RedSangre` (React + Vite + Supabase)
- **URL pública:** por definir (`https://<URL_PUBLICA>` en este documento)
- **Quién hace cada cosa:** *Jose* = acciones en el panel de Supabase, en el hosting o con SQL (según el `CLAUDE.md`, el asistente no ejecuta nada contra Supabase). *Código* = cambio en el repositorio, con su commit.

Estado de cada punto: `[ ]` pendiente · `[x]` hecho.

---

## 0. Decisiones previas (bloquean el resto)

- [ ] **Hosting de la aplicación.** Elegir dónde se publica (Vercel, Netlify, Cloudflare Pages, servidor propio, etc.). Determina la URL, cómo se declaran las variables y cómo se configura la reescritura de rutas (ver punto 3).
- [ ] **¿Mismo proyecto de Supabase o uno nuevo para producción?** Hoy el proyecto es compartido y tiene usuarios y datos de prueba.
  - *Mismo proyecto:* menos trabajo, pero producción y pruebas comparten base, usuarios y claves.
  - *Proyecto nuevo:* hay que repetir el script de base de datos, las configuraciones de Auth, los secretos y el despliegue de las funciones, y cambiar `VITE_SUPABASE_URL`, la clave y el `project-ref` del CLI.
- [ ] **¿Qué datos habrá en producción?** El `CLAUDE.md` y el Acta exigen solo datos simulados. Si sigue siendo así, el sitio público es una demostración y se mantienen los datos simulados. Si se usaran datos reales, cambia todo el análisis de privacidad (consentimientos, respaldos, acceso).
- [ ] **¿Quiénes serán administradores?** Hoy solo `jm.hernandez@duocuc.cl` es administrador.
- [ ] **Plan de Supabase.** Un proyecto gratuito se **pausa tras un período de inactividad** (alrededor de una semana) y no garantiza respaldos automáticos. Para un sitio público conviene confirmar el plan o aceptar ese riesgo.

---

## 1. URL y Autenticación (panel de Supabase) — Jose

**Authentication → URL Configuration**
- [ ] **Site URL** → `https://<URL_PUBLICA>`. Hoy el archivo `config.toml` local dice `http://127.0.0.1:3000` y la app corre en `localhost:5173`; ninguno sirve en producción.
- [ ] **Redirect URLs** → agregar `https://<URL_PUBLICA>/**`. Dejar `http://localhost:5173/**` solo si se sigue desarrollando contra el mismo proyecto; si no, quitarlo.

**Authentication → Providers → Email**
- [ ] **Allow new users to sign up: DESACTIVAR.** Los usuarios los crea solo el administrador con la Edge Function. Con el registro abierto, cualquiera con la URL y la clave pública podría crearse una cuenta. (El `config.toml` local lo tiene en `true`; hay que verificar el valor real del proyecto en el panel.)
- [ ] **Confirm email: ACTIVAR** (necesario para la activación de cuentas por correo, tarea C).
- [ ] **Email OTP Expiration** → 1800 segundos (30 min), según ERS 3.3.2. Revisar también la duración del enlace de activación.
- [ ] **Longitud mínima y requisitos de contraseña** → mínimo 8, con letras, números y símbolos, igual que la política de la aplicación (`politicaContrasena.ts` y las funciones). Es la protección del servidor para el cambio de contraseña del primer inicio de sesión, que se hace desde el navegador.

**Authentication → Attack Protection**
- [ ] **CAPTCHA** (hCaptcha o Turnstile), RF-37. Requiere además integrarlo en `LoginPage.tsx` (cambio de código).

**Authentication → Multi-Factor**
- [ ] Habilitar **TOTP**, RF-36. Se activa junto con la doble autenticación del próximo sprint (ver punto 4).

**Authentication → Sessions / Rate limits**
- [ ] Revisar duración de sesión y tiempo de inactividad según el plan (el script de la base indica 8 h de sesión y 30 min de inactividad). Si el plan no lo permite, ver el punto 3 (cierre por inactividad en el frontend).
- [ ] **SMTP propio.** El correo integrado de Supabase tiene límites muy bajos de envíos por hora. Configurar un SMTP propio si Auth debe enviar correos (activación, recuperación de contraseña).

**Realtime → Settings**
- [ ] **Desactivar "Allow public access"**, para que solo existan canales privados. La presencia de usuarios depende de las políticas de canales privados.

---

## 2. Edge Functions — Jose y Código

Funciones actuales: `crear-usuario`, `cambiar-contrasena`, `enviar-correo-contacto`.

- [ ] **Secreto `APP_URL`** con `https://<URL_PUBLICA>` (lo usará `crear-usuario` para el enlace de activación, tarea C). *Jose:* `npx supabase secrets set APP_URL=https://<URL_PUBLICA>`.
- [ ] **CORS: restringir el origen.** Las tres funciones responden `Access-Control-Allow-Origin: '*'`. En producción debe ser solo `https://<URL_PUBLICA>`. *Código:* leer el origen permitido de un secreto (por ejemplo `APP_URL`) y redesplegar las tres funciones.
- [ ] **Secretos de correo:** `GMAIL_USER` y `GMAIL_APP_PASSWORD` (los usa `enviar-correo-contacto`).
  - Decidir si producción seguirá enviando desde `redsangre.notificaciones@gmail.com` o desde una cuenta institucional.
  - Gmail SMTP tiene límite diario de envíos y puede mandar a spam.
  - La contraseña de aplicación nunca va en el código ni en el chat.
- [ ] **Teléfono y correo de contacto del Banco de Sangre.** La constante `CONTACTO_BANCO` de `enviar-correo-contacto/index.ts` tiene un número de teléfono; confirmar que sea el real.
- [ ] **Redesplegar todas las funciones** después de los cambios: `npx supabase functions deploy <nombre>`, y revisar los logs de cada una.
- [ ] Confirmar que `verify_jwt` sigue activo para las funciones (es el valor por defecto; el `config.toml` no lo cambia).

---

## 3. Aplicación web (frontend) y despliegue — Código y Jose

**Variables de entorno en el hosting**
- [ ] `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` deben declararse en el panel del hosting (el archivo `.env` está ignorado por Git y **no se sube**). Solo la clave pública, nunca la `service_role` ni una clave secreta.
- [ ] Recordar que las variables `VITE_` se incrustan al compilar: si cambian, hay que volver a compilar.

**Compilación**
- [ ] El comando es `npm run build` (`tsc -b && vite build`), que genera `dist/`. Hoy compila los tipos sin errores, pero hay que repetirlo en el entorno del hosting.
- [ ] **El lint falla.** `npm run lint` reporta 9 errores que ya existían en `DonanteFichaPage.tsx`, `SolicitudesListPage.tsx` y otros. No bloquean la compilación, pero si el despliegue ejecuta el lint, se detendrá. Corregirlos o no incluir el lint en el despliegue.

**Rutas de la aplicación (SPA)**
- [ ] **Reescritura de rutas al `index.html`.** La app usa `BrowserRouter`. Si alguien recarga la página en `/donantes` o abre el enlace de activación, el servidor devolverá 404 a menos que se configure la reescritura. No existe `vercel.json`, `_redirects` ni configuración equivalente en el repositorio. Hay que agregarlo según el hosting elegido (en Nginx: `try_files $uri /index.html`).

**HTTPS y cabeceras de seguridad (hosting)**
- [ ] HTTPS obligatorio, con redirección desde HTTP y HSTS.
- [ ] Cabeceras `X-Frame-Options` (o `frame-ancestors`), `X-Content-Type-Options`, `Referrer-Policy` y una `Content-Security-Policy` que permita solo el dominio de Supabase.

**Sesión**
- [ ] **Cierre de sesión por inactividad (30 min).** Hoy la aplicación no lo implementa. El ERS 3.3.2 y el script de la base lo piden. Si el plan de Supabase no lo ofrece, implementarlo en el frontend.

**Contenido de la página**
- [ ] `index.html`: el título dice `redsangre` y el idioma `en`. Cambiar a `RedSangre – Clínica Indisa` y `lang="es"`. Revisar el favicon.

**Limpieza del repositorio**
- [ ] `src/supabase.ts` es un cliente duplicado (sin la comprobación de variables faltantes de `src/utils/supabase.ts`). Confirmar que nada lo importa y eliminarlo.
- [ ] `Fase 2/index.html` y `Fase 2/package-lock.json` están sueltos fuera de la aplicación. Revisar si se eliminan.
- [ ] En `package.json`, la dependencia `supabase` (el CLI) está en `dependencies`. Debería ir en `devDependencies`.
- [ ] `README.md` está en inglés y desactualizado (dice que los usuarios "deben existir en Auth"). Reescribirlo con el procedimiento de despliegue de este documento.
- [ ] `scripts/pruebas-seguridad.mjs` necesita credenciales por variables de entorno. Nunca guardarlas en el repositorio.

---

## 4. Restricciones de correo y roles (código)

- [ ] **Dominios permitidos.** Hoy se aceptan `gmail.com`, `duocuc.cl` e `indisa.cl` (decisión para el prototipo). En producción institucional conviene dejar solo `indisa.cl`. Se cambia en **dos lugares que deben coincidir**: `src/utils/validacionCorreo.ts` y la función `supabase/functions/crear-usuario/index.ts`. Después, redesplegar `crear-usuario`.
- [ ] **Restricción en la base (opcional).** El script trae comentada `ck_usuario_correo_dominio` (`correo LIKE '%@indisa.cl'`). Si se quiere reforzar en la base, la ejecuta Jose revisando antes que los usuarios existentes la cumplan.
- [ ] **Doble autenticación (próximo sprint).** Implementar el flujo TOTP en el frontend y luego poner `configuracion.exigir_mfa_admin = 'true'` (lo ejecuta Jose). Si se activa antes de tener el flujo, el administrador queda sin acceso a las acciones de administración.
- [ ] **Invitación en lugar de contraseña temporal.** Evaluar junto con la doble autenticación (el administrador deja de conocer la contraseña).

---

## 5. Base de datos y datos — Jose

- [ ] **Usuarios de prueba.** Eliminar o desactivar los que no deben existir en producción (por ejemplo `jose.4dbs@gmail.com`, `tecnico@indisa.cl`). Revisar `debe_cambiar_password` de las cuentas del equipo.
- [ ] **Usuarios pendientes creados durante el desarrollo.** Sus enlaces de activación apuntan a `localhost`. Reenviar la activación (botón "Reenviar correo", tarea C) o borrarlos y crearlos de nuevo.
- [ ] **Datos simulados.** Decidir si se conservan para la demostración o se limpian. El script `redsangre_ingesta_datos_simulados.sql` no se ejecuta en producción si se usarán datos reales.
- [ ] **Parámetros de negocio** (tabla `configuracion`): `sede_latitud` y `sede_longitud` con las coordenadas reales de la clínica, meses entre donaciones, validación de RUT.
- [ ] **Respaldos.** El plan gratuito no garantiza respaldos automáticos. Programar un `supabase db dump` periódico (por ejemplo con GitHub Actions) y documentarlo.
- [ ] **Revisión de RLS y permisos.** Volver a ejecutar `scripts/pruebas-seguridad.mjs` contra producción y confirmar que `anon` no lee nada y que un tecnólogo no accede a la administración.
- [ ] Mantener los archivos `.sql` fuera del repositorio (ya están en `.gitignore`).
- [ ] Si se usa un proyecto nuevo: ejecutar `redsangre_base_de_datos.sql`, crear el primer administrador (`UPDATE public.usuario SET rol = 'administrador' WHERE correo = '...'`) y repetir todo el punto 1.

---

## 6. Repositorio y equipo — Jose

- [ ] Confirmar que el repositorio de GitHub sea **privado** (contiene documentos del proyecto). Las claves reales nunca se han subido (`.env` ignorado).
- [ ] Decidir si `Fase 2/RedSangre/CLAUDE.md` se versiona. No contiene secretos, pero sí rutas locales.
- [ ] Definir quién tiene acceso al hosting, al panel de Supabase y al correo remitente, y dejarlo anotado.

---

## 7. Verificación después de publicar (humo)

1. Abrir `https://<URL_PUBLICA>`: carga el login sin errores en la consola.
2. Recargar la página en `/donantes`, `/solicitudes` y `/configuracion`: no da 404.
3. Iniciar sesión como administrador y como tecnólogo; el tecnólogo no ve Configuración.
4. Cerrar sesión, e intentar abrir una ruta protegida: redirige al login.
5. Crear un usuario de prueba: llega el correo, el enlace lleva a la URL pública y la cuenta se activa.
6. Entrar con la contraseña temporal: pide crear una contraseña nueva que cumpla la política.
7. Desactivar el usuario de prueba y comprobar que no puede entrar.
8. Intentar crear un usuario con un correo duplicado y con un dominio no permitido: se rechaza.
9. Enviar un correo de contacto a un donante de prueba: llega y queda registrado en la bitácora.
10. Ejecutar `scripts/pruebas-seguridad.mjs` y confirmar que todo pasa.
11. Comprobar que desde otro origen las funciones rechazan la llamada (CORS restringido).

---

## 8. Orden recomendado

1. Decisiones del punto 0.
2. Cambios de código (puntos 2, 3 y 4) con un commit por tarea, y redesplegar las funciones.
3. Configuración del panel (punto 1) y secretos (punto 2).
4. Base de datos y limpieza de usuarios (punto 5).
5. Publicar la aplicación en el hosting (punto 3).
6. Verificación completa (punto 7).
