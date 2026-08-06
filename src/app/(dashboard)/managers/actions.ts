'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { requireRole } from '@/lib/auth/dal'
import { validatePassword } from '@/lib/auth/password'
import { defaultPermissionsForRole } from '@/lib/auth/permissions'

async function checkAdminOrOwner() {
  return requireRole(['admin', 'owner'])
}

export async function createManagerAction(
  fullName: string,
  phone: string,
  emailInput: string,
  telegramUsername: string,
  password: string
) {
  try {
    await checkAdminOrOwner()

    if (!fullName.trim() || !phone.trim()) {
      return { error: 'ФИО и телефон обязательны' }
    }

    let cleanTag = telegramUsername?.trim() || null
    if (cleanTag && !cleanTag.startsWith('@')) {
      cleanTag = `@${cleanTag}`
    }

    const passwordError = validatePassword(password)
    if (passwordError) return { error: passwordError }

    const uuid = randomUUID()
    let email = emailInput.trim().toLowerCase()
    if (!email.includes('@')) email = `${email}@sulak.ru`
    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.profile.create({
      data: {
        id: uuid,
        email,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: 'manager',
        isActive: true,
        telegramUsername: cleanTag,
        passwordHash,
        permissions: defaultPermissionsForRole('manager'),
      },
    })

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
