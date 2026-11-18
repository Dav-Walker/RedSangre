// Comentarios - Sesión y perfil del usuario
// Proveedor de autenticación: sesión de Supabase, perfil, límite de 1 hora, código TOTP y cambio de contraseña.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabase';
import { AuthContext, type ErrorPerfil, type MotivoCierre, type UserProfile } from './auth-context';
import { DURACION_SESION_MS, obtenerInicioSesion } from '../utils/duracionSesion';
import { leerClaimsToken } from '../utils/tokenSesion';
import { mensajeErrorAuth } from '../utils/mensajesAuth';
import { EVENTO_SESION_EXPIRADA, MENSAJE_SIN_CONEXION } from '../utils/mensajesError';
import { registrarEvento } from '../servicios/auditoria';

const MENSAJE_CUENTA_DESACTIVADA = 'Tu cuenta está desactivada. Contacta al administrador.';
// Comentarios - Manejo de errores y excepciones
// El detalle técnico (archivo .env) solo se muestra en desarrollo; en producción, un aviso general.
const MENSAJE_SIN_CONFIGURACION = import.meta.env.DEV
  ? 'Supabase no está configurado. Revisa las variables del archivo .env.'
  : 'El sistema no está disponible en este momento. Contacta al administrador.';

// Comentarios - Segundo factor TOTP (RF-36)
// Traduce los errores de MFA de Supabase Auth a mensajes en español para la pantalla de verificación
function mensajeErrorDosPasos(error: { code?: string } | null): string {
  // Comentarios - Manejo de errores y excepciones
  // Sin conexión, Auth no entrega código: se avisa la falta de conexión en vez del mensaje genérico.
  if (isAuthRetryableFetchError(error)) return MENSAJE_SIN_CONEXION;
  switch (error?.code) {
    case 'mfa_verification_failed':
    case 'mfa_challenge_expired':
      return 'El código no es correcto o ya cambió. Ingresa el código que muestra ahora la app y revisa que la hora del celular esté en automático.';
    case 'over_request_rate_limit':
      return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    case 'mfa_totp_enroll_not_enabled':
    case 'mfa_totp_verify_not_enabled':
      return 'La verificación en dos pasos no está disponible. Contacta al administrador.';
    default:
      return 'No se pudo completar la verificación en dos pasos. Inténtalo nuevamente.';
  }
}

