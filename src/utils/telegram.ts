import prisma from '@/lib/prisma'
import { normalizeAddress } from './address'

export interface TelegramTopics {
  new_orders?: string
  production?: string
  warehouse?: string
  logistics?: string
  delivered?: string
  cancelled?: string
  general?: string
  reviews?: string
}

export async function getTelegramSettings() {
  let chatId = process.env.TELEGRAM_CHAT_ID || ''
  let token = process.env.TELEGRAM_BOT_TOKEN || ''
  let ownerTag = ''
  let warehouseTag = ''
  let siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''

  const topics: Record<string, string> = {
    new_orders: '',
    production: '',
    warehouse: '',
    logistics: '',
    delivered: '',
    cancelled: '',
    general: '',
    reviews: '',
  }

  const thresholds: Record<string, number> = {
    pending: 24,
    confirmed: 48,
    production: 96,
    production_completed: 96,
    warehouse: 48,
    delivery: 48,
    awaiting_delivery: 48,
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
      `SELECT key, value FROM public.system_settings WHERE key LIKE 'telegram_%' OR key LIKE 'stale_threshold_%'`
    )
    for (const r of rows) {
      if (r.key === 'telegram_chat_id' && r.value) chatId = r.value.trim()
      if (r.key === 'telegram_bot_token' && r.value) token = r.value.trim()
      if (r.key === 'telegram_owner_tag' && r.value) ownerTag = r.value.trim()
      if (r.key === 'telegram_warehouse_tag' && r.value) warehouseTag = r.value.trim()
      if (r.key === 'telegram_site_url' && r.value) siteUrl = r.value.trim()

      if (r.key.startsWith('telegram_topic_')) {
        const topicKey = r.key.replace('telegram_topic_', '')
        if (r.value) topics[topicKey] = r.value.trim()
      }

      if (r.key.startsWith('stale_threshold_')) {
        const statusKey = r.key.replace('stale_threshold_', '')
        const numVal = parseInt(r.value, 10)
        if (!isNaN(numVal) && numVal > 0) {
          thresholds[statusKey] = numVal
          if (statusKey === 'production') thresholds.production_completed = numVal
          if (statusKey === 'delivery') thresholds.awaiting_delivery = numVal
        }
      }
    }
  } catch (err) {
    console.error('Ошибка чтения настроек Telegram из системы:', err)
  }

  if (ownerTag && !ownerTag.startsWith('@')) ownerTag = `@${ownerTag}`
  if (warehouseTag && !warehouseTag.startsWith('@')) warehouseTag = `@${warehouseTag}`

  return { chatId, token, ownerTag, warehouseTag, siteUrl, thresholds, topics }
}

