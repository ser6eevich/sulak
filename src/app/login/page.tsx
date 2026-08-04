'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import ThemeToggle from '@/components/ThemeToggle'
import { ThemeProvider } from '@/components/ThemeProvider'

const initialState = {
  error: '',
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState)

  return (
    <ThemeProvider>
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)] px-4 py-12 select-none">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent-primary)] text-white font-semibold text-sm">
              S
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Войти в систему
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)] font-normal">
              Внутренняя CRM платформа «Сулак»
            </p>
          </div>

          <div className="erp-card p-6 space-y-5">
            <form action={formAction} className="space-y-4">
              {state?.error && (
                <div className="rounded-md bg-[var(--danger-soft)] border border-[var(--danger)]/20 p-2.5 text-xs font-medium text-[var(--danger)] text-center">
                  {state.error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                    Логин или Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="admin@sulak.ru или zoya"
                    className="erp-input w-full font-normal"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                    Пароль
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="erp-input w-full font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="erp-button-primary w-full cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Выполняется вход...
                    </span>
                  ) : (
                    'Войти'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
