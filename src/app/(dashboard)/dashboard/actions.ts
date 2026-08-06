'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { APP_ROLES, requireRole, type AppRole } from '@/lib/auth/dal'
import { validatePassword } from '@/lib/auth/password'
import {
  defaultPermissionsForRole,
  sanitizePermissions,
} from '@/lib/auth/permissions'

// Вспомогательная функция проверки прав администратора или владельца
async function checkAdminOrOwner() {
  return requireRole(['admin', 'owner'])
}

function parseRole(role: string): AppRole | null {
  return APP_ROLES.includes(role as AppRole) ? (role as AppRole) : null
}

function assertCanManageOwner(actorRole: string, targetRole: string) {
  if (targetRole === 'owner' && actorRole !== 'owner') {
    throw new Error('Только владелец может изменять учетную запись владельца')
  }
}

// Создание нового пользователя (signUp без прерывания сессии админа)
export async function createUserAction(formData: {
  email: string
  fullName: string
  role: string
  passwordStr: string
}) {
  try {
    const admin = await checkAdminOrOwner()

    const { email, fullName, role, passwordStr } = formData

    if (!email || !fullName || !role || !passwordStr) {
      return { error: 'Все поля обязательны для заполнения' }
    }

    const parsedRole = parseRole(role)
    if (!parsedRole) return { error: 'Некорректная роль' }
    if (parsedRole === 'owner' && admin.role !== 'owner') {
      return { error: 'Только владелец может назначать роль владельца' }
    }
    const passwordError = validatePassword(passwordStr)
    if (passwordError) return { error: passwordError }

    let finalEmail = email.trim().toLowerCase()
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@sulak.ru`
    }

    const userId = randomUUID()

    const defaultPermissions = defaultPermissionsForRole(parsedRole)
    const passwordHash = await bcrypt.hash(passwordStr, 12)

    const profile = await prisma.profile.create({
      data: {
        id: userId,
        email: finalEmail,
        fullName: fullName.trim(),
        role: parsedRole,
        isActive: true,
        passwordHash,
        permissions: defaultPermissions
      }
    })

    // Записываем лог в аудит
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        entityType: 'profile',
        entityId: userId,
        action: 'create',
        comment: `Создан пользователь ${fullName} с ролью ${role}`
      }
    })

    revalidatePath('/dashboard')
    return {
      success: true,
      profile: {
        id: profile.id,
        fullName: profile.fullName,
        role: profile.role,
        permissions: defaultPermissions,
      },
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера при создании пользователя' }
  }
}

// Обновление роли пользователя
export async function updateUserRoleAction(userId: string, newRole: string) {
  try {
    const admin = await checkAdminOrOwner()

    const parsedRole = parseRole(newRole)
    if (!parsedRole) return { error: 'Некорректная роль' }
    if (parsedRole === 'owner' && admin.role !== 'owner') {
      return { error: 'Только владелец может назначать роль владельца' }
    }

    const oldProfile = await prisma.profile.findUnique({ where: { id: userId } })
    if (!oldProfile) return { error: 'Пользователь не найден' }
    assertCanManageOwner(admin.role, oldProfile.role)

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { role: parsedRole }
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        entityType: 'profile',
        entityId: userId,
        action: 'update_role',
        oldData: { role: oldProfile.role },
        newData: { role: newRole },
        comment: `Роль пользователя ${profile.fullName} изменена с ${oldProfile.role} на ${newRole}`
      }
    })

    revalidatePath('/dashboard')
    return {
      success: true,
      profile: {
        id: profile.id,
        fullName: profile.fullName,
        role: profile.role,
        isActive: profile.isActive,
      },
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Обновление персональных разрешений
export async function updateUserPermissionsAction(userId: string, permissions: Record<string, boolean>) {
  try {
    const admin = await checkAdminOrOwner()

    const oldProfile = await prisma.profile.findUnique({ where: { id: userId } })
    if (!oldProfile) return { error: 'Пользователь не найден' }
    assertCanManageOwner(admin.role, oldProfile.role)

    const safePermissions = sanitizePermissions(permissions)

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { permissions: safePermissions }
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        entityType: 'profile',
        entityId: userId,
        action: 'update_permissions',
        oldData: { permissions: oldProfile.permissions },
        newData: { permissions: safePermissions },
        comment: `Обновлены разрешения для пользователя ${profile.fullName}`
      }
    })

    revalidatePath('/dashboard')
    return {
      success: true,
      profile: {
        id: profile.id,
        fullName: profile.fullName,
        role: profile.role,
        permissions: safePermissions,
      },
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Блокировка/активация пользователя
export async function toggleUserStatusAction(userId: string, isActive: boolean) {
  try {
    const admin = await checkAdminOrOwner()

    const target = await prisma.profile.findUnique({ where: { id: userId } })
    if (!target) return { error: 'Пользователь не найден' }
    assertCanManageOwner(admin.role, target.role)
    if (admin.id === userId && !isActive) return { error: 'Нельзя заблокировать собственную учетную запись' }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { isActive }
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        entityType: 'profile',
        entityId: userId,
        action: isActive ? 'activate' : 'deactivate',
        comment: isActive ? `Пользователь ${profile.fullName} активирован` : `Пользователь ${profile.fullName} заблокирован`
      }
    })

    revalidatePath('/dashboard')
    return {
      success: true,
      profile: {
        id: profile.id,
        fullName: profile.fullName,
        role: profile.role,
        isActive: profile.isActive,
      },
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Обновление Telegram тега (@username)
export async function updateUserTelegramAction(userId: string, telegramUsername: string) {
  try {
    const admin = await checkAdminOrOwner()

    const target = await prisma.profile.findUnique({ where: { id: userId } })
    if (!target) return { error: 'Пользователь не найден' }
    assertCanManageOwner(admin.role, target.role)

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
        userId: admin.id,
        entityType: 'profile',
        entityId: userId,
        action: 'update_telegram',
        comment: `Обновлен Telegram тег для пользователя: ${cleanTag || 'очищен'}`
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/managers')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Сброс пароля сотрудника администратором (с флагом обязательной смены)
export async function resetUserPasswordAction(userId: string, newPasswordStr: string) {
  try {
    const admin = await checkAdminOrOwner()

    const passwordError = validatePassword(newPasswordStr)
    if (passwordError) return { error: passwordError }

    const targetUser = await prisma.profile.findUnique({ where: { id: userId } })
    if (!targetUser) return { error: 'Пользователь не найден' }
    assertCanManageOwner(admin.role, targetUser.role)

    const passwordHash = await bcrypt.hash(newPasswordStr, 12)

    const currentPerms = (targetUser.permissions as Record<string, boolean>) || {}
    const updatedPerms = { ...currentPerms, mustChangePassword: true }

    await prisma.profile.update({
      where: { id: userId },
      data: {
        passwordHash,
        permissions: updatedPerms,
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        entityType: 'profile',
        entityId: userId,
        action: 'reset_password',
        comment: `Администратор сбросил пароль пользователю ${targetUser.fullName} и установил флаг обязательной смены пароля`
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера при сбросе пароля' }
  }
}
