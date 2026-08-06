'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendOrderDeliveredTelegramNotification } from '@/utils/telegram'
import { requireRole } from '@/lib/auth/dal'
import { validatePassword } from '@/lib/auth/password'
import { defaultPermissionsForRole } from '@/lib/auth/permissions'

async function checkLogisticianOrAbove() {
  const profile = await requireRole(['admin', 'owner', 'manager', 'logistician'])
  return profile.id
}

async function checkAdminOrOwner() {
  return requireRole(['admin', 'owner'])
}

export async function createDriverAction(
  fullName: string,
  phone: string,
  direction: string | null | undefined,
  password: string
) {
  try {
    await checkAdminOrOwner()

    if (!fullName.trim() || !phone.trim()) {
      return { error: 'ФИО и телефон обязательны' }
    }

    const passwordError = validatePassword(password)
    if (passwordError) return { error: passwordError }

    const uuid = randomUUID()
    const email = `driver-${uuid.slice(0, 8)}@sulak.ru`
    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.profile.create({
      data: {
        id: uuid,
        email,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: 'driver',
        direction: direction?.trim() || null,
        passwordHash,
        permissions: defaultPermissionsForRole('driver'),
        isActive: true,
      },
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
