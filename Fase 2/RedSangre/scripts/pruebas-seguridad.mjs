// Pruebas de seguridad de la pestaña Configuración (solo administrador).
// Uso, desde "Fase 2/RedSangre", con las credenciales en variables de entorno:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... TECNO_EMAIL=... TECNO_PASSWORD=... \
//   node --env-file=.env scripts/pruebas-seguridad.mjs
// Las únicas escrituras son intentos que deben ser rechazados; si alguno prospera, el script lo revierte.
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
const { ADMIN_EMAIL, ADMIN_PASSWORD, TECNO_EMAIL, TECNO_PASSWORD } = process.env;
if (!url || !key || !ADMIN_EMAIL || !ADMIN_PASSWORD || !TECNO_EMAIL || !TECNO_PASSWORD) {
  console.error('Faltan variables de entorno (ver comentario al inicio del archivo).');
  process.exit(2);
}

let fallos = 0;
const verificar = (nombre, ok, detalle = '') => {
  if (!ok) fallos++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre}${detalle ? `  (${detalle})` : ''}`);
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function iniciarSesion(email, password) {
  const cliente = createClient(url, key);
  const { data, error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar sesión con ${email}: ${error.message}`);
  await cliente.realtime.setAuth(data.session.access_token);
  return { cliente, id: data.user.id };
}

// Se une al canal privado de un usuario; si anunciar es true, además se anuncia en él.
async function unirseACanal(cliente, idDueno, anunciar) {
  const canal = cliente.channel(`presencia:${idDueno}`, { config: { private: true, presence: { enabled: true } } });
  await new Promise((resolve) => {
    canal.subscribe((estado, err) => {
      canal.estado = err ? `${estado}: ${err.message}` : estado;
      if (estado === 'SUBSCRIBED') {
        if (anunciar) canal.track({ prueba: true });
        resolve();
      }
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') resolve();
    });
  });
  return canal;
}

const anon = createClient(url, key);
const admin = await iniciarSesion(ADMIN_EMAIL, ADMIN_PASSWORD);
const tecno = await iniciarSesion(TECNO_EMAIL, TECNO_PASSWORD);

// Sin sesión
{
  const { data } = await anon.from('usuario').select('id');
  verificar('Sin sesión no lee usuario', !data || data.length === 0);
}

// Tecnólogo: datos
{
  const { data } = await tecno.cliente.from('usuario').select('id');
  verificar('Tecnólogo solo ve su propia fila de usuario', data?.length === 1 && data[0].id === tecno.id, `filas: ${data?.length}`);
}
{
  const { data } = await tecno.cliente.from('auditoria').select('id').limit(5);
  verificar('Tecnólogo no lee auditoria', !data || data.length === 0);
}
{
  const { data: cfg } = await tecno.cliente.from('configuracion').select('clave, valor').limit(1).single();
  const { data } = await tecno.cliente.from('configuracion').update({ valor: cfg.valor }).eq('clave', cfg.clave).select();
  verificar('Tecnólogo no puede editar configuracion', !data || data.length === 0);
}
{
  const { error } = await tecno.cliente.from('usuario').update({ rol: 'administrador' }).eq('id', tecno.id);
  const { data: tras } = await admin.cliente.from('usuario').select('rol').eq('id', tecno.id).single();
  if (tras?.rol !== 'tecnologo') await admin.cliente.from('usuario').update({ rol: 'tecnologo' }).eq('id', tecno.id);
  verificar('Tecnólogo no puede subirse a administrador', Boolean(error) && tras?.rol === 'tecnologo', error?.code);
}

// Tecnólogo: sigue viendo quién creó cada registro
{
  const { data } = await tecno.cliente.from('v_solicitud_listado').select('creado_por, creado_por_nombre').not('creado_por', 'is', null).limit(20);
  verificar('Tecnólogo ve el creador en solicitudes', data?.length > 0 && data.every((f) => f.creado_por_nombre), `filas: ${data?.length}`);
}
{
  const { data } = await tecno.cliente.from('v_donacion_listado').select('registrado_por, registrado_por_nombre').not('registrado_por', 'is', null).limit(20);
  verificar('Tecnólogo ve quién registró cada donación', data?.length > 0 && data.every((f) => f.registrado_por_nombre), `filas: ${data?.length}`);
}

// Administrador
{
  const { data } = await admin.cliente.from('usuario').select('id');
  verificar('Administrador ve todos los usuarios', data?.length > 1, `filas: ${data?.length}`);
}
{
  const { data } = await admin.cliente.from('auditoria').select('id').limit(1);
  verificar('Administrador lee auditoria', data?.length === 1);
}

