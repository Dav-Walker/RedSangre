// Comentarios - Manejo de errores y excepciones
// Captura cualquier error al dibujar una pantalla y muestra un aviso con opciones para seguir,
// en vez de dejar la aplicación en blanco. El detalle del error solo se anota en la consola en desarrollo.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PantallaError } from './PantallaError';
import { ErrorCargaPagina } from '../../utils/cargaDiferida';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Error al mostrar la pantalla:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    // Comentarios - Manejo de errores y excepciones
    // Una página que no se pudo descargar suele ser una versión nueva publicada o una falla de conexión.
    const esCargaPagina = this.state.error instanceof ErrorCargaPagina;
    return (
      <PantallaError
        titulo={esCargaPagina ? 'No se pudo cargar la página' : 'Ocurrió un error inesperado'}
        mensaje={esCargaPagina
          ? 'Puede haber una versión nueva del sistema o un problema de conexión. Recarga la página para continuar.'
          : 'La pantalla no se pudo mostrar. Recarga la página o vuelve al inicio.'}
        acciones={[
          { texto: 'Recargar', onClick: () => window.location.reload(), principal: true },
          { texto: 'Ir al inicio', onClick: () => window.location.assign('/dashboard') },
        ]}
      />
    );
  }
}
