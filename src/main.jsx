import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from './components/ui/toaster'

// Forcer le thème dark (pas de toggle)
const root = document.documentElement
root.classList.remove('light', 'dark')
root.classList.add('dark')
localStorage.setItem('theme', 'dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
)
