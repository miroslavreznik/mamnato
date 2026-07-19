import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrapSharedState } from './store/shareLink'

// Sdílený přehled z odkazu zpracujeme jednou před renderem.
bootstrapSharedState()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
