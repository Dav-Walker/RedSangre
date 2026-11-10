// Comentarios - Despliegue al hosting
// Sube el contenido de dist/ a public_html por FTPS (FTP cifrado). Se ejecuta con "npm run desplegar", que antes
// compila la aplicación. Las credenciales se leen del .env, que no se sube a git.
// Con "npm run desplegar -- --limpiar" además borra los archivos viejos de assets/ que el build nuevo ya no usa.
import { Client } from 'basic-ftp';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { FTP_HOST, FTP_USUARIO, FTP_CONTRASENA } = process.env;
const CARPETA_REMOTA = process.env.FTP_CARPETA || '/';
const DIST = 'dist';
const limpiar = process.argv.includes('--limpiar');

if (!FTP_HOST || !FTP_USUARIO || !FTP_CONTRASENA) {
  console.error('Faltan FTP_HOST, FTP_USUARIO o FTP_CONTRASENA en el archivo .env.');
  process.exit(1);
}
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No existe dist/index.html: el build no se generó.');
  process.exit(1);
}

// Comentarios - Despliegue al hosting
// Primero se suben las carpetas (assets/) y después los archivos de la raíz, con index.html al final:
// así nadie recibe una página que apunte a archivos que todavía no terminaron de subir.
const entradas = readdirSync(DIST);
const carpetas = entradas.filter((nombre) => statSync(join(DIST, nombre)).isDirectory());
const archivos = entradas
  .filter((nombre) => statSync(join(DIST, nombre)).isFile() && !nombre.endsWith('.zip'))
  .sort((a, b) => Number(a === 'index.html') - Number(b === 'index.html'));

const cliente = new Client(60_000);

try {
  // Comentarios - Despliegue al hosting
  // secure: true usa FTP con TLS explícito y valida el certificado del servidor: la contraseña nunca viaja en claro.
  await cliente.access({ host: FTP_HOST, user: FTP_USUARIO, password: FTP_CONTRASENA, secure: true });
  await cliente.cd(CARPETA_REMOTA);
  console.log(`Conectado a ${FTP_HOST}, carpeta ${await cliente.pwd()}`);

  for (const carpeta of carpetas) {
    console.log(`Subiendo ${carpeta}/ ...`);
    await cliente.uploadFromDir(join(DIST, carpeta), carpeta);
  }
  for (const archivo of archivos) {
    console.log(`Subiendo ${archivo}`);
    await cliente.uploadFrom(join(DIST, archivo), archivo);
  }

  // Comentarios - Limpieza de archivos viejos
  // Solo con --limpiar y solo dentro de assets/. Por defecto se conservan: una pestaña abierta con la versión
  // anterior todavía puede pedir esos archivos al cambiar de página.
  if (limpiar && carpetas.includes('assets')) {
    const actuales = new Set(readdirSync(join(DIST, 'assets')));
    const remotos = await cliente.list('assets');
    const viejos = remotos.filter((f) => f.isFile && !actuales.has(f.name));
    for (const f of viejos) await cliente.remove(`assets/${f.name}`);
    console.log(`Archivos viejos borrados de assets/: ${viejos.length}`);
  }

  console.log('Despliegue terminado: https://redsangre.cl');
} catch (error) {
  console.error('El despliegue falló:', error.message);
  process.exitCode = 1;
} finally {
  cliente.close();
}
