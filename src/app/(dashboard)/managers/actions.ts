'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

async function checkAdminOrOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner'].includes(profile.role)) {
    throw new Error('Недостаточно прав')
  }
}

export async function createManagerAction(fullName: string, phone: string, emailInput?: string, telegramUsername?: string) {
  try {
    await checkAdminOrOwner()

    if (!fullName.trim() || !phone.trim()) {
      return { error: 'ФИО и телефон обязательны' }
    }

    let cleanTag = telegramUsername?.trim() || null
    if (cleanTag && !cleanTag.startsWith('@')) {
      cleanTag = `@${cleanTag}`
    }

    const uuid = randomUUID()
    const email = emailInput?.trim() || `manager-${uuid.slice(0, 8)}@sulak.ru`
    const defaultPassword = '12345'

    // 1. Создаем учетную запись в auth.users
    await prisma.$queryRawUnsafe(`
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, aud, role, is_sso_user, confirmation_token, recovery_token, created_at, updated_at
      ) VALUES (
        $1, '00000000-0000-0000-0000-000000000000', $2, 
        extensions.crypt($3, extensions.gen_salt('bf')), NOW(), 
        '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified": true}'::jsonb, 
        'authenticated', 'authenticated', false, '', '', NOW(), NOW()
      )
    `, uuid, email, defaultPassword)

    // Ждем 200мс на случай срабатывания триггеров
    await new Promise(resolve => setTimeout(resolve, 200))

    // 2. Обновляем профиль в public.profiles через сырой SQL (безопасно к кэшированию типов Prisma)
    await prisma.$executeRawUnsafe(`
      UPDATE public.profiles 
      SET full_name = $1, phone = $2, role = 'manager', is_active = true, telegram_username = $3 
      WHERE id = $4::uuid
    `, fullName.trim(), phone.trim(), cleanTag || null, uuid)

    revalidatePath('/managers')
    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function updateManagerTelegramAction(managerId: string, telegramUsername: string) {
  try {
    await checkAdminOrOwner()

    let cleanTag = telegramUsername.trim()
    if (cleanTag && !cleanTag.startsWith('@')) {
      cleanTag = `@${cleanTag}`
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.profiles SET telegram_username = $1 WHERE id = $2::uuid`,
      cleanTag || null,
      managerId
    )

    revalidatePath('/managers')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
