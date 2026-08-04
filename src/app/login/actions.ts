'use server'

import prisma from '@/lib/prisma'
import { setSessionCookie, deleteSessionCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

export async function loginAction(prevState: { error: string } | null, formData: FormData) {
  const loginInput = (formData.get('email') as string || '').trim().toLowerCase()
  const password = formData.get('password') as string

  if (!loginInput || !password) {
    return { error: 'Пожалуйста, заполните все поля' }
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

  if (!profile) {
    return { error: 'Пользователь с таким логином не найден' }
  }

  if (!profile.isActive) {
    return { error: 'Ваш аккаунт заблокирован администратором' }
  }

  // Читаем password_hash напрямую из базы (устойчиво к кэшу Prisma в dev-сервере)
  const rawHashRes = await prisma.$queryRawUnsafe<{ password_hash: string | null }[]>(
    `SELECT password_hash FROM public.profiles WHERE id = $1::uuid`,
    profile.id
  )
  const passwordHash = rawHashRes?.[0]?.password_hash

  // Проверка пароля по хэшу
  if (passwordHash) {
    const isPasswordValid = bcrypt.compareSync(password, passwordHash)
    if (!isPasswordValid) {
      return { error: 'Неверный логин или пароль' }
    }
  } else {
    // При первом входе автоматически сохраняем введённый пароль
    const newHash = bcrypt.hashSync(password, 10)
    await prisma.$executeRawUnsafe(
      `UPDATE public.profiles SET password_hash = $1 WHERE id = $2::uuid`,
      newHash,
      profile.id
    )
  }

  // Устанавливаем локальную сессионную куку
  await setSessionCookie({
    userId: profile.id,
    email: profile.email,
    role: profile.role,
    permissions: (profile.permissions as Record<string, boolean>) || {},
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
    const { getCurrentUserSession } = await import('@/lib/auth')
    const session = await getCurrentUserSession()
    if (!session) return { error: 'Сессия истекла, войдите заново' }

    if (!newPasswordStr || newPasswordStr.length < 3) {
      return { error: 'Пароль должен содержать не менее 3 символов' }
    }

    const profile = await prisma.profile.findUnique({
      where: { id: session.userId }
    })

    if (!profile) return { error: 'Пользователь не найден' }

    const passwordHash = bcrypt.hashSync(newPasswordStr, 10)

    const currentPerms = (profile.permissions as Record<string, boolean>) || {}
    const updatedPerms = { ...currentPerms }
    delete updatedPerms.mustChangePassword

    await prisma.profile.update({
      where: { id: session.userId },
      data: {
        passwordHash,
        permissions: updatedPerms
      }
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
  } catch (error: any) {
    return { error: error.message || 'Не удалось обновить пароль' }
  }
}
