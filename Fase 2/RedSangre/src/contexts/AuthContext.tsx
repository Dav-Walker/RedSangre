import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabase';
import { AuthContext, type UserProfile } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState<string[]>([]);
  const userId = session?.user.id;

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

        if (!error && profile) {
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

  // Presence: cada sesión abierta se anuncia en el canal, la clave es el id del usuario.
  useEffect(() => {
    if (!supabase || !userId) return;

    const canal = supabase.channel('usuarios-en-linea', { config: { presence: { key: userId } } });
    canal
      .on('presence', { event: 'sync' }, () => {
        setUsuariosEnLinea(Object.keys(canal.presenceState()));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') canal.track({ desde: new Date().toISOString() });
      });

    return () => {
      supabase!.removeChannel(canal);
      setUsuariosEnLinea([]);
    };
  }, [userId]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Supabase no está configurado. Revisa las variables del archivo .env.';

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

      if (!profileError && profile) {
        setUser(profile);
      }
    }

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
    <AuthContext.Provider value={{ session, user, usuariosEnLinea, loading, configured: isSupabaseConfigured, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
