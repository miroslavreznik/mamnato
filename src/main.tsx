import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ui/ErrorBoundary.tsx'
import { bootstrapSharedState } from './store/shareLink'

// Sdílený přehled z odkazu zpracujeme jednou před renderem. Kdyby byl odkaz
// poškozený, nesmí to shodit celý start aplikace.
try {
  bootstrapSharedState()
} catch (e) {
  console.error('Nepodařilo se načíst sdílený přehled z odkazu:', e)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
