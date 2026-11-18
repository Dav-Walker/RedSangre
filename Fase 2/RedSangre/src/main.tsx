// Comentarios - Punto de entrada
// Monta la aplicación React en el elemento #root de index.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Comentarios - Manejo de errores y excepciones
// Último resguardo para errores que nadie capturó (promesas rechazadas o errores fuera de React).
// En producción se evita que el navegador imprima el detalle en la consola; en desarrollo se deja visible.
if (!import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (evento) => evento.preventDefault());
  window.addEventListener('error', (evento) => evento.preventDefault());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
