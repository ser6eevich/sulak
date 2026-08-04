'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

/**
 * Обновляет last_seen_at у текущего пользователя.
 * Вызывается клиентом каждые 30 секунд через setInterval.
 */
export async function pingPresenceAction() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await prisma.$executeRawUnsafe(
      `UPDATE public.profiles SET last_seen_at = NOW() WHERE id = $1::uuid`,
      user.id
    )
  } catch {
    // Тихая ошибка — не критично
  }
}
