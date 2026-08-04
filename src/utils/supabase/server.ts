import { getCurrentUserSession, deleteSessionCookie } from '@/lib/auth'

/**
 * Локальный аналог createClient, возвращающий сессию из куки sulak_session.
 * Полностью совместим со всеми вызовами createClient().auth.getUser() в проекте.
 */
export async function createClient() {
  const session = await getCurrentUserSession()

  return {
    auth: {
      async getUser() {
        if (!session) {
          return { data: { user: null }, error: new Error('Не авторизован') }
        }
        return {
          data: {
            user: {
              id: session.userId,
              email: session.email,
              role: session.role,
            },
          },
          error: null,
        }
      },
      async signOut() {
        await deleteSessionCookie()
      },
    },
  } as any
}
