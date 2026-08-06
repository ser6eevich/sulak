import 'server-only'

import { createHash } from 'crypto'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_FALLBACK_ENTRIES = 10_000

type AttemptState = {
  attempts: number
  windowStartedAt: Date
  blockedUntil: Date | null
}

// Ограничитель намеренно хранится в памяти процесса: production-БД имеет
// фиксированную схему и деплой не создаёт для этой функции отдельную таблицу.
const attemptsByIdentifier = new Map<string, AttemptState>()

function keyFor(login: string): string {
  return createHash('sha256').update(login).digest('hex')
}

export async function assertLoginAllowed(login: string): Promise<void> {
  const identifier = keyFor(login)
  const attempt = attemptsByIdentifier.get(identifier)

  if (attempt?.blockedUntil && attempt.blockedUntil > new Date()) {
    throw new Error('Слишком много попыток входа. Повторите через 15 минут')
  }
}

export async function recordLoginFailure(login: string): Promise<void> {
  const identifier = keyFor(login)
  const now = new Date()
  const existing = attemptsByIdentifier.get(identifier)
  const windowExpired = !existing || now.getTime() - existing.windowStartedAt.getTime() > WINDOW_MS
  const attempts = windowExpired ? 1 : existing.attempts + 1

  if (attemptsByIdentifier.size >= MAX_FALLBACK_ENTRIES && !attemptsByIdentifier.has(identifier)) {
    const oldestIdentifier = attemptsByIdentifier.keys().next().value
    if (oldestIdentifier) attemptsByIdentifier.delete(oldestIdentifier)
  }

  attemptsByIdentifier.set(identifier, {
    attempts,
    windowStartedAt: windowExpired ? now : existing.windowStartedAt,
    blockedUntil: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + WINDOW_MS) : null,
  })
}

export async function clearLoginFailures(login: string): Promise<void> {
  attemptsByIdentifier.delete(keyFor(login))
}
