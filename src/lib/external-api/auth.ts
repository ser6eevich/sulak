import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import { ApiParamError } from './params'

/**
 * Аутентификация внешнего API (`/api/external/*`).
 *
 * Токен(ы) задаются переменной окружения `EXTERNAL_API_TOKEN`. Можно указать
 * несколько токенов через запятую (например, отдельный для Авито-сервиса и для
 * отладки). Токен передаётся в заголовке:
 *
 *   Authorization: Bearer <token>
 *   — либо —
 *   X-Api-Key: <token>
 *
 * Передача токена в query-строке намеренно не поддерживается (попадает в логи).
 */

export function getExternalApiTokens(): string[] {
  const raw = process.env.EXTERNAL_API_TOKEN ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function extractToken(request: Request): string {
  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (bearer && /^bearer\s+/i.test(authHeader)) return bearer

  const apiKey = request.headers.get('x-api-key')?.trim() ?? ''
  return apiKey
}

export function isExternalApiAuthorized(request: Request): boolean {
  const tokens = getExternalApiTokens()
  if (tokens.length === 0) return false

  const provided = extractToken(request)
  if (!provided) return false

  return tokens.some((token) => safeEqual(token, provided))
}

type ExternalApiHandler = (request: Request, url: URL) => Promise<Response> | Response

/**
 * Оборачивает обработчик роут-хендлера: проверяет конфигурацию и токен,
 * приводит ошибки валидации к 400, всё остальное — к 500.
 */
export function withExternalApi(handler: ExternalApiHandler) {
  return async function wrapped(request: Request): Promise<Response> {
    if (getExternalApiTokens().length === 0) {
      return Response.json(
        { ok: false, error: 'Внешний API не сконфигурирован: не задан EXTERNAL_API_TOKEN' },
        { status: 503 },
      )
    }

    if (!isExternalApiAuthorized(request)) {
      return Response.json(
        { ok: false, error: 'Неавторизовано: неверный или отсутствующий API-токен' },
        { status: 401 },
      )
    }

    try {
      const url = new URL(request.url)
      return await handler(request, url)
    } catch (error) {
      if (error instanceof ApiParamError) {
        return Response.json({ ok: false, error: error.message }, { status: 400 })
      }
      console.error('[external-api] Необработанная ошибка:', error)
      return Response.json({ ok: false, error: 'Внутренняя ошибка сервера' }, { status: 500 })
    }
  }
}
