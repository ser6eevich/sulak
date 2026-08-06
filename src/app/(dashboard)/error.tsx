'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Ошибка раздела CRM:', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg items-center justify-center px-4">
      <div className="erp-card w-full p-7 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-[var(--danger)]" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Раздел временно недоступен</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Данные не изменены. Попробуйте повторить запрос; если ошибка сохранится, передайте администратору время сбоя.
        </p>
        <button type="button" onClick={reset} className="erp-button-primary mt-5 inline-flex items-center gap-2">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Повторить
        </button>
      </div>
    </div>
  )
}
