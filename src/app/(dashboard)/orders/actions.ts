'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { normalizePhoneNumber, validatePhoneNumber } from '@/utils/phone'
import { normalizeAddress } from '@/utils/address'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { sendOrderTelegramNotification, getTelegramSettings } from '@/utils/telegram'
import fs from 'node:fs'
import path from 'node:path'

// Схемы валидации
const orderItemSchema = z.object({
  productVariantId: z.string().uuid('Некорректный вариант товара'),
  quantity: z.number().min(1, 'Количество должно быть не менее 1'),
  unitPrice: z.number().min(0, 'Цена продажи не может быть отрицательной'), // в рублях
  subOrderIndex: z.number().min(0).default(0),
  customTableSize: z.string().optional().nullable(),
  customChairsCount: z.number().optional().nullable(),
})

const createOrderSchema = z.object({
  clientName: z.string().min(2, 'ФИО клиента должно быть не менее 2 символов'),
  clientPhone: z.string().refine(val => validatePhoneNumber(val), {
    message: 'Некорректный телефон (ожидается мобильный РФ, например +79991234567)',
  }),
  clientAdditionalPhone: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  discount: z.number().min(0).default(0), // в рублях
  deliveryPrice: z.number().min(0).default(0), // в рублях
  assemblyPrice: z.number().min(0).default(0), // в рублях
  comment: z.string().optional().nullable(),
  sellerId: z.string().uuid('Некорректный продавец'),
  items: z.array(orderItemSchema).min(1, 'В заказе должна быть минимум 1 позиция'),
  customCreatedAt: z.string().optional().nullable(),
  customDeliveredAt: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  paymentStatus: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  plannedDeliveryDate: z.string().optional().nullable(),
})

const updateOrderSchema = createOrderSchema.extend({
  orderId: z.string().uuid('Некорректный ID заказа'),
})

async function checkManagerOrAbove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  return user.id
}

