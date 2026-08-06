import { deleteSessionCookie } from '@/lib/auth'
import { getCurrentProfile } from '@/lib/auth/dal'

interface CompatibleAuthUser {
  id: string
  email: string
  role: string
}

type GetUserResult =
  | { data: { user: CompatibleAuthUser }; error: null }
  | { data: { user: null }; error: Error }

/**
 * Локальный аналог createClient, возвращающий сессию из куки sulak_session.
 * Полностью совместим со всеми вызовами createClient().auth.getUser() в проекте.
 */
export async function createClient() {
  return {
    auth: {
      async getUser(): Promise<GetUserResult> {
        const profile = await getCurrentProfile()
        if (!profile) {
          return { data: { user: null }, error: new Error('Не авторизован') }
        }
        return {
          data: {
            user: {
              id: profile.id,
              email: profile.email,
              role: profile.role,
            },
          },
          error: null,
        }
      },
      async signOut() {
        await deleteSessionCookie()
      },
    },
  }
}
