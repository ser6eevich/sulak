import prisma from '@/lib/prisma'
import { normalizeAddress } from './address'

export async function getTelegramSettings() {
  let chatId = process.env.TELEGRAM_CHAT_ID || ''
  let token = process.env.TELEGRAM_BOT_TOKEN || ''
  let ownerTag = ''
  let warehouseTag = ''
  let siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''

  const topics: Record<string, string> = {}
  const thresholds: Record<string, number> = {}

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
    }
  } catch (err) {
    console.error('Ошибка чтения настроек Telegram из базы:', err)
  }

  if (ownerTag && !ownerTag.startsWith('@')) ownerTag = `@${ownerTag}`
  if (warehouseTag && !warehouseTag.startsWith('@')) warehouseTag = `@${warehouseTag}`

  return { chatId, token, ownerTag, warehouseTag, siteUrl, topics, thresholds }
}

export type OrderNotificationType = 'new_order' | 'delivering' | 'delivered' | 'cancelled'

/**
 * Единая отправка уведомлений по заказам в главный Telegram чат с тегами внизу
 */
export async function sendOrderTelegramNotification(
  orderId: string,
  type: OrderNotificationType,
  cancellationReason?: string | null
) {
  try {
    const { chatId, token, siteUrl } = await getTelegramSettings()

    if (!token || !chatId) {
      console.warn('Telegram не настроен (BOT_TOKEN или CHAT_ID не заполнены)')
      return
    }

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

    const manager = order.seller || order.creator
    const managerName = manager?.fullName || 'Не указан'
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

    const appUrl = siteUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://sulak.ru'
    const orderLink = `${appUrl.replace(/\/$/, '')}/orders?id=${order.number || order.id}`

    let footerTag = ''
    let title = ''

    if (type === 'new_order') {
      footerTag = '#новый_заказ'
      title = `🛍️ <b>Новый заказ ${orderNumStr}</b>`
    } else if (type === 'delivering') {
      footerTag = '#доставляется'
      title = `🚚 <b>Заказ ${orderNumStr} передан в доставку</b>`
    } else if (type === 'delivered') {
      footerTag = '#доставлен'
      title = `🎉 <b>Заказ ${orderNumStr} успешно ДОСТАВЛЕН!</b>`
    } else if (type === 'cancelled') {
      footerTag = '#отмена'
      title = `❌ <b>Заказ ${orderNumStr} ОТМЕНЁН</b>`
    }

    let textMessage = `${title}\n`
    textMessage += `─────────────────────────\n`
    textMessage += `👤 <b>Клиент:</b> ${order.client?.fullName || 'Не указан'}\n`
    textMessage += `📞 <b>Телефон:</b> <code>${order.client?.primaryPhone || ''}</code>\n`
    textMessage += `📍 <b>Адрес:</b> ${normalizeAddress(order.deliveryAddress) || 'Не указан'}\n`
    textMessage += `💰 <b>Сумма:</b> ${totalPriceFormatted} ₽\n`

    if (type === 'delivering' || type === 'delivered') {
      textMessage += `🚗 <b>Водитель:</b> ${order.driver?.fullName || 'Не назначен'}\n`
    }

    if (type === 'cancelled' && cancellationReason) {
      textMessage += `📝 <b>Причина отмены:</b> ${cancellationReason}\n`
    }

    textMessage += `─────────────────────────\n`
    textMessage += `👨‍💼 <b>Продавец:</b> ${managerName} ${managerTag ? `(${managerTag})` : ''}\n`

    if (type === 'delivered') {
      const tagMention = managerTag 
        ? `💬 <b>${managerTag}</b>, пожалуйста, запроси отзыв у клиента! ⭐`
        : `💬 <b>${managerName}</b>, пожалуйста, запроси отзыв у клиента! ⭐`
      textMessage += `\n${tagMention}\n`
    }

    textMessage += `\n${footerTag}`

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: `🔗 Перейти к заказу ${orderNumStr}`,
            url: orderLink,
          },
        ],
      ],
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textMessage,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    })
  } catch (error) {
    console.error(`Ошибка отправки Telegram уведомления (${type}):`, error)
  }
}

export async function sendOrderDeliveredTelegramNotification(orderId: string) {
  return sendOrderTelegramNotification(orderId, 'delivered')
}

export async function sendTelegramNotification(orderId: string) {
  return sendOrderTelegramNotification(orderId, 'new_order')
}

export async function checkAndNotifyStaleOrders() {
  return { count: 0 }
}
