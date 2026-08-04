import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sulak-secret-key-2026-very-secure-local-auth'
)

const COOKIE_NAME = 'sulak_session'

export interface SessionPayload {
  userId: string
  email: string
  role: string
  permissions?: Record<string, boolean>
}

/**
 * Создаёт подписанный JWT-токен сессии.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET_KEY)
}

/**
 * Проверяет и декодирует JWT-токен сессии.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY)
    if (payload && typeof payload.userId === 'string') {
      return {
        userId: payload.userId,
        email: payload.email as string,
        role: payload.role as string,
        permissions: (payload.permissions as Record<string, boolean>) || {},
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Устанавливает HTTP-only куки сессии в браузере на 30 дней.
 */
export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 дней в секундах
  })
}

/**
 * Удаляет куки сессии при выходе.
 */
export async function deleteSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/**
 * Получает текущую сессию пользователя из куки (без обращения к внешним сервисам, 0мс).
 */
export async function getCurrentUserSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return await verifySessionToken(token)
  } catch {
    return null
  }
}
