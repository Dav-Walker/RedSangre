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
  debe_cambiar_password: boolean;
}

export interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  user: UserProfile | null;
  // Comentarios - Límite de sesión de 1 hora
  // Indica que la última sesión se cerró por cumplir 1 hora, para avisarlo en la pantalla de login
  sesionExpirada: boolean;
  // Comentarios - Captcha en inicio de sesión
  // captchaToken es el token de Cloudflare Turnstile; Supabase Auth lo valida cuando el captcha está activo
  signIn: (email: string, password: string, captchaToken?: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
  completarCambioContrasena: (nuevaContrasena: string) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
