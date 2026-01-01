import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from './components/ui/toaster'

// Initialiser le thème dark au démarrage
const root = document.documentElement
const stored = localStorage.getItem('theme')
const theme = stored || 'dark'
root.classList.remove('light', 'dark')
root.classList.add(theme)
localStorage.setItem('theme', theme)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
)
