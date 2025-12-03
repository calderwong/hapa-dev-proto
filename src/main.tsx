import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupAstro } from './astro/setupAstro'
import { ErrorBoundary } from './components/ErrorBoundary'

// Wait for Astro web components to be defined before rendering React
setupAstro().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
})