// Comentarios - Carga del perfil de usuario
// Lee el perfil (tabla usuario) del usuario autenticado.
// Comentarios - Manejo de errores y excepciones
// Distingue una cuenta sin perfil ('sin_perfil') de una falla al leerlo ('error'), para mostrar el aviso que corresponde.
async function cargarPerfil(id: string): Promise<{ perfil: UserProfile | null; error: ErrorPerfil | null }> {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, correo, rol, activo, debe_cambiar_password')
      .eq('id', id)
      .maybeSingle();
    if (error) return { perfil: null, error: 'error' };
    if (!data) return { perfil: null, error: 'sin_perfil' };
    return { perfil: data, error: null };
  } catch {
    return { perfil: null, error: 'error' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const userId = session?.user.id;
  // Comentarios - Carga del perfil de usuario
  // authListo: ya llegó el primer evento de Auth. perfilCargadoDe: id del usuario cuyo perfil ya se leyó.
  // La app espera ambos antes de mostrar rutas, para que las rutas por rol no vean un perfil vacío.
  const [authListo, setAuthListo] = useState(!isSupabaseConfigured);
  const [perfilCargadoDe, setPerfilCargadoDe] = useState<string | null>(null);
  const loading = !authListo || (userId !== undefined && perfilCargadoDe !== userId);
  // Comentarios - Manejo de errores y excepciones
  // errorPerfil: el perfil no se pudo leer o no existe. intentoPerfil: se incrementa para volver a leerlo.
  const [errorPerfil, setErrorPerfil] = useState<ErrorPerfil | null>(null);
  const [intentoPerfil, setIntentoPerfil] = useState(0);
  // Comentarios - Manejo de errores y excepciones
  // Motivo del último cierre de sesión que no pidió el usuario (1 hora, cerrada desde fuera o cuenta desactivada),
  // para avisarlo en el login. motivoPendiente guarda el motivo hasta que Auth confirma el cierre (SIGNED_OUT).
  const [motivoCierre, setMotivoCierre] = useState<MotivoCierre | null>(null);
  const motivoPendiente = useRef<MotivoCierre | 'voluntario' | null>(null);
  // Comentarios - Límite de sesión de 1 hora
  // Hora de inicio de la sesión actual; es la misma aunque el token se renueve, así el temporizador no se reinicia
  const inicioSesion = session ? obtenerInicioSesion(session.access_token) : null;
  // Comentarios - Segundo factor TOTP (RF-36)
  // La sesión queda completa solo cuando el token tiene nivel aal2, es decir, cuando el usuario ingresó el código TOTP
  const dosPasosCompleto = session ? leerClaimsToken(session.access_token)?.aal === 'aal2' : false;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Comentarios - Carga del perfil de usuario
    // El callback solo guarda la sesión. Supabase advierte que esperar otras consultas dentro de
    // onAuthStateChange puede bloquear el cliente, así que el perfil se carga en el efecto siguiente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, currentSession) => {
      setSession(currentSession);
      if (!currentSession) setUser(null);
      setAuthListo(true);

      // Comentarios - Manejo de errores y excepciones
      // Un cierre que no pidió el usuario (token revocado, contraseña cambiada por el administrador) se avisa como
      // "sesión cerrada". Los cierres con motivo propio (1 hora, cuenta desactivada) llevan su propio aviso.
      if (evento === 'SIGNED_OUT') {
        const motivo = motivoPendiente.current ?? 'cerrada';
        motivoPendiente.current = null;
        setMotivoCierre(motivo === 'voluntario' ? null : motivo);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Comentarios - Manejo de errores y excepciones
  // Una consulta rechazada por token vencido avisa con este evento: se cierra la sesión local y el login lo informa.
  useEffect(() => {
    const alExpirar = async () => {
      if (motivoPendiente.current) return;
      const { data: { session: sesionActual } } = await supabase.auth.getSession();
      if (!sesionActual || motivoPendiente.current) return;
      motivoPendiente.current = 'cerrada';
      await supabase.auth.signOut({ scope: 'local' });
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  // Comentarios - Carga del perfil de usuario
  // Cada vez que cambia el usuario de la sesión, lee su perfil. Si la cuenta está desactivada, cierra la sesión.
  // "vigente" descarta la respuesta si el usuario cambió mientras se esperaba.
  useEffect(() => {
    if (!userId) return;
    let vigente = true;

    void cargarPerfil(userId).then(({ perfil, error }) => {
      if (!vigente) return;
      setErrorPerfil(error);
      if (perfil && !perfil.activo) {
        motivoPendiente.current = 'desactivada';
        setSession(null);
        setUser(null);
        void supabase.auth.signOut();
      } else {
        setUser(perfil);
      }
      setPerfilCargadoDe(userId);
    });

    return () => { vigente = false; };
  }, [userId, intentoPerfil]);

  // Comentarios - Manejo de errores y excepciones
  // Vuelve a leer el perfil después de una falla (botón "Reintentar" de la pantalla de error del perfil).
  const reintentarPerfil = useCallback(() => {
    setErrorPerfil(null);
    setPerfilCargadoDe(null);
    setIntentoPerfil((n) => n + 1);
  }, []);

  // Comentarios - Presencia en línea
  // Cada sesión se anuncia en su propio canal privado (presencia:<id>).
  // Solo el dueño del canal y el administrador pueden leerlo (RLS en realtime.messages).
  useEffect(() => {
    if (!userId) return;

    const canal = supabase.channel(`presencia:${userId}`, { config: { private: true } });
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') void canal.track({ desde: new Date().toISOString() });
    });

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId]);

  // Comentarios - Límite de sesión de 1 hora
  // Cierra la sesión al cumplir 1 hora desde el login. También revisa al volver a la pestaña,
  // porque el navegador retrasa los temporizadores de las pestañas en segundo plano.
  useEffect(() => {
    if (inicioSesion === null) return;

    const vence = inicioSesion + DURACION_SESION_MS;
    let cerrando = false;

    const revisarVencimiento = () => {
      if (cerrando || Date.now() < vence) return;
      cerrando = true;
      motivoPendiente.current = 'expirada';
      setMotivoCierre('expirada');
      setSession(null);
      setUser(null);
      // Comentarios - Bitácora completa
      // Registra el cierre por tiempo antes de revocar la sesión, mientras el token todavía es válido.
      // scope 'local' revoca solo esta sesión en el servidor, sin cerrar las de otros equipos del usuario
      void registrarEvento('SESION_EXPIRADA').finally(() => supabase.auth.signOut({ scope: 'local' }));
    };

    const temporizador = window.setTimeout(revisarVencimiento, Math.max(vence - Date.now(), 0));
    document.addEventListener('visibilitychange', revisarVencimiento);
    window.addEventListener('focus', revisarVencimiento);

    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', revisarVencimiento);
      window.removeEventListener('focus', revisarVencimiento);
    };
  }, [inicioSesion]);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    if (!isSupabaseConfigured) return MENSAJE_SIN_CONFIGURACION;

    setMotivoCierre(null);
    // Comentarios - Captcha en inicio de sesión
    // Envía el token de Turnstile a Supabase Auth, que lo verifica antes de validar la contraseña
    const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
    // Comentarios - Mensajes de Supabase Auth en español
    // Supabase responde en inglés; el usuario ve el mensaje traducido según el código de error.
    if (error) return mensajeErrorAuth(error, 'No se pudo iniciar sesión. Inténtalo nuevamente.');

    // Comentarios - Carga del perfil de usuario
    // Revisa aquí si la cuenta está desactivada para devolver el mensaje a la pantalla de login.
    // La sesión y el perfil los guardan onAuthStateChange y el efecto de carga del perfil.
    const { perfil } = await cargarPerfil(data.user.id);
    if (perfil && !perfil.activo) {
      motivoPendiente.current = 'voluntario';
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      return MENSAJE_CUENTA_DESACTIVADA;
    }

    return null;
  };

  // Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
  // Cambia la contraseña de la sesión actual y marca en el perfil que ya no debe cambiarla. Devuelve un error o null.
  const completarCambioContrasena = async (nuevaContrasena: string) => {
    if (!user) return 'No hay una sesión válida. Vuelve a iniciar sesión.';

    const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
    if (error) return mensajeErrorAuth(error, 'No se pudo cambiar la contraseña. Inténtalo nuevamente.');

    const { error: errorPerfil } = await supabase
      .from('usuario')
      .update({ debe_cambiar_password: false })
      .eq('id', user.id);
    if (errorPerfil) return 'La contraseña se cambió, pero no se pudo registrar. Cierra sesión e ingresa con la nueva contraseña.';

    setUser({ ...user, debe_cambiar_password: false });
    return null;
  };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Consulta al servidor si el usuario ya tiene una app autenticadora confirmada y devuelve su id (o null si no tiene).
  // useCallback la mantiene estable entre renders, porque la pantalla de verificación la usa en un useEffect.
  const obtenerFactorDosPasos = useCallback(async () => {
    if (!isSupabaseConfigured) return { factorId: null, error: MENSAJE_SIN_CONFIGURACION };

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { factorId: null, error: mensajeErrorDosPasos(error) };

    return { factorId: data.totp[0]?.id ?? null, error: null };
  }, []);

  // Comentarios - Segundo factor TOTP (RF-36)
  // Genera un QR nuevo para vincular la app autenticadora. Antes borra las configuraciones a medias
  // (QR generado y nunca confirmado), porque Supabase no permite dos factores con el mismo nombre.
  const configurarDosPasos = async () => {
    if (!isSupabaseConfigured) return { datos: null, error: MENSAJE_SIN_CONFIGURACION };

    const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors();
    if (errorFactores) return { datos: null, error: mensajeErrorDosPasos(errorFactores) };

    const pendientes = factores.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
    for (const factor of pendientes) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'RedSangre', issuer: 'RedSangre' });
    if (error) return { datos: null, error: mensajeErrorDosPasos(error) };

    return { datos: { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret }, error: null };
  };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Valida el código de 6 dígitos. Si es correcto, Supabase eleva la sesión a aal2 y la aplicación se desbloquea sola.
  // El inicio de sesión se registra en auditoría recién aquí; si la auditoría falla, no bloquea el ingreso.
  const verificarDosPasos = async (factorId: string, codigo: string) => {
    if (!isSupabaseConfigured) return MENSAJE_SIN_CONFIGURACION;

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
    if (error) {
      // Comentarios - Bitácora completa
      // Un código TOTP incorrecto queda registrado (la sesión aún es aal1, pero ya tiene usuario)
      void registrarEvento('LOGIN_TOTP_FALLIDO', { detalle: { codigo: error.code ?? null } });
      return mensajeErrorDosPasos(error);
    }

    await registrarEvento('LOGIN', { tabla: 'usuario', registroId: userId });
    return null;
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return MENSAJE_SIN_CONFIGURACION;

    // Comentarios - Bitácora completa
    // El cierre de sesión se registra antes de revocar el token, que es el que identifica al usuario
    await registrarEvento('LOGOUT');
    motivoPendiente.current = 'voluntario';
    const { error } = await supabase.auth.signOut();
    if (error) {
      motivoPendiente.current = null;
      return isAuthRetryableFetchError(error) ? MENSAJE_SIN_CONEXION : 'No se pudo cerrar sesión. Inténtalo nuevamente.';
    }

    setSession(null);
    setUser(null);
    return null;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, configured: isSupabaseConfigured, motivoCierre, errorPerfil, reintentarPerfil, signIn, signOut, completarCambioContrasena, dosPasosCompleto, obtenerFactorDosPasos, configurarDosPasos, verificarDosPasos }}>
      {children}
    </AuthContext.Provider>
  );
}