export async function sendOrderDeliveredTelegramNotification(orderId: string) {
  try {
    const { chatId, token, siteUrl, topics } = await getTelegramSettings()

    if (!token || !chatId) {
      console.warn('Telegram не настроен (TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не задан)')
      return
    }

    // Загружаем полный заказ с клиентом, продавцом, создателем и водителем
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        seller: true,
        creator: true,
        driver: true,
      },
    })

    if (!order) return

    // Определяем продавца / менеджера
    const manager = order.seller || order.creator
    const managerName = manager?.fullName || 'Менеджер не указан'

    // Форматируем Telegram тег (с фоллбэком на прямой SQL запрос)
    let managerTag = (manager as any)?.telegramUsername?.trim() || ''

    if (!managerTag && manager?.id) {
      const rawRes = await prisma.$queryRawUnsafe<{ telegram_username: string | null }[]>(
        `SELECT telegram_username FROM public.profiles WHERE id = $1::uuid`,
        manager.id
      )
      if (rawRes && rawRes.length > 0 && rawRes[0].telegram_username) {
        managerTag = rawRes[0].telegram_username.trim()
      }
    }

    if (managerTag && !managerTag.startsWith('@')) {
      managerTag = `@${managerTag}`
    }

    const orderNumStr = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
    const totalPriceFormatted = (
      ((order.totalPrice || 0) - (order.discount || 0) + (order.deliveryPrice || 0) + (order.assemblyPrice || 0)) / 100
    ).toLocaleString('ru-RU')

    // Текст с тегом менеджера и просьбой запросить отзыв
    const tagMention = managerTag 
      ? `💬 <b>${managerTag}</b>, пожалуйста, запроси отзыв у клиента! ⭐`
      : `💬 <b>${managerName}</b>, пожалуйста, запроси отзыв у клиента! ⭐`

    const appUrl = siteUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://sulak.ru'
    const orderLink = `${appUrl.replace(/\/$/, '')}/orders?id=${order.number || order.id}`

    const textMessage = `🎉 <b>Заказ ${orderNumStr} успешно ДОСТАВЛЕН!</b>

─────────────────────────
👤 <b>Клиент:</b> ${order.client.fullName}
📞 <b>Телефон:</b> <code>${order.client.primaryPhone}</code>
📍 <b>Адрес:</b> ${normalizeAddress(order.deliveryAddress) || 'Не указан'}
💰 <b>Сумма:</b> ${totalPriceFormatted} ₽
🚗 <b>Водитель:</b> ${order.driver?.fullName || 'Не назначен'}
─────────────────────────
👨‍💼 <b>Продавец:</b> ${managerName} ${managerTag ? `(${managerTag})` : ''}

${tagMention}`

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: `🔗 Перейти к заказу ${orderNumStr}`,
            url: orderLink
          }
        ]
      ]
    }

    const bodyObj: any = {
      chat_id: chatId,
      text: textMessage,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    }

    // Если настроен ID темы «Доставлено», отправляем в этот топик
    if (topics?.delivered && !isNaN(parseInt(topics.delivered, 10))) {
      bodyObj.message_thread_id = parseInt(topics.delivered, 10)
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`Ошибка отправки сообщения о доставке заказа ${orderNumStr} в Telegram:`, errText)
    }
  } catch (error) {
    console.error('Ошибка в sendOrderDeliveredTelegramNotification:', error)
  }
}

// Пороги допустимого времени простоя в часах по статусам
const STALE_THRESHOLDS_HOURS: Record<string, number> = {
  pending: 24, // Ожидает подтверждения — 24ч
  confirmed: 48, // Подтвержден — 48ч
  production: 96, // На производстве — 96ч (4 дня)
  production_completed: 96, // Собрано — 96ч
  warehouse: 48, // На складе — 48ч
  delivery: 48, // Ожидает доставку — 48ч
  awaiting_delivery: 48,
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждён',
  production: 'В производстве',
  production_completed: 'Производство завершено',
  warehouse: 'На складе',
  delivery: 'Ожидает доставку / Доставляется',
  awaiting_delivery: 'Ожидает доставку',
}

