'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      onTouchEnd={(e) => {
        e.preventDefault()
        toggleTheme()
      }}
      type="button"
      className="relative flex h-8 w-8 min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer shadow-xs touch-manipulation"
      title={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
      aria-label="Переключить тему"
    >
      {theme === 'dark' ? (
        <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform duration-200" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-slate-600 transition-transform duration-200" />
      )}
    </button>
  )
}