export async function createOrderAction(data: z.infer<typeof createOrderSchema>) {
  try {
    const currentUserId = await checkManagerOrAbove()

    // 1. Валидация входных данных
    const validated = createOrderSchema.parse(data)
    const normalizedPhone = normalizePhoneNumber(validated.clientPhone)

    // 2. Бесшовная CRM-регистрация/поиск клиента в транзакции
    const orderResult = await prisma.$transaction(async (tx) => {
      let client = await tx.client.findUnique({
        where: { primaryPhone: normalizedPhone },
      })

      const normalizedAdditional = validated.clientAdditionalPhone 
        ? normalizePhoneNumber(validated.clientAdditionalPhone) 
        : null

      if (!client) {
        // Создаем нового клиента, если его нет
        client = await tx.client.create({
          data: {
            fullName: validated.clientName,
            primaryPhone: normalizedPhone,
            additionalPhone: normalizedAdditional,
            address: validated.deliveryAddress,
            city: validated.deliveryAddress ? validated.deliveryAddress.split(',')[0] : null, // простая догадка города
            createdBy: currentUserId,
            source: 'Авито', // по умолчанию
          },
        })
      } else {
        // Если клиент найден, но адрес в базе пустой, запишем введенный адрес
        let needsUpdate = false
        const updateData: { address?: string; additionalPhone?: string | null } = {}

        if (!client.address && validated.deliveryAddress) {
          updateData.address = validated.deliveryAddress
          needsUpdate = true
        }

        // Обновим дополнительный телефон, если он введен и отличается
        if (normalizedAdditional && client.additionalPhone !== normalizedAdditional) {
          updateData.additionalPhone = normalizedAdditional
          needsUpdate = true
        }

        if (needsUpdate) {
          client = await tx.client.update({
            where: { id: client.id },
            data: updateData,
          })
        }
      }

      // 3. Вычисляем финансы (в копейках)
      let totalPrice = 0 // сумма всех позиций
      for (const item of validated.items) {
        totalPrice += Math.round(item.quantity * item.unitPrice * 100)
      }

      const discountCents = Math.round(validated.discount * 100)
      const deliveryPriceCents = Math.round(validated.deliveryPrice * 100)
      const assemblyPriceCents = Math.round(validated.assemblyPrice * 100)

      const grandTotalCents = totalPrice + deliveryPriceCents + assemblyPriceCents - discountCents

      // 4. Синхронизируем счетчик номеров заказов с актуальным максимумом
      await tx.$executeRawUnsafe(`
        SELECT setval(
          'orders_number_seq', 
          GREATEST(COALESCE((SELECT MAX(number::INT) FROM orders WHERE number ~ '^[0-9]+$'), 0), 1), 
          true
        );
      `)

      // 5. Создаем заказ с поддержкой ретроспективных дат и статусов
      const order = await tx.order.create({
        data: {
          clientId: client.id,
          status: validated.status || 'pending',
          paymentStatus: validated.paymentStatus || 'unpaid',
          totalPrice,
          discount: discountCents,
          deliveryPrice: deliveryPriceCents,
          assemblyPrice: assemblyPriceCents,
          prepayment: validated.paymentStatus === 'paid' ? grandTotalCents : 0,
          deliveryAddress: validated.deliveryAddress ? normalizeAddress(validated.deliveryAddress) : null,
          comment: validated.comment,
          createdBy: currentUserId,
          sellerId: validated.sellerId,
          createdAt: validated.customCreatedAt ? new Date(validated.customCreatedAt) : new Date(),
          deliveredAt: validated.customDeliveredAt ? new Date(validated.customDeliveredAt) : (validated.status === 'delivered' ? new Date() : null),
          imageUrl: validated.imageUrl,
          plannedDeliveryDate: validated.plannedDeliveryDate ? new Date(validated.plannedDeliveryDate) : null,
        },
      })

      // 5. Создаем позиции заказа
      for (const item of validated.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100),
            subOrderIndex: item.subOrderIndex,
            customTableSize: item.customTableSize || null,
            customChairsCount: item.customChairsCount || null,
          },
        })
      }

      // 6. Лог аудита
      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: order.id,
          action: 'create_order',
          newData: { orderId: order.id, total: grandTotalCents / 100, clientPhone: normalizedPhone },
          comment: 'Создан новый заказ через систему',
        },
      })

      return order
    })

    revalidatePath('/orders')
    
    // Отправляем уведомление в Telegram в фоновом режиме
    sendOrderTelegramNotification(orderResult.id, 'new_order').catch((err) => {
      console.error('Ошибка отправки уведомления в Telegram:', err)
    })

    return { success: true, orderId: orderResult.id }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function updateOrderAction(data: z.infer<typeof updateOrderSchema>) {
  try {
    const currentUserId = await checkManagerOrAbove()

    // 1. Валидация входных данных
    const validated = updateOrderSchema.parse(data)
    const normalizedPhone = normalizePhoneNumber(validated.clientPhone)

    const existingOrder = await prisma.order.findUnique({
      where: { id: validated.orderId },
      include: { client: true, items: true },
    })

    if (!existingOrder) {
      return { error: 'Заказ не найден' }
    }

    const orderResult = await prisma.$transaction(async (tx) => {
      // 2. Обновляем данные клиента
      const normalizedAdditional = validated.clientAdditionalPhone 
        ? normalizePhoneNumber(validated.clientAdditionalPhone) 
        : null

      await tx.client.update({
        where: { id: existingOrder.clientId },
        data: {
          fullName: validated.clientName,
          primaryPhone: normalizedPhone,
          additionalPhone: normalizedAdditional,
          address: validated.deliveryAddress || null,
        },
      })

      // 3. Перерасчитываем суммы
      let totalPrice = 0
      for (const item of validated.items) {
        totalPrice += Math.round(item.quantity * item.unitPrice * 100)
      }

      const discountCents = Math.round(validated.discount * 100)
      const deliveryPriceCents = Math.round(validated.deliveryPrice * 100)
      const assemblyPriceCents = Math.round(validated.assemblyPrice * 100)
      const grandTotalCents = totalPrice + deliveryPriceCents + assemblyPriceCents - discountCents

      // 4. Обновляем сам заказ
      const updatedOrder = await tx.order.update({
        where: { id: validated.orderId },
        data: {
          totalPrice,
          discount: discountCents,
          deliveryPrice: deliveryPriceCents,
          assemblyPrice: assemblyPriceCents,
          prepayment: existingOrder.paymentStatus === 'paid' ? grandTotalCents : existingOrder.prepayment,
          deliveryAddress: validated.deliveryAddress ? normalizeAddress(validated.deliveryAddress) : null,
          comment: validated.comment,
          sellerId: validated.sellerId,
          imageUrl: validated.imageUrl !== undefined ? validated.imageUrl : existingOrder.imageUrl,
          plannedDeliveryDate: validated.plannedDeliveryDate ? new Date(validated.plannedDeliveryDate) : null,
        },
      })

      // 5. Безопасно пересоздаем позиции заказа
      await tx.orderItem.deleteMany({
        where: { orderId: validated.orderId },
      })

      for (const item of validated.items) {
        await tx.orderItem.create({
          data: {
            orderId: validated.orderId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100),
            subOrderIndex: item.subOrderIndex,
            customTableSize: item.customTableSize || null,
            customChairsCount: item.customChairsCount || null,
          },
        })
      }

      // 6. Фиксируем аудит-лог изменений
      const orderNumStr = existingOrder.number ? `№${existingOrder.number}` : `#${existingOrder.id.slice(-6).toUpperCase()}`
      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: validated.orderId,
          action: 'update_order',
          oldData: { totalPrice: existingOrder.totalPrice, discount: existingOrder.discount, sellerId: existingOrder.sellerId },
          newData: { totalPrice, discount: discountCents, sellerId: validated.sellerId, grandTotal: grandTotalCents / 100 },
          comment: `Отредактированы данные и состав заказа ${orderNumStr}`,
        },
      })

      return updatedOrder
    })

    revalidatePath('/orders')
    revalidatePath('/payroll')
    revalidatePath('/dashboard')

    return { success: true, orderId: orderResult.id }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: error instanceof Error ? error.message : 'Ошибка при редактировании заказа' }
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  newStatus: string,
  comment?: string | null,
  driverId?: string | null,
  customDeliveredAt?: string | null
) {
  try {
    const currentUserId = await checkManagerOrAbove()

    if (newStatus === 'cancelled' && (!comment || !comment.trim())) {
      return { error: 'Необходимо указать причину отмены заказа' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    // Проверка восстановления из отмененного (только admin и owner)
    if (order.status === 'cancelled' && newStatus !== 'cancelled') {
      const userProfile = await prisma.profile.findUnique({
        where: { id: currentUserId },
      })
      if (!userProfile || !['admin', 'owner'].includes(userProfile.role)) {
        return { error: 'Восстановить отмененный заказ может только администратор или руководитель' }
      }
    }

    const oldData = { status: order.status, driverId: order.driverId }
    const newData = { status: newStatus, driverId: newStatus === 'delivery' ? driverId : (newStatus === 'delivered' ? order.driverId : null) }

    await prisma.$transaction(async (tx) => {
      const updateData: { 
        status: string; 
        driverId?: string | null; 
        deliveredAt?: Date | null;
        shippedAt?: Date | null;
        deliveryAlertSent?: boolean;
        staleAlertStatus?: string | null;
      } = { status: newStatus, staleAlertStatus: null }

      if (newStatus === 'delivery' && driverId) {
        updateData.driverId = driverId
        updateData.shippedAt = new Date()
        updateData.deliveryAlertSent = false
      } else if (newStatus !== 'delivery' && newStatus !== 'delivered') {
        updateData.driverId = null
        updateData.shippedAt = null
        updateData.deliveryAlertSent = false
      }

      if (newStatus === 'delivered') {
        updateData.deliveredAt = customDeliveredAt ? new Date(customDeliveredAt) : new Date()
      } else if (order.status === 'delivered' && newStatus !== 'delivered') {
        updateData.deliveredAt = null
      }

      // Обновляем статус заказа
      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      })

      const statusLabels: Record<string, string> = {
        pending: 'Ожидает подтверждения',
        confirmed: 'Подтвержден',
        production: 'Отправлен на производство',
        warehouse: 'На складе',
        awaiting_delivery: 'Ожидает Доставку',
        delivery: 'Доставляется',
        delivered: 'Доставлен',
        cancelled: 'Отменен',
      }

      let driverName = ''
      if (newStatus === 'delivery' && driverId) {
        const dProfile = await tx.profile.findUnique({ where: { id: driverId } })
        if (dProfile) driverName = dProfile.fullName
      }

      const statusLabel = statusLabels[newStatus] || newStatus
      const auditComment = `Статус изменен на "${statusLabel}"${driverName ? ` (Водитель: ${driverName})` : ''}.${comment && comment.trim() ? ` Комментарий: ${comment.trim()}` : ''}`

      // Записываем лог в аудит
      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'update_status',
          oldData,
          newData,
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
        console.error('Ошибка отправки ТГ уведомления о доставке:', err)
      })
    } else if (newStatus === 'cancelled') {
      sendOrderTelegramNotification(orderId, 'cancelled', comment).catch(err => {
        console.error('Ошибка отправки ТГ уведомления об отмене:', err)
      })
    }

    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function searchClientByPhoneAction(phone: string) {
  try {
    const normalized = normalizePhoneNumber(phone)
    if (normalized.length < 3) return []
    
    return await prisma.client.findMany({
      where: {
        primaryPhone: { contains: normalized },
        archivedAt: null,
      },
      take: 5,
    })
  } catch {
    return []
  }
}

export async function getOrderAuditLogsAction(orderId: string) {
  try {
    return await prisma.auditLog.findMany({
      where: {
        entityType: 'order',
        entityId: orderId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
      },
    })
  } catch {
    return []
  }
}

export async function deleteOrderAction(orderId: string) {
  try {
    const currentUserId = await checkManagerOrAbove()

    const profile = await prisma.profile.findUnique({
      where: { id: currentUserId },
    })

    if (!profile || !['admin', 'owner'].includes(profile.role)) {
      return { error: 'Недостаточно прав для удаления заказа' }
    }

    const orderTarget = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, number: true, clientId: true },
    })

    if (!orderTarget) {
      return { error: 'Заказ не найден' }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Удаляем позиции заказа
      await tx.orderItem.deleteMany({
        where: { orderId },
      })

      // 2. Удаляем аудит-логи заказа
      await tx.auditLog.deleteMany({
        where: { entityType: 'order', entityId: orderId },
      })

      // 3. Удаляем сам заказ
      await tx.order.delete({
        where: { id: orderId },
      })

      // 4. Проверяем, остались ли еще заказы у клиента. Если нет - удаляем клиента
      const remainingOrdersCount = await tx.order.count({
        where: { clientId: orderTarget.clientId },
      })

      if (remainingOrdersCount === 0) {
        await tx.client.delete({
          where: { id: orderTarget.clientId },
        })
      }

      // 5. Записываем системный лог удаления
      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'delete_order',
          comment: `Удален заказ №${orderTarget.number || orderId}`,
        },
      })
    })

    // 6. Корректируем генератор номеров (sequence) под актуальный максимальный номер
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        'orders_number_seq', 
        COALESCE((SELECT MAX(number::INT) FROM orders WHERE number ~ '^[0-9]+$'), 0) + 1, 
        false
      );
    `)

    revalidatePath('/orders')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function updateOrderFeedbackAction(
  orderId: string,
  feedbackType: string,
  feedbackAuthor: string,
  feedbackUrl: string
) {
  try {
    const currentUserId = await checkManagerOrAbove()

    if (!['none', 'no_photo', 'with_photo'].includes(feedbackType)) {
      return { error: 'Некорректный тип отзыва' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    const oldData = {
      feedbackType: order.feedbackType,
      feedbackAuthor: order.feedbackAuthor,
      feedbackUrl: order.feedbackUrl,
    }

    const newData = {
      feedbackType,
      feedbackAuthor: feedbackAuthor.trim() || null,
      feedbackUrl: feedbackUrl.trim() || null,
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: newData,
      })

      const feedbackLabels: Record<string, string> = {
        none: 'Без отзыва',
        no_photo: 'Отзыв без фото',
        with_photo: 'Отзыв с фото',
      }

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'update_feedback',
          oldData,
          newData,
          comment: `Обновлены данные отзыва: ${feedbackLabels[feedbackType]}.${feedbackAuthor.trim() ? ` Автор: ${feedbackAuthor.trim()}.` : ''}${feedbackUrl.trim() ? ` Ссылка: ${feedbackUrl.trim()}` : ''}`,
        },
      })
    })

    revalidatePath('/orders')
    revalidatePath('/payroll')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function updateOrderImageAction(
  orderId: string, 
  imageUrl: string | null, 
  subOrderIndex?: number | null,
  deleteImageIndex?: number | null
) {
  try {
    const currentUserId = await checkManagerOrAbove()

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return { error: 'Заказ не найден' }
    }

    const oldData = { imageUrl: order.imageUrl }

    let newImageUrlValue: string | null

    if (subOrderIndex !== null && subOrderIndex !== undefined) {
      let imagesMap: Record<string, string[]> = {}

      if (order.imageUrl) {
        try {
          const parsed = JSON.parse(order.imageUrl)
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            imagesMap = Object.fromEntries(
              Object.entries(parsed as Record<string, unknown>).map(([mapKey, value]) => [
                mapKey,
                Array.isArray(value)
                  ? value.filter((item): item is string => typeof item === 'string')
                  : typeof value === 'string' ? [value] : [],
              ])
            )
          }
        } catch {
          imagesMap = { '0': [order.imageUrl] }
        }
      }

      const key = String(subOrderIndex)
      if (imageUrl === null) {
        if (deleteImageIndex !== null && deleteImageIndex !== undefined) {
          imagesMap[key] = (imagesMap[key] || []).filter((_, index) => index !== deleteImageIndex)
          if (imagesMap[key].length === 0) delete imagesMap[key]
        } else {
          delete imagesMap[key]
        }
      } else {
        imagesMap[key] = [...(imagesMap[key] || []), imageUrl]
      }

      newImageUrlValue = Object.keys(imagesMap).length > 0 ? JSON.stringify(imagesMap) : null
    } else {
      newImageUrlValue = imageUrl
    }

    const newData = { imageUrl: newImageUrlValue }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { imageUrl: newImageUrlValue }
      })

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'order',
          entityId: orderId,
          action: 'update_image',
          oldData,
          newData,
          comment: imageUrl 
            ? (subOrderIndex !== null && subOrderIndex !== undefined ? `Прикреплено фото к позиции заказа №${subOrderIndex + 1}` : 'Прикреплено фото комплекта к заказу')
            : (subOrderIndex !== null && subOrderIndex !== undefined ? `Удалено фото позиции заказа №${subOrderIndex + 1}` : 'Удалено фото комплекта из заказа'),
        }
      })
    })

    revalidatePath('/orders')
    return { success: true, imageUrl: newImageUrlValue }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Не удалось обновить изображение заказа' }
  }
}

export async function sendTelegramNotification(orderId: string) {
  try {
    const { chatId, token, siteUrl, topics } = await getTelegramSettings()
    if (!token || !chatId) {
      console.warn('Telegram уведомления не настроены: отсутствует TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID')
      return
    }

    const targetTopic = topics?.new_orders || topics?.general
    const messageThreadId = (targetTopic && !isNaN(parseInt(targetTopic, 10))) ? parseInt(targetTopic, 10) : undefined

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        seller: {
          select: { fullName: true }
        },
        creator: {
          select: { fullName: true }
        },
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    })

    if (!order) return

    const dateObj = new Date(order.createdAt)
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}`

    const groupedItemsMap = new Map<number, typeof order.items>()
    for (const item of order.items) {
      if (!groupedItemsMap.has(item.subOrderIndex)) {
        groupedItemsMap.set(item.subOrderIndex, [])
      }
      groupedItemsMap.get(item.subOrderIndex)!.push(item)
    }

    const uniqueSubordersCount = groupedItemsMap.size
    const itemsPricesParts: string[] = []
    for (const [, subItems] of Array.from(groupedItemsMap.entries()).sort((a, b) => a[0] - b[0])) {
      const subTotal = subItems.reduce((sum, it) => sum + (it.unitPrice / 100) * it.quantity, 0)
      itemsPricesParts.push(subTotal.toLocaleString('ru-RU'))
    }

    const phones = [order.client.primaryPhone, order.client.additionalPhone].filter(Boolean).join(', ')

    const grandTotalCents = order.totalPrice - order.discount + order.deliveryPrice + order.assemblyPrice
    const grandTotalText = (grandTotalCents / 100).toLocaleString('ru-RU')
    const commentLine = order.comment ? `\n\n💬 <i>${order.comment}</i>` : ''

    const appBaseUrl = siteUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://sulak.ru'
    const orderLink = `${appBaseUrl.replace(/\/$/, '')}/orders?id=${order.number || order.id}`

    // Формируем финансовую сводку
    const financialParts: string[] = []
    if (uniqueSubordersCount > 1) {
      itemsPricesParts.forEach((p, i) => financialParts.push(`Заказ ${i + 1}: ${p} ₽`))
    }
    if (order.discount > 0) {
      financialParts.push(`🏷️ <b>Скидка:</b> -${(order.discount / 100).toLocaleString('ru-RU')} ₽`)
    }
    if (order.deliveryPrice > 0) {
      financialParts.push(`📦 <b>Доставка:</b> ${(order.deliveryPrice / 100).toLocaleString('ru-RU')} ₽`)
    }
    if (order.assemblyPrice > 0) {
      financialParts.push(`🛠️ <b>Сборка:</b> ${(order.assemblyPrice / 100).toLocaleString('ru-RU')} ₽`)
    }
    financialParts.push(`<b>💳 Итого к оплате: ${grandTotalText} ₽</b>`)

    const priceBlock = financialParts.join('\n')

    // Строим детали по подзаказам
    const subOrdersHtml: string[] = []
    let orderNumCounter = 1
    for (const [, items] of Array.from(groupedItemsMap.entries()).sort((a, b) => a[0] - b[0])) {
      const subTotal = items.reduce((sum, it) => sum + (it.unitPrice / 100) * it.quantity, 0)
      const lines = items.map(it => {
        let desc = it.variant.product.name
        
        // Отображаем кастомный размер стола, если он задан
        const sizeToShow = it.customTableSize || it.variant.size
        const attrs = [sizeToShow, it.variant.color, it.variant.material].filter(Boolean).join(', ')
        if (attrs) desc += ` (${attrs})`
        
        // Отображаем кастомное кол-во стульев, если оно задано
        if (it.customChairsCount !== null && it.customChairsCount !== undefined) {
          desc += ` [Стульев: ${it.customChairsCount} шт]`
        }
        
        return `  • ${desc}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`
      }).join('\n')
      subOrdersHtml.push(
        uniqueSubordersCount > 1
          ? `<b>Заказ ${orderNumCounter}:</b>\n${lines}\n  💰 ${subTotal.toLocaleString('ru-RU')} ₽`
          : `${lines}`
      )
      orderNumCounter++
    }

    // Умная дедупликация адреса, чтобы не писать город/регион дважды
    const formatAddressHelper = (region?: string | null, city?: string | null, addr?: string | null) => {
      const parts: string[] = []
      if (region && region.trim()) {
        parts.push(region.trim())
      }
      if (city && city.trim() && (!region || !region.toLowerCase().includes(city.trim().toLowerCase()))) {
        parts.push(city.trim())
      }
      if (addr && addr.trim()) {
        let cleanAddr = addr.trim()
        for (const p of parts) {
          if (cleanAddr.toLowerCase().startsWith(p.toLowerCase())) {
            cleanAddr = cleanAddr.slice(p.length).replace(/^[,\s]+/, '').trim()
          }
        }
        if (cleanAddr) parts.push(cleanAddr)
      }
      return parts.join(', ')
    }

    const addressParts = formatAddressHelper(order.client.region, order.client.city, order.deliveryAddress)
    const phoneLine = phones ? `📞 <code>${phones}</code>` : ''
    
    // Продавец (кто продал) и оформитель (кто ввел в систему)
    const sellerLine = order.seller ? `\n💼 <b>Продавец:</b> ${order.seller.fullName}` : ''
    const creatorLine = order.creator ? `\n👤 <b>Оформил:</b> ${order.creator.fullName}` : ''

    const textMessage = `🛒 <b>Новый заказ №${order.number}</b>  |  ${formattedDate}
──────────────
👤 <b>Клиент:</b> ${order.client.fullName}
${phoneLine}
${addressParts ? `📍 ${addressParts}` : ''}${sellerLine}${creatorLine}
──────────────
${subOrdersHtml.join('\n\n')}
──────────────
${priceBlock}${commentLine}`

    // Кнопка перехода к заказу
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: `🔗 Перейти к заказу №${order.number}`,
            url: orderLink
          }
        ]
      ]
    }

    // Извлекаем все доступные фото из imageUrl (может быть строкой или JSON-картой {"0": "url1", "1": "url2"})
    let photoUrls: string[] = []
    if (order.imageUrl) {
      try {
        const parsed = JSON.parse(order.imageUrl)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          photoUrls = Object.keys(parsed)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => parsed[k])
            .filter(Boolean)
        }
      } catch {
        photoUrls = [order.imageUrl]
      }
    }

    const isLocalPath = (url: string) =>
      url.startsWith('/uploads/') || url.startsWith('/public/')

    const readLocalFile = (url: string): Buffer | null => {
      try {
        const cleanPath = url.startsWith('/uploads/')
          ? `uploads/${url.slice('/uploads/'.length)}`
          : url.startsWith('/public/')
            ? url.slice('/public/'.length)
            : null
        if (!cleanPath) return null
        const fullPath = path.join(process.cwd(), 'public', cleanPath)
        if (!fs.existsSync(fullPath)) return null
        return fs.readFileSync(fullPath)
      } catch {
        return null
      }
    }

    // Определяем какие фото локальные, а какие — удалённые
    const localPhotos  = photoUrls.filter(u => isLocalPath(u))
    const remotePhotos = photoUrls.filter(u => u.startsWith('http://') || u.startsWith('https://'))

    const allRemote = remotePhotos

    if (localPhotos.length > 0) {
      const localBuffers: { buf: Buffer; ext: string; fieldName: string }[] = []
      for (let i = 0; i < localPhotos.length; i++) {
        const buf = readLocalFile(localPhotos[i])
        if (buf) {
          const ext = localPhotos[i].split('.').pop() || 'jpg'
          localBuffers.push({ buf, ext, fieldName: `photo${i}` })
        }
      }

      if (localBuffers.length === 1) {
        // ── Одно фото → sendPhoto ──
        const { buf, ext, fieldName } = localBuffers[0]
        const form = new FormData()
        form.append('chat_id', chatId)
        if (messageThreadId) form.append('message_thread_id', String(messageThreadId))
        form.append('caption', textMessage)
        form.append('parse_mode', 'HTML')
        form.append('reply_markup', JSON.stringify(replyMarkup))
        form.append('photo', new Blob([new Uint8Array(buf)], { type: `image/${ext}` }), `${fieldName}.${ext}`)
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          console.error('Ошибка отправки фото (файл) в Telegram:', await res.text())
        }
      } else if (localBuffers.length > 1) {
        // ── Несколько фото → sendMediaGroup с attach:// — один альбом в одном сообщении ──
        const form = new FormData()
        form.append('chat_id', chatId)
        if (messageThreadId) form.append('message_thread_id', String(messageThreadId))

        const media = localBuffers.map(({ fieldName }, idx) => ({
          type: 'photo',
          media: `attach://${fieldName}`,
          ...(idx === 0 ? { caption: textMessage, parse_mode: 'HTML' } : {}),
        }))
        form.append('media', JSON.stringify(media))

        for (const { buf, ext, fieldName } of localBuffers) {
          form.append(fieldName, new Blob([new Uint8Array(buf)], { type: `image/${ext}` }), `${fieldName}.${ext}`)
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          console.error('Ошибка отправки альбома (файлы) в Telegram:', await res.text())
        }
      } else {
        console.warn('Ни один локальный файл фото не найден, отправляем только текст')
      }
    } else if (allRemote.length > 1) {
      // ── Несколько удалённых фото → sendMediaGroup ──
      const url = `https://api.telegram.org/bot${token}/sendMediaGroup`
      const media = allRemote.map((photoUrl, idx) => ({
        type: 'photo',
        media: photoUrl,
        ...(idx === 0 ? { caption: textMessage, parse_mode: 'HTML' } : {})
      }))
      const payload: { chat_id: string; media: typeof media; message_thread_id?: number } = { chat_id: chatId, media }
      if (messageThreadId) payload.message_thread_id = messageThreadId
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('Ошибка отправки альбома в Telegram:', errText)
      }
    } else if (allRemote.length === 1) {
      // ── Одно удалённое фото → sendPhoto по URL ──
      const url = `https://api.telegram.org/bot${token}/sendPhoto`
      const payload: {
        chat_id: string
        photo: string
        caption: string
        parse_mode: string
        reply_markup: typeof replyMarkup
        message_thread_id?: number
      } = {
        chat_id: chatId,
        photo: allRemote[0],
        caption: textMessage,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      }
      if (messageThreadId) payload.message_thread_id = messageThreadId
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('Ошибка отправки фото в Telegram:', errText)
      }
    } else {
      // ── Нет фото → отправляем только текст ──
      const url = `https://api.telegram.org/bot${token}/sendMessage`
      const payload: {
        chat_id: string
        text: string
        parse_mode: string
        reply_markup: typeof replyMarkup
        message_thread_id?: number
      } = {
        chat_id: chatId,
        text: textMessage,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      }
      if (messageThreadId) payload.message_thread_id = messageThreadId
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('Ошибка отправки сообщения в Telegram:', errText)
      }
    }
  } catch (err) {
    console.error('Ошибка в sendTelegramNotification:', err)
  }
}


