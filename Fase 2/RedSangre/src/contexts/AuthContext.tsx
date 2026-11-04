import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabase';
import { AuthContext, type UserProfile } from './auth-context';

const MENSAJE_CUENTA_DESACTIVADA = 'Tu cuenta está desactivada. Contacta al administrador.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const userId = session?.user.id;
  const cuentaDesactivada = useRef(false);

  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);

      if (currentSession?.user) {
        const { data: profile, error } = await supabase!
          .from('usuario')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();

        if (!error && profile && !profile.activo) {
          cuentaDesactivada.current = true;
          setSession(null);
          setUser(null);
          void supabase!.auth.signOut();
        } else if (!error && profile) {
          setUser(profile);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Presence: cada sesión se anuncia en su propio canal privado (presencia:<id>).
  // Solo el dueño del canal y el administrador pueden leerlo (RLS en realtime.messages).
  useEffect(() => {
    if (!supabase || !userId) return;

    const canal = supabase.channel(`presencia:${userId}`, { config: { private: true } });
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') canal.track({ desde: new Date().toISOString() });
    });

    return () => {
      supabase!.removeChannel(canal);
    };
  }, [userId]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Supabase no está configurado. Revisa las variables del archivo .env.';

    cuentaDesactivada.current = false;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    setSession(data.session);

    // La auditoría no debe bloquear el inicio de sesión si falla.
    await supabase.rpc('fn_registrar_login');

    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('usuario')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profileError && profile && !profile.activo) {
        cuentaDesactivada.current = true;
      } else if (!profileError && profile) {
        setUser(profile);
      }

      if (cuentaDesactivada.current) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return MENSAJE_CUENTA_DESACTIVADA;
      }
    }

    return null;
  };

  // Comentarios - Cambio de contraseña obligatorio en el primer inicio de sesión
  // Cambia la contraseña de la sesión actual y marca en el perfil que ya no debe cambiarla. Devuelve un error o null.
  const completarCambioContrasena = async (nuevaContrasena: string) => {
    if (!supabase || !user) return 'No hay una sesión válida.';

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

  const signOut = async () => {
    if (!supabase) return 'Supabase no está configurado. Revisa las variables del archivo .env.';

    const { error } = await supabase.auth.signOut();
    if (error) return error.message;

    setSession(null);
    setUser(null);
    return null;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, configured: isSupabaseConfigured, signIn, signOut, completarCambioContrasena }}>
      {children}
    </AuthContext.Provider>
  );
}