export async function checkAndNotifyStaleOrders() {
  try {
    const { chatId, token, ownerTag, warehouseTag, thresholds, topics } = await getTelegramSettings()

    if (!token || !chatId) {
      console.warn('Telegram не настроен для контроля простоя заказов')
      return { count: 0, error: 'Telegram не настроен' }
    }

    const now = new Date()

    // Находим все не заброшенные и не доставленные заказы
    const activeOrders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ['delivered', 'cancelled'],
        },
      },
      include: {
        client: true,
        seller: true,
        creator: true,
        driver: true,
      },
    })

    let notifiedCount = 0

    for (const order of activeOrders) {
      const thresholdHours = thresholds[order.status] || STALE_THRESHOLDS_HOURS[order.status]
      if (!thresholdHours) continue // если статус не отслеживается

      // Пропускаем, если для ЭТОГО статуса уже отправляли алерт
      if (order.staleAlertStatus === order.status) continue

      // Пропускаем, если указана «Желаемая дата доставки» и она в будущем
      if (order.plannedDeliveryDate && new Date(order.plannedDeliveryDate) > now) {
        continue
      }

      const updatedAtDate = new Date(order.updatedAt)
      const hoursElapsed = (now.getTime() - updatedAtDate.getTime()) / (1000 * 60 * 60)

      if (hoursElapsed >= thresholdHours) {
        // Заказ простаивает! Формируем сообщение
        const manager = order.seller || order.creator
        const managerName = manager?.fullName || 'Менеджер не указан'

        let managerTag = (manager as any)?.telegramUsername?.trim() || ''
        if (!managerTag && manager?.id) {
          const rawRes = await prisma.$queryRawUnsafe<{ telegram_username: string | null }[]>(
            `SELECT telegram_username FROM public.profiles WHERE id = $1::uuid`,
            manager.id
          )
          if (rawRes && rawRes.length > 0 && rawRes[0].telegram_username) {
            managerTag = rawRes[0].telegram_username.trim()
          }
        }

        if (managerTag && !managerTag.startsWith('@')) {
          managerTag = `@${managerTag}`
        }

        const tagMention = managerTag ? `${managerTag}` : `${managerName}`
        const orderNumStr = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
        const statusTitle = STATUS_LABELS[order.status] || order.status
        const daysElapsed = Math.floor(hoursElapsed / 24)
        const displayTimeElapsed = daysElapsed >= 1 
          ? `${daysElapsed} дн. ${Math.floor(hoursElapsed % 24)} ч.` 
          : `${Math.floor(hoursElapsed)} ч.`

        const plannedDateStr = order.plannedDeliveryDate
          ? new Date(order.plannedDeliveryDate).toLocaleDateString('ru-RU')
          : 'Не указана'

        const mentionsList: string[] = []
        if (ownerTag) mentionsList.push(`👑 <b>Руководитель:</b> ${ownerTag}`)
        if (warehouseTag) mentionsList.push(`📦 <b>Склад:</b> ${warehouseTag}`)
        mentionsList.push(`💼 <b>Продавец:</b> ${tagMention}`)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://sulak.ru'
        const orderLink = `${appUrl}/orders?id=${order.number || order.id}`

        const textMessage = `⚠️ <b>ВНИМАНИЕ: Заказ ${orderNumStr} простаивает без движения!</b>

─────────────────────────
📍 <b>Статус:</b> ${statusTitle}
⏳ <b>Время без движения:</b> ${displayTimeElapsed} (порог: ${thresholdHours} ч.)
📅 <b>Желаемая дата доставки:</b> ${plannedDateStr}
─────────────────────────
👤 <b>Клиент:</b> ${order.client.fullName}
📞 <b>Телефон:</b> <code>${order.client.primaryPhone}</code>
🏠 <b>Адрес:</b> ${normalizeAddress(order.deliveryAddress) || 'Не указан'}
─────────────────────────
👥 <b>Уведомление отправлено:</b>
${mentionsList.join('\n')}`

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: `🔗 Перейти к заказу ${orderNumStr}`,
                url: orderLink
              }
            ]
          ]
        }

        const bodyObj: any = {
          chat_id: chatId,
          text: textMessage,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        }

        // Если настроена тема для конкретного статуса или общая тема
        const targetTopicId = topics[order.status] || topics.general
        if (targetTopicId && !isNaN(parseInt(targetTopicId, 10))) {
          bodyObj.message_thread_id = parseInt(targetTopicId, 10)
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
        })

        if (res.ok) {
          // Отмечаем, что алерт для этого статуса отправлен
          await prisma.order.update({
            where: { id: order.id },
            data: { staleAlertStatus: order.status },
          })
          notifiedCount++
        } else {
          const errText = await res.text()
          console.error(`Ошибка отправки сообщения о простое заказа ${orderNumStr}:`, errText)
        }
      }
    }

    return { count: notifiedCount, success: true }
  } catch (error) {
    console.error('Ошибка в checkAndNotifyStaleOrders:', error)
    return { count: 0, error: error instanceof Error ? error.message : 'Ошибка проверки' }
  }
}