// Crear usuario (Edge Function crear-usuario): solo intentos que deben ser rechazados, no crean cuentas.
// Requiere la función desplegada. Las pruebas de creación exitosa y de correo duplicado se hacen a mano.
{
  const intento = async (cliente, cuerpo) => {
    const { data: { session } } = await cliente.auth.getSession();
    const { error } = await cliente.functions.invoke('crear-usuario', {
      body: cuerpo,
      headers: { Authorization: `Bearer ${session?.access_token ?? key}` },
    });
    return error?.context?.status;
  };
  const valido = { nombre: 'Prueba', apellido: 'Seguridad', correo: 'prueba.seguridad@indisa.cl', rol: 'tecnologo' };

  verificar('Crear usuario sin sesión es rechazado (401)', (await intento(anon, valido)) === 401);
  verificar('Tecnólogo no puede crear usuarios (403)', (await intento(tecno.cliente, valido)) === 403);
  verificar('Rol inválido es rechazado (422)', (await intento(admin.cliente, { ...valido, rol: 'superadmin' })) === 422);
  verificar('Correo inválido es rechazado (422)', (await intento(admin.cliente, { ...valido, correo: 'sin-formato' })) === 422);
  verificar('Dominio no permitido es rechazado (422)', (await intento(admin.cliente, { ...valido, correo: 'prueba@mailinator.com' })) === 422);
  verificar('Correo con formato estricto inválido es rechazado (422)', (await intento(admin.cliente, { ...valido, correo: 'a..b@indisa.cl' })) === 422);
  verificar('Correo duplicado es rechazado (409)', (await intento(admin.cliente, { ...valido, correo: ADMIN_EMAIL })) === 409);
  verificar('Correo duplicado en mayúsculas es rechazado (409)', (await intento(admin.cliente, { ...valido, correo: ADMIN_EMAIL.toUpperCase() })) === 409);
  verificar('Nombre vacío es rechazado (400)', (await intento(admin.cliente, { ...valido, nombre: '  ' })) === 400);

  // Reenviar activación: solo intentos rechazados; un reenvío válido envía un correo real y se prueba a mano.
  const reenviar = async (cliente, idUsuario) => {
    const { data: { session } } = await cliente.auth.getSession();
    const { error } = await cliente.functions.invoke('reenviar-activacion', {
      body: { usuario_id: idUsuario },
      headers: { Authorization: `Bearer ${session?.access_token ?? key}` },
    });
    return error?.context?.status;
  };
  verificar('Reenviar activación sin sesión es rechazado (401)', (await reenviar(anon, tecno.id)) === 401);
  verificar('Tecnólogo no puede reenviar activaciones (403)', (await reenviar(tecno.cliente, tecno.id)) === 403);
  verificar('Reenviar a un usuario que ya activó su cuenta es rechazado (409)', (await reenviar(admin.cliente, admin.id)) === 409);

  const { data } = await admin.cliente.from('usuario').select('id').eq('correo', valido.correo);
  verificar('Ningún intento rechazado creó el usuario', data?.length === 0, `filas: ${data?.length}`);
}

// Presence privado, un canal por usuario
{
  const propioTecno = await unirseACanal(tecno.cliente, tecno.id, true);
  const propioAdmin = await unirseACanal(admin.cliente, admin.id, true);
  const adminEnTecno = await unirseACanal(admin.cliente, tecno.id, false);
  const tecnoEnAdmin = await unirseACanal(tecno.cliente, admin.id, false);
  await esperar(4000);
  const tecnoVisto = Object.keys(adminEnTecno.presenceState()).length;
  verificar('Tecnólogo se anuncia en su propio canal', propioTecno.estado === 'SUBSCRIBED', propioTecno.estado);
  verificar('Administrador ve al tecnólogo conectado', adminEnTecno.estado === 'SUBSCRIBED' && tecnoVisto > 0, `canal: ${adminEnTecno.estado}, presentes: ${tecnoVisto}`);
  verificar('Tecnólogo no puede leer el canal del administrador', tecnoEnAdmin.estado !== 'SUBSCRIBED', tecnoEnAdmin.estado);
  for (const [cliente, canal] of [[tecno, propioTecno], [admin, propioAdmin], [admin, adminEnTecno], [tecno, tecnoEnAdmin]]) {
    await cliente.cliente.removeChannel(canal);
  }
}

await admin.cliente.auth.signOut();
await tecno.cliente.auth.signOut();
console.log(fallos === 0 ? '\nTodas las pruebas pasaron.' : `\n${fallos} prueba(s) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
