// Comentarios - Sesión y perfil del usuario
// Tipos y contexto de autenticación. Va separado del proveedor para que Vite pueda recargar los componentes en caliente.
import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

// Comentarios - Perfil TENS solo lectura
// TENS ve el dashboard, los donantes y las solicitudes, pero no puede crear ni editar
export type UserRole = 'administrador' | 'tecnologo' | 'tens';

export interface UserProfile {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
  debe_cambiar_password: boolean;
}

// Comentarios - Segundo factor TOTP (RF-36)
// Datos para configurar la app autenticadora: el QR (ya como URL de imagen) y la clave para ingresarla a mano
export interface ConfiguracionDosPasos {
  factorId: string;
  qr: string;
  secreto: string;
}

// Comentarios - Manejo de errores y excepciones
// Motivo de un cierre de sesión que el usuario no pidió: cumplió 1 hora, la sesión se cerró desde fuera
// (token revocado o vencido) o la cuenta está desactivada. El login muestra el aviso que corresponde.
export type MotivoCierre = 'expirada' | 'cerrada' | 'desactivada';

// Comentarios - Manejo de errores y excepciones
// Problema al cargar el perfil: la cuenta no tiene perfil o la lectura falló.
export type ErrorPerfil = 'sin_perfil' | 'error';

export interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  user: UserProfile | null;
  // Comentarios - Manejo de errores y excepciones
  // Motivo del último cierre de sesión no pedido, para avisarlo en la pantalla de login (null si no hay aviso)
  motivoCierre: MotivoCierre | null;
  // Comentarios - Manejo de errores y excepciones
  // Error al cargar el perfil y la función para volver a intentarlo
  errorPerfil: ErrorPerfil | null;
  reintentarPerfil: () => void;
  // Comentarios - Captcha en inicio de sesión
  // captchaToken es el token de Cloudflare Turnstile; Supabase Auth lo valida cuando el captcha está activo
  signIn: (email: string, password: string, captchaToken?: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
  completarCambioContrasena: (nuevaContrasena: string) => Promise<string | null>;
  // Comentarios - Segundo factor TOTP (RF-36)
  // dosPasosCompleto: la sesión ya validó el código TOTP (aal2). Las funciones devuelven un mensaje de error o null.
  dosPasosCompleto: boolean;
  obtenerFactorDosPasos: () => Promise<{ factorId: string | null; error: string | null }>;
  configurarDosPasos: () => Promise<{ datos: ConfiguracionDosPasos | null; error: string | null }>;
  verificarDosPasos: (factorId: string, codigo: string) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
