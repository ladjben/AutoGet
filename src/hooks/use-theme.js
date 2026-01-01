import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // Vérifier si un thème est stocké dans localStorage
    const stored = localStorage.getItem('theme')
    if (stored) return stored
    
    // Sinon, utiliser la préférence système
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement
    
    // Retirer les classes précédentes
    root.classList.remove('light', 'dark')
    
    // Ajouter la classe du thème actuel
    root.classList.add(theme)
    
    // Sauvegarder dans localStorage
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme, setTheme }
}

