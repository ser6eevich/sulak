'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

// Вспомогательная функция проверки прав администратора или владельца
async function checkAdminOrOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner'].includes(profile.role)) {
    redirect('/unauthorized')
  }
  return user.id
}

// Создание нового пользователя (signUp без прерывания сессии админа)
export async function createUserAction(formData: {
  email: string
  fullName: string
  role: string
  passwordStr: string
}) {
  try {
    const adminUserId = await checkAdminOrOwner()

    const { email, fullName, role, passwordStr } = formData

    if (!email || !fullName || !role || !passwordStr) {
      return { error: 'Все поля обязательны для заполнения' }
    }

    let finalEmail = email.trim().toLowerCase()
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@sulak.ru`
    }

    const userId = randomUUID()

    const defaultPermissions = {
      catalog: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'].includes(role),
      clients: ['admin', 'owner', 'manager'].includes(role),
      orders: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'].includes(role),
      production: ['admin', 'owner', 'production'].includes(role),
      warehouse: ['admin', 'owner', 'warehouse'].includes(role),
      logistician: ['admin', 'owner', 'logistician'].includes(role),
      drivers: ['admin', 'owner', 'logistician', 'manager'].includes(role),
      payroll: ['admin', 'owner'].includes(role),
      managers: ['admin', 'owner'].includes(role),
      mustChangePassword: true,
    }

    const passwordHash = bcrypt.hashSync(passwordStr, 10)

    const profile = await prisma.profile.create({
      data: {
        id: userId,
        email: finalEmail,
        fullName: fullName.trim(),
        role,
        isActive: true,
        passwordHash,
        permissions: defaultPermissions
      }
    })

    // Записываем лог в аудит
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: 'profile',
        entityId: userId,
        action: 'create',
        comment: `Создан пользователь ${fullName} с ролью ${role}`
      }
    })

    revalidatePath('/dashboard')
    return { success: true, profile }
  } catch (error: any) {
    return { error: error.message || 'Ошибка сервера при создании пользователя' }
  }
}

// Обновление роли пользователя
export async function updateUserRoleAction(userId: string, newRole: string) {
  try {
    const adminUserId = await checkAdminOrOwner()

    const oldProfile = await prisma.profile.findUnique({ where: { id: userId } })
    if (!oldProfile) return { error: 'Пользователь не найден' }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { role: newRole }
    })

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: 'profile',
        entityId: userId,
        action: 'update_role',
        oldData: { role: oldProfile.role },
        newData: { role: newRole },
        comment: `Роль пользователя ${profile.fullName} изменена с ${oldProfile.role} на ${newRole}`
      }
    })

    revalidatePath('/dashboard')
    return { success: true, profile }
  } catch (error: any) {
    return { error: error.message || 'Ошибка сервера' }
  }
}

// Обновление персональных разрешений
export async function updateUserPermissionsAction(userId: string, permissions: Record<string, boolean>) {
  try {
    const adminUserId = await checkAdminOrOwner()

    const oldProfile = await prisma.profile.findUnique({ where: { id: userId } })
    if (!oldProfile) return { error: 'Пользователь не найден' }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { permissions }
    })

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: 'profile',
        entityId: userId,
        action: 'update_permissions',
        oldData: { permissions: oldProfile.permissions },
        newData: { permissions },
        comment: `Обновлены разрешения для пользователя ${profile.fullName}`
      }
    })

    revalidatePath('/dashboard')
    return { success: true, profile }
  } catch (error: any) {
    return { error: error.message || 'Ошибка сервера' }
  }
}

// Блокировка/активация пользователя
export async function toggleUserStatusAction(userId: string, isActive: boolean) {
  try {
    const adminUserId = await checkAdminOrOwner()

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { isActive }
    })

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: 'profile',
        entityId: userId,
        action: isActive ? 'activate' : 'deactivate',
        comment: isActive ? `Пользователь ${profile.fullName} активирован` : `Пользователь ${profile.fullName} заблокирован`
      }
    })

    revalidatePath('/dashboard')
    return { success: true, profile }
  } catch (error: any) {
    return { error: error.message || 'Ошибка сервера' }
  }
}

// Обновление Telegram тега (@username)
export async function updateUserTelegramAction(userId: string, telegramUsername: string) {
  try {
    const adminUserId = await checkAdminOrOwner()

    let cleanTag = telegramUsername.trim()
    if (cleanTag && !cleanTag.startsWith('@')) {
      cleanTag = `@${cleanTag}`
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.profiles SET telegram_username = $1 WHERE id = $2::uuid`,
      cleanTag || null,
      userId
    )

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: 'profile',
        entityId: userId,
        action: 'update_telegram',
        comment: `Обновлен Telegram тег для пользователя: ${cleanTag || 'очищен'}`
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/managers')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Ошибка сервера' }
  }
}

// Сброс пароля сотрудника администратором (с флагом обязательной смены)
export async function resetUserPasswordAction(userId: string, newPasswordStr: string) {
  try {
    const adminUserId = await checkAdminOrOwner()

    if (!newPasswordStr || newPasswordStr.length < 3) {
      return { error: 'Пароль должен содержать минимум 3 символа' }
    }

    const targetUser = await prisma.profile.findUnique({ where: { id: userId } })
    if (!targetUser) return { error: 'Пользователь не найден' }

    const passwordHash = bcrypt.hashSync(newPasswordStr, 10)

    const currentPerms = (targetUser.permissions as Record<string, boolean>) || {}
    const updatedPerms = { ...currentPerms, mustChangePassword: true }

    await prisma.profile.update({
      where: { id: userId },
      data: {
        passwordHash,
        permissions: updatedPerms
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: 'profile',
        entityId: userId,
        action: 'reset_password',
        comment: `Администратор сбросил пароль пользователю ${targetUser.fullName} и установил флаг обязательной смены пароля`
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Ошибка сервера при сбросе пароля' }
  }
}
