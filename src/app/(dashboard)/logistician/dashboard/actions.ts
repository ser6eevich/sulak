'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendOrderTelegramNotification } from '@/utils/telegram'

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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтвержден',
  production: 'Отправлен на производство',
  warehouse: 'На складе',
  awaiting_delivery: 'Ожидает Доставку',
  delivery: 'В пути / Доставляется',
  delivered: 'Доставлен',
  cancelled: 'Отменен',
}

export async function updateOrderStatusInLogisticsAction(
  orderId: string, 
  newStatus: string, 
  comment?: string,
  driverId?: string | null,
  customDeliveredAt?: string | null
) {
  try {
    const currentUserId = await checkLogisticianOrAbove()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    const oldData = { status: order.status, driverId: order.driverId }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      status: newStatus,
    }

    if (driverId !== undefined) {
      updateData.driverId = driverId || null
    }

    if (newStatus === 'delivery' && !order.shippedAt) {
      updateData.shippedAt = new Date()
      updateData.deliveryAlertSent = false
    }

    if (newStatus === 'delivered') {
      updateData.deliveredAt = customDeliveredAt ? new Date(customDeliveredAt) : new Date()
    }

    const statusLabel = STATUS_LABELS[newStatus] || newStatus
    const auditComment = `Статус заказа в логистике изменен на "${statusLabel}".${comment && comment.trim() ? ` Комментарий: ${comment.trim()}` : ''}`

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      })

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'update_status_logistics',
          oldData,
          newData: { status: newStatus, driverId: updateData.driverId },
          comment: auditComment,
        },
      })
    })

    if (newStatus === 'delivery') {
      sendOrderTelegramNotification(orderId, 'delivering').catch(err => {
        console.error('Ошибка отправки ТГ уведомления о передаче в доставку:', err)
      })
    } else if (newStatus === 'delivered') {
      sendOrderTelegramNotification(orderId, 'delivered').catch(err => {
        console.error('Ошибка отправки ТГ уведомления о доставке из логистики:', err)
      })
    } else if (newStatus === 'cancelled') {
      sendOrderTelegramNotification(orderId, 'cancelled', comment).catch(err => {
        console.error('Ошибка отправки ТГ уведомления об отмене:', err)
      })
    }

    revalidatePath('/logistician/dashboard')
    revalidatePath('/drivers')
    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function assignDriverAction(orderId: string, driverId: string, comment: string) {
  try {
    const currentUserId = await checkLogisticianOrAbove()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    const driver = await prisma.profile.findUnique({
      where: { id: driverId },
    })

    if (!driver || driver.role !== 'driver') {
      return { error: 'Указанный пользователь не является водителем' }
    }

    const oldData = { status: order.status, driverId: order.driverId }
    const newData = { status: 'delivery', driverId: driverId }
    const auditComment = `Заказ передан водителю ${driver.fullName} и отправлен в доставку.${comment.trim() ? ` Комментарий: ${comment.trim()}` : ''}`

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'delivery',
          driverId: driverId,
          shippedAt: new Date(),
          deliveryAlertSent: false,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'assign_driver',
          oldData,
          newData,
          comment: auditComment,
        },
      })
    })

    revalidatePath('/logistician/dashboard')
    revalidatePath('/drivers')
    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function checkAndSendDeliveryAlerts() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
      console.warn('Telegram уведомления не настроены: отсутствует TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID')
      return { success: false, error: 'Telegram не настроен' }
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Ищем заказы в доставке более 7 дней, по которым еще не слали алерт
    const delayedOrders = await prisma.order.findMany({
      where: {
        status: 'delivery',
        shippedAt: {
          not: null,
          lte: sevenDaysAgo,
        },
        deliveryAlertSent: false,
      },
      include: {
        client: true,
        driver: true,
      },
    })

    if (delayedOrders.length === 0) {
      return { success: true, count: 0 }
    }

    for (const order of delayedOrders) {
      const shippedDate = order.shippedAt ? new Date(order.shippedAt) : new Date(order.createdAt)
      const diffTime = Math.abs(new Date().getTime() - shippedDate.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      const daysWord = diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'
      const shippedDateStr = shippedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

      const textMessage = `🚨 <b>Долгая доставка — требуется реакция</b>

📦 Заказ <b>№${order.number}</b> находится в пути уже <b>${diffDays} ${daysWord}</b>
📅 Отправлен: ${shippedDateStr}

─────────────────────────
👤 <b>Клиент:</b> ${order.client.fullName}
📞 <b>Телефон:</b> <code>${order.client.primaryPhone}</code>
📍 <b>Адрес:</b> ${order.deliveryAddress || 'Не указан'}
─────────────────────────
🚗 <b>Водитель:</b> ${order.driver?.fullName || '—'}

⚡️ <i>Пожалуйста, свяжитесь с заказчиком и водителем!</i>`

      const url = `https://api.telegram.org/bot${token}/sendMessage`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: textMessage,
          parse_mode: 'HTML',
        })
      })

      if (res.ok) {
        // Помечаем, что алерт отправлен
        await prisma.order.update({
          where: { id: order.id },
          data: { deliveryAlertSent: true },
        })
      } else {
        const errText = await res.text()
        console.error(`Ошибка отправки алерта по заказу №${order.number} в Telegram:`, errText)
      }
    }

    return { success: true, count: delayedOrders.length }
  } catch (error: unknown) {
    console.error('Ошибка в checkAndSendDeliveryAlerts:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