/**
 * Пакетная отметка заказов как "Доставлен" по массиву ID заказов с опциональной датой доставки
 */
export async function batchUpdateOrdersDeliveredAction(orderIds: string[], customDeliveredAt?: string | null) {
  try {
    const currentUserId = await checkManagerOrAbove()

    if (!orderIds || orderIds.length === 0) {
      return { error: 'Не выбраны заказы для обновления' }
    }

    let updatedCount = 0
    const deliveryDate = customDeliveredAt ? new Date(customDeliveredAt) : new Date()

    for (const orderId of orderIds) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      })

      if (!order) continue

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'delivered',
            deliveredAt: deliveryDate,
            deliveryAlertSent: true,
            staleAlertStatus: null,
          },
        })

        const orderNumStr = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
        await tx.auditLog.create({
          data: {
            userId: currentUserId,
            entityType: 'order',
            entityId: order.id,
            action: 'batch_update_delivered',
            oldData: { status: order.status, deliveredAt: order.deliveredAt },
            newData: { status: 'delivered', deliveredAt: deliveryDate },
            comment: `Заказ ${orderNumStr} отмечен как ДОСТАВЛЕН (${deliveryDate.toLocaleDateString('ru-RU')}) в пакетном режиме`,
          },
        })
      })

      // Отправка Telegram-уведомления о доставке
      try {
        await sendOrderTelegramNotification(order.id, 'delivered')
      } catch (tgErr) {
        console.error('Ошибка отправки ТГ уведомления при пакетной доставке:', tgErr)
      }

      updatedCount++
    }

    revalidatePath('/orders')
    revalidatePath('/payroll')
    revalidatePath('/dashboard')
    revalidatePath('/logistician/dashboard')

    return { success: true, updatedCount }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка при пакетном обновлении заказов' }
  }
}
