'use server'

import prisma from '@/lib/prisma'
import { setSessionCookie, deleteSessionCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { getCurrentProfile } from '@/lib/auth/dal'
import { validatePassword } from '@/lib/auth/password'
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from '@/lib/auth/login-rate-limit'

const INVALID_CREDENTIALS = 'Неверный логин или пароль'
const DUMMY_PASSWORD_HASH = '$2b$10$7EqJtq98hPqEX7fNZaFWoO5rQj2uH5jvCr1h4F9nT3vPjQtOSJQHe'

export async function loginAction(prevState: { error: string } | null, formData: FormData) {
  const loginInput = (formData.get('email') as string || '').trim().toLowerCase()
  const password = formData.get('password') as string

  if (!loginInput || !password) {
    return { error: 'Пожалуйста, заполните все поля' }
  }

  try {
    await assertLoginAllowed(loginInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Вход временно ограничен' }
  }

  // Находим пользователя по email или названию
  const profile = await prisma.profile.findFirst({
    where: {
      OR: [
        { email: loginInput },
        { email: `${loginInput}@sulak.ru` },
        { fullName: { mode: 'insensitive', equals: loginInput } },
      ],
    },
  })

  const isPasswordValid = await bcrypt.compare(password, profile?.passwordHash ?? DUMMY_PASSWORD_HASH)
  if (!profile || !profile.isActive || !profile.passwordHash || !isPasswordValid) {
    await recordLoginFailure(loginInput)
    return { error: INVALID_CREDENTIALS }
  }

  await clearLoginFailures(loginInput)

  const userPerms = (profile.permissions as Record<string, boolean>) || {}
  if (password === '123456') {
    userPerms.mustChangePassword = true
  }

  // Устанавливаем локальную сессионную куку
  await setSessionCookie({
    userId: profile.id,
    email: profile.email,
    role: profile.role,
    permissions: userPerms,
  })

  // Редирект в нужный раздел
  let targetRoute = '/unauthorized'
  switch (profile.role) {
    case 'admin':
    case 'owner':
      targetRoute = '/dashboard'
      break
    case 'manager':
      targetRoute = '/orders'
      break
    case 'production':
      targetRoute = '/production/dashboard'
      break
    case 'warehouse':
      targetRoute = '/warehouse/dashboard'
      break
    case 'logistician':
      targetRoute = '/logistician/dashboard'
      break
    case 'driver':
      targetRoute = '/unauthorized'
      break
  }

  redirect(targetRoute)
}

export async function logoutAction() {
  await deleteSessionCookie()
  redirect('/login')
}

export async function changeOwnPasswordAction(newPasswordStr: string) {
  try {
    const profile = await getCurrentProfile()
    if (!profile) return { error: 'Сессия истекла, войдите заново' }

    const passwordError = validatePassword(newPasswordStr)
    if (passwordError) return { error: passwordError }

    const passwordHash = await bcrypt.hash(newPasswordStr, 12)

    const currentPerms = (profile.permissions as Record<string, boolean>) || {}
    const updatedPerms = { ...currentPerms }
    delete updatedPerms.mustChangePassword

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        passwordHash,
        permissions: updatedPerms,
      },
    })

    // Обновляем сессионную куку
    await setSessionCookie({
      userId: profile.id,
      email: profile.email,
      role: profile.role,
      permissions: updatedPerms,
    })

    await prisma.auditLog.create({
      data: {
        userId: profile.id,
        entityType: 'profile',
        entityId: profile.id,
        action: 'change_own_password',
        comment: `Пользователь ${profile.fullName} успешно изменил временный пароль на собственный`
      }
    })

    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Не удалось обновить пароль' }
  }
}
