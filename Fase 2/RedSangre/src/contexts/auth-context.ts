import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type UserRole = 'administrador' | 'tecnologo';

export interface UserProfile {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
}

export interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  user: UserProfile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
