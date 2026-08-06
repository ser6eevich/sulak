'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  const applyThemeToDOM = (newTheme: Theme) => {
    const root = document.documentElement
    root.setAttribute('data-theme', newTheme)
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    const meta = document.getElementById('theme-color-meta')
    if (meta) {
      meta.setAttribute('content', newTheme === 'dark' ? '#10141B' : '#F8FAFC')
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('sulak-theme') as Theme | null
    let initialTheme: Theme
    if (stored === 'light' || stored === 'dark') {
      initialTheme = stored
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      initialTheme = prefersDark ? 'dark' : 'light'
    }
    applyThemeToDOM(initialTheme)
    const timeoutId = window.setTimeout(() => setThemeState(initialTheme), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('sulak-theme', newTheme)
    applyThemeToDOM(newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
