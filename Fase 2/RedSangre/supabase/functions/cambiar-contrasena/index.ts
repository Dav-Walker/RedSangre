// Comentarios - Cambiar contraseña desde Configuración
// Edge Function con la que un administrador activo (con código TOTP) fija una contraseña nueva a otro usuario.
// Usa la service role porque Auth solo permite cambiar contraseñas ajenas con la API de administración.
import { verificarAdministrador } from '../_shared/administrador.ts';
import { auditarAdmin } from '../_shared/auditoria.ts';
import { clienteAdmin } from '../_shared/clientes.ts';
import { conCors } from '../_shared/cors.ts';
import { responder, revisarMetodo } from '../_shared/respuesta.ts';
import { validarContrasena } from '../_shared/validaciones.ts';

Deno.serve(conCors(async (req) => {
  const respuestaMetodo = revisarMetodo(req);
  if (respuestaMetodo) return respuestaMetodo;

  // Comentarios - Cambiar contraseña desde Configuración
  // 1. Verifica que quien llama sea un administrador activo con la sesión en aal2.
  const verificacion = await verificarAdministrador(req, 'cambiar contraseñas');
  if ('respuesta' in verificacion) return verificacion.respuesta;

  // Comentarios - Cambiar contraseña desde Configuración
  // 2. Lee los parámetros y repite la política de contraseña del formulario.
  let usuarioId: string | undefined;
  let nuevaContrasena: string | undefined;
  try {
    ({ usuario_id: usuarioId, nueva_contrasena: nuevaContrasena } = await req.json());
  } catch {
    return responder({ error: 'Cuerpo inválido' }, 400);
  }

  if (!usuarioId || !nuevaContrasena) return responder({ error: 'Faltan parámetros' }, 400);
  const errorPolitica = validarContrasena(nuevaContrasena);
  if (errorPolitica) return responder({ error: errorPolitica }, 422);

  // Comentarios - Cambiar contraseña desde Configuración
  // 3. Cambia la contraseña con el cliente de administración.
  const { error: errCambio } = await clienteAdmin().auth.admin.updateUserById(usuarioId, {
    password: nuevaContrasena,
  });

  if (errCambio) {
    console.error('Error al cambiar contraseña:', errCambio);
    return responder({ error: 'No se pudo actualizar la contraseña' }, 500);
  }

  // Comentarios - Bitácora completa
  // Registra qué administrador cambió la contraseña y de qué usuario (la contraseña nunca se guarda).
  await auditarAdmin(req, verificacion.usuarioId, 'CAMBIAR_CONTRASENA', { tabla: 'usuario', registroId: usuarioId });

  return responder({ ok: true });
}));
