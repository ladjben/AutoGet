import { useEffect, useState } from 'react'

export function useTheme() {
  // Toujours utiliser dark par défaut pour le nouveau thème
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored || 'dark'
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

