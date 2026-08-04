'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { sendOrderDeliveredTelegramNotification } from '@/utils/telegram'

async function checkLogisticianOrAbove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager', 'logistician'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  return user.id
}

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

export async function createDriverAction(fullName: string, phone: string, direction?: string | null) {
  try {
    await checkAdminOrOwner()

    if (!fullName.trim() || !phone.trim()) {
      return { error: 'ФИО и телефон обязательны' }
    }

    const uuid = randomUUID()
    const email = `driver-${uuid.slice(0, 8)}@sulak.ru`
    const metaDataStr = JSON.stringify({ full_name: fullName.trim(), role: 'driver' })

    await prisma.$transaction(async (tx) => {
      // 1. Создаем пользователя в auth.users через сырой SQL, чтобы удовлетворить внешний ключ profiles_id_fkey
      await tx.$executeRawUnsafe(
        `INSERT INTO auth.users (id, email, aud, role, is_sso_user, is_anonymous, email_confirmed_at, raw_user_meta_data)
         VALUES ($1::uuid, $2, 'authenticated', 'authenticated', false, false, now(), $3::jsonb)`,
        uuid,
        email,
        metaDataStr
      )

      // 2. Поскольку триггер on_auth_user_created в Supabase автоматически создает профиль,
      // мы просто обновляем его, добавляя номер телефона и направление.
      await tx.profile.update({
        where: { id: uuid },
        data: {
          phone: phone.trim(),
          direction: direction && direction.trim() ? direction.trim() : null,
        },
      })
    })

    revalidatePath('/drivers')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function completeDeliveryFromDriversAction(orderId: string, comment: string) {
  try {
    const currentUserId = await checkLogisticianOrAbove()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    const oldData = { status: order.status }
    const newData = { status: 'delivered' }
    const auditComment = `Доставка заказа завершена логистом/менеджером.${comment.trim() ? ` Комментарий: ${comment.trim()}` : ''}`

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'delivered' },
      })

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'complete_delivery',
          oldData,
          newData,
          comment: auditComment,
        },
      })
    })

    sendOrderDeliveredTelegramNotification(orderId).catch(err => {
      console.error('Ошибка отправки ТГ уведомления о доставке водителем:', err)
    })

    revalidatePath('/drivers')
    revalidatePath('/logistician/dashboard')
    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function returnToWarehouseFromDriversAction(orderId: string, reason: string) {
  try {
    const currentUserId = await checkLogisticianOrAbove()

    if (!reason.trim()) {
      return { error: 'Необходимо указать причину возврата на склад' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    const oldData = { status: order.status, driverId: order.driverId }
    const newData = { status: 'warehouse', driverId: null }
    const auditComment = `Возврат заказа на склад. Причина: ${reason.trim()}`

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'warehouse',
          driverId: null,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'return_to_warehouse',
          oldData,
          newData,
          comment: auditComment,
        },
      })
    })

    revalidatePath('/drivers')
    revalidatePath('/logistician/dashboard')
    revalidatePath('/warehouse/dashboard')
    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
