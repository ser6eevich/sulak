'use client'

import { useEffect } from 'react'
import { pingPresenceAction } from '@/app/actions/presence'

/**
 * Невидимый компонент — отправляет ping на сервер каждые 30 секунд.
 * Монтируется один раз в layout.tsx.
 */
export default function PresencePing() {
  useEffect(() => {
    // Первый ping сразу при заходе
    pingPresenceAction()

    const interval = setInterval(() => {
      pingPresenceAction()
    }, 30_000)

    return () => clearInterval(interval)
  }, [])

  return null
}
