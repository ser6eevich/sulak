import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE_NAME = 'sulak_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET должен быть задан и содержать не менее 32 символов')
  }
  return new TextEncoder().encode(secret)
}

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
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

/**
 * Проверяет и декодирует JWT-токен сессии.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
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
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

/**
 * Удаляет куки сессии при выходе.
 */
export async function deleteSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', {
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
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token) return null
    return await verifySessionToken(token)
  } catch {
    return null
  }
}
