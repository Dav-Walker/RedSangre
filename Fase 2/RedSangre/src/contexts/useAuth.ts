// Comentarios - Sesión y perfil del usuario
// Hook para leer el contexto de autenticación. Falla con un mensaje claro si se usa fuera de AuthProvider.
import { useContext } from 'react';
import { AuthContext } from './auth-context';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}
