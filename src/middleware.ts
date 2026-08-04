import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

/**
 * Middleware для защиты маршрутов и проверки JWT-сессии.
 * Полностью совместим с Next.js Edge Runtime (без импорта Node.js / Prisma модулей).
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('sulak_session')?.value
  const session = token ? await verifySessionToken(token) : null
  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login'
  const isUnauthorizedPage = path === '/unauthorized'

  // Исключаем /api/cron/* из веб-авторизации, так как они имеют собственную проверку CRON_SECRET в заголовках
  if (path.startsWith('/api/cron')) {
    return NextResponse.next()
  }

  // 1. Неавторизованный пользователь
  if (!session) {
    // Для всех остального API возвращаем 401 JSON вместо 302 редиректа на страницу /login
    if (path.startsWith('/api')) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    if (!isLoginPage && !isUnauthorizedPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // 2. Если уже залогинен и открывает /login — редиректим в его раздел
  if (isLoginPage) {
    return NextResponse.redirect(new URL(getDefaultRoute(session.role), request.url))
  }

  // 3. Быстрая проверка прав по роли из подписанного JWT токена
  const role = session.role

  if (path.startsWith('/payroll')) {
    const hasAccess = ['admin', 'owner'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/managers')) {
    const hasAccess = ['admin', 'owner'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/production')) {
    const hasAccess = ['production', 'admin', 'owner'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/warehouse')) {
    const hasAccess = ['warehouse', 'admin', 'owner'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/logistician')) {
    const hasAccess = ['logistician', 'admin', 'owner'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/drivers')) {
    const hasAccess = ['logistician', 'manager', 'admin', 'owner'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/clients')) {
    const hasAccess = ['admin', 'owner', 'manager'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/catalog')) {
    const hasAccess = ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (path.startsWith('/orders')) {
    const hasAccess = ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'].includes(role)
    if (!hasAccess) return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  return NextResponse.next()
}

function getDefaultRoute(role?: string): string {
  switch (role) {
    case 'admin':
    case 'owner':
      return '/dashboard'
    case 'manager':
      return '/orders'
    case 'production':
      return '/production/dashboard'
    case 'warehouse':
      return '/warehouse/dashboard'
    case 'logistician':
      return '/logistician/dashboard'
    case 'driver':
      return '/unauthorized'
    default:
      return '/unauthorized'
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
