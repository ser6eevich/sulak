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
