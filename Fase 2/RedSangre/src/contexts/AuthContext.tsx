import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabase';
import { AuthContext, type UserProfile } from './auth-context';
import { DURACION_SESION_MS, obtenerInicioSesion } from '../utils/duracionSesion';
import { leerClaimsToken } from '../utils/tokenSesion';

const MENSAJE_CUENTA_DESACTIVADA = 'Tu cuenta está desactivada. Contacta al administrador.';
const MENSAJE_SIN_CONFIGURACION = 'Supabase no está configurado. Revisa las variables del archivo .env.';

// Comentarios - Segundo factor TOTP (RF-36)
// Traduce los errores de MFA de Supabase Auth a mensajes en español para la pantalla de verificación
function mensajeErrorDosPasos(codigo: string | undefined): string {
  switch (codigo) {
    case 'mfa_verification_failed':
    case 'mfa_challenge_expired':
      return 'El código no es correcto o ya cambió. Ingresa el código que muestra ahora la app y revisa que la hora del celular esté en automático.';
    case 'over_request_rate_limit':
      return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    case 'mfa_totp_enroll_not_enabled':
    case 'mfa_totp_verify_not_enabled':
      return 'La verificación en dos pasos no está habilitada en Supabase. Contacta al administrador.';
    default:
      return 'No se pudo completar la verificación en dos pasos. Inténtalo nuevamente.';
  }
}

// Comentarios - Carga del perfil de usuario
// Lee el perfil (tabla usuario) del usuario autenticado. Devuelve null si no existe o no se pudo leer.
async function cargarPerfil(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre, apellido, correo, rol, activo, debe_cambiar_password')
    .eq('id', id)
    .single();
  return error ? null : data;
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
  // Comentarios - Límite de sesión de 1 hora
  // Hora de inicio de la sesión actual; es la misma aunque el token se renueve, así el temporizador no se reinicia
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const inicioSesion = session ? obtenerInicioSesion(session.access_token) : null;
  // Comentarios - Segundo factor TOTP (RF-36)
  // La sesión queda completa solo cuando el token tiene nivel aal2, es decir, cuando el usuario ingresó el código TOTP
  const dosPasosCompleto = session ? leerClaimsToken(session.access_token)?.aal === 'aal2' : false;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Comentarios - Carga del perfil de usuario
    // El callback solo guarda la sesión. Supabase advierte que esperar otras consultas dentro de
    // onAuthStateChange puede bloquear el cliente, así que el perfil se carga en el efecto siguiente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (!currentSession) setUser(null);
      setAuthListo(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Comentarios - Carga del perfil de usuario
  // Cada vez que cambia el usuario de la sesión, lee su perfil. Si la cuenta está desactivada, cierra la sesión.
  // "vigente" descarta la respuesta si el usuario cambió mientras se esperaba.
  useEffect(() => {
    if (!userId) return;
    let vigente = true;

    void cargarPerfil(userId).then((perfil) => {
      if (!vigente) return;
      if (perfil && !perfil.activo) {
        setSession(null);
        setUser(null);
        void supabase.auth.signOut();
      } else {
        setUser(perfil);
      }
      setPerfilCargadoDe(userId);
    });

    return () => { vigente = false; };
  }, [userId]);

  // Presence: cada sesión se anuncia en su propio canal privado (presencia:<id>).
  // Solo el dueño del canal y el administrador pueden leerlo (RLS en realtime.messages).
  useEffect(() => {
    if (!userId) return;

    const canal = supabase.channel(`presencia:${userId}`, { config: { private: true } });
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') canal.track({ desde: new Date().toISOString() });
    });

    return () => {
      supabase.removeChannel(canal);
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
      setSesionExpirada(true);
      setSession(null);
      setUser(null);
      // scope 'local' revoca solo esta sesión en el servidor, sin cerrar las de otros equipos del usuario
      void supabase.auth.signOut({ scope: 'local' });
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

    setSesionExpirada(false);
    // Comentarios - Captcha en inicio de sesión
    // Envía el token de Turnstile a Supabase Auth, que lo verifica antes de validar la contraseña
    const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
    if (error) {
      return error.code === 'captcha_failed'
        ? 'No se pudo verificar el captcha. Inténtalo nuevamente.'
        : error.message;
    }

    // Comentarios - Carga del perfil de usuario
    // Revisa aquí si la cuenta está desactivada para devolver el mensaje a la pantalla de login.
    // La sesión y el perfil los guardan onAuthStateChange y el efecto de carga del perfil.
    const perfil = await cargarPerfil(data.user.id);
    if (perfil && !perfil.activo) {
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
    if (!user) return 'No hay una sesión válida.';

    const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
    if (error) {
      return error.code === 'same_password'
        ? 'La nueva contraseña debe ser distinta de la actual.'
        : error.message;
    }

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
    if (error) return { factorId: null, error: mensajeErrorDosPasos(error.code) };

    return { factorId: data.totp[0]?.id ?? null, error: null };
  }, []);

  // Comentarios - Segundo factor TOTP (RF-36)
  // Genera un QR nuevo para vincular la app autenticadora. Antes borra las configuraciones a medias
  // (QR generado y nunca confirmado), porque Supabase no permite dos factores con el mismo nombre.
  const configurarDosPasos = async () => {
    if (!isSupabaseConfigured) return { datos: null, error: MENSAJE_SIN_CONFIGURACION };

    const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors();
    if (errorFactores) return { datos: null, error: mensajeErrorDosPasos(errorFactores.code) };

    const pendientes = factores.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
    for (const factor of pendientes) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'RedSangre', issuer: 'RedSangre' });
    if (error) return { datos: null, error: mensajeErrorDosPasos(error.code) };

    return { datos: { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret }, error: null };
  };

  // Comentarios - Segundo factor TOTP (RF-36)
  // Valida el código de 6 dígitos. Si es correcto, Supabase eleva la sesión a aal2 y la aplicación se desbloquea sola.
  // El inicio de sesión se registra en auditoría recién aquí; si la auditoría falla, no bloquea el ingreso.
  const verificarDosPasos = async (factorId: string, codigo: string) => {
    if (!isSupabaseConfigured) return MENSAJE_SIN_CONFIGURACION;

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
    if (error) return mensajeErrorDosPasos(error.code);

    await supabase.rpc('fn_registrar_login');
    return null;
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return MENSAJE_SIN_CONFIGURACION;

    const { error } = await supabase.auth.signOut();
    if (error) return error.message;

    setSession(null);
    setUser(null);
    return null;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, configured: isSupabaseConfigured, sesionExpirada, signIn, signOut, completarCambioContrasena, dosPasosCompleto, obtenerFactorDosPasos, configurarDosPasos, verificarDosPasos }}>
      {children}
    </AuthContext.Provider>
  );
}
