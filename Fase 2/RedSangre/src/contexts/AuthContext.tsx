import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabase';
import { AuthContext, type UserProfile } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);

      if (currentSession?.user) {
        const { data: profile, error } = await supabase
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

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Supabase no está configurado. Revisa las variables del archivo .env.';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    setSession(data.session);

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
    <AuthContext.Provider value={{ session, user, loading, configured: isSupabaseConfigured, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
