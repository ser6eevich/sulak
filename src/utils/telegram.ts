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
 * Вспомогательная функция очистки ширины стола (например, 240/280x100 -> 240/280)
 */
function cleanTableSize(sizeStr?: string | null): string {
  if (!sizeStr) return ''
  return sizeStr.replace(/[xх*]\d+/gi, '').trim()
}

/**
 * Единая отправка уведомлений по заказам в главный Telegram чат в формате менеджеров с фото
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
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
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

    const dateObj = new Date(order.createdAt)
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}`

    const appUrl = siteUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://sulak.ru'
    const orderLink = `${appUrl.replace(/\/$/, '')}/orders?id=${order.number || order.id}`

    let footerTag = ''
    let title = ''

    if (type === 'new_order') {
      footerTag = '#новый_заказ'
      title = `<b>Заказ ${orderNumStr}</b>`
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

    // Собираем позиции заказа (состав и цвет)
    const itemLines: string[] = []
    const colorSet = new Set<string>()

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        let rawName = item.variant?.product?.name || ''
        const customSize = item.customTableSize || item.variant?.size
        const customChairs = item.customChairsCount
        const color = item.variant?.color

        if (color && color.trim()) {
          colorSet.add(color.trim())
        }

        // 1. Заменяем "комплект" / "Комплект" на "Стол"
        let name = rawName.replace(/^комплект\s+/i, 'Стол ')

        // 2. Убираем артикулы (арт. xxx или (арт. xxx))
        name = name.replace(/\s*\(арт\.[^)]+\)/gi, '').replace(/\s*арт\.\s*\S+/gi, '').trim()

        let defaultChairCount: number | null = null
        let defaultSize = ''

        // 3. Извлекаем количество стульев по умолчанию из конца названия (например, " 8" на конце "комплект Голд + Мини шейх 240/280x100 8")
        const trailingNumMatch = name.match(/\s+(\d+)\s*$/)
        if (trailingNumMatch) {
          defaultChairCount = parseInt(trailingNumMatch[1], 10)
          name = name.replace(/\s+\d+\s*$/, '').trim()
        }

        // 4. Извлекаем размер по умолчанию из названия (например, 240/280x100 или 200/240)
        const sizeMatch = name.match(/\b\d{2,3}\/\d{2,3}(?:[xх*]\d{2,3})?\b/i)
        if (sizeMatch) {
          defaultSize = cleanTableSize(sizeMatch[0])
          name = name.replace(/\b\d{2,3}\/\d{2,3}(?:[xх*]\d{2,3})?\b/gi, '').trim()
        }

        let tableName = name
        let chairModel = ''

        // 5. Разделяем по знаком "+" на стол и стулья
        if (name.includes('+')) {
          const parts = name.split('+')
          tableName = parts[0].trim()
          chairModel = parts[1].replace(/стул(ья|ей|а)?/gi, '').trim()
        } else {
          tableName = name.trim()
        }

        // Финальный размер стола без ширины (например 240/280)
        const finalSize = cleanTableSize(customSize) || defaultSize
        // Финальное количество стульев (если пользователь переопределил руками — берём руками, иначе по умолчанию)
        const finalChairCount = customChairs !== null && customChairs !== undefined ? customChairs : defaultChairCount

        // Собираем идеальную строку
        let formattedLine = tableName
        if (finalSize) {
          formattedLine += ` ${finalSize}`
        }

        if (finalChairCount && finalChairCount > 0) {
          formattedLine += ` + ${finalChairCount} стульев`
          if (chairModel) {
            formattedLine += ` ${chairModel}`
          }
        } else if (!tableName.toLowerCase().includes('стол') && item.quantity > 1) {
          formattedLine += ` (${item.quantity} шт)`
        }

        if (formattedLine.trim()) {
          itemLines.push(formattedLine.trim())
        }
      }
    }

    const itemsFormatted = itemLines.length > 0 ? itemLines.join('\n• ') : null
    const colorFormatted = colorSet.size > 0 ? Array.from(colorSet).join(', ') : null

    // Формируем текст в точности по стандарту менеджеров
    let textMessage = `${title} ${formattedDate}\n\n`
    textMessage += `• ${order.client?.fullName || 'Клиент не указан'}\n`
    textMessage += `• ${normalizeAddress(order.deliveryAddress) || 'Адрес не указан'}\n`
    if (order.client?.primaryPhone) {
      textMessage += `• <code>${order.client.primaryPhone}</code>\n`
    }
    if (itemsFormatted) {
      textMessage += `• ${itemsFormatted}\n`
    }
    if (colorFormatted) {
      textMessage += `• цвет: ${colorFormatted}\n`
    }
    textMessage += `• ${totalPriceFormatted} ₽\n`

    if (order.comment && order.comment.trim()) {
      textMessage += `• 💬 <b>Комментарий:</b> ${order.comment.trim()}\n`
    }

    if (type === 'delivering' || type === 'delivered') {
      textMessage += `• Водитель: ${order.driver?.fullName || 'Не назначен'}\n`
    }

    if (type === 'cancelled' && cancellationReason) {
      textMessage += `• Причина отмены: ${cancellationReason}\n`
    }

    textMessage += `──────────────\n`
    textMessage += `👨‍💼 Продавец: ${managerName} ${managerTag ? `(${managerTag})` : ''}\n`

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

    // Извлекаем все фото из заказа только для новых заказов (#новый_заказ)
    let photoUrls: string[] = []
    if (type === 'new_order' && order.imageUrl) {
      try {
        const parsed = JSON.parse(order.imageUrl)
        if (typeof parsed === 'object' && parsed !== null) {
          const rawValues = Object.values(parsed).flat()
          photoUrls = rawValues.filter(
            (v): v is string => typeof v === 'string' && v.startsWith('http')
          )
        } else if (typeof parsed === 'string' && parsed.startsWith('http')) {
          photoUrls = [parsed]
        }
      } catch {
        if (typeof order.imageUrl === 'string' && order.imageUrl.startsWith('http')) {
          photoUrls = [order.imageUrl]
        }
      }
    }

    let sentWithPhoto = false

    if (photoUrls.length === 1) {
      // Одно фото — отправляем sendPhoto с кнопкой
      try {
        const photoEndpoint = `https://api.telegram.org/bot${token}/sendPhoto`
        const photoRes = await fetch(photoEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrls[0],
            caption: textMessage,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          }),
        })

        if (photoRes.ok) {
          sentWithPhoto = true
        } else {
          const errText = await photoRes.text()
          console.warn('Telegram sendPhoto не прошёл, отправляем sendMessage. Причина:', errText)
        }
      } catch (photoErr) {
        console.warn('Ошибка при отправке sendPhoto в Telegram:', photoErr)
      }
    } else if (photoUrls.length > 1) {
      // Несколько фото подзаказов — отправляем единым альбомом через sendMediaGroup
      try {
        const mediaEndpoint = `https://api.telegram.org/bot${token}/sendMediaGroup`
        const media = photoUrls.slice(0, 10).map((url, idx) => ({
          type: 'photo',
          media: url,
          ...(idx === 0 ? { caption: textMessage, parse_mode: 'HTML' } : {}),
        }))

        const mediaRes = await fetch(mediaEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            media,
          }),
        })

        if (mediaRes.ok) {
          sentWithPhoto = true
          // Отправляем кнопку ссылки на заказ дополнительной строчкой
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `🔗 <a href="${orderLink}">Перейти к заказу ${orderNumStr}</a>`,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
          }).catch(() => {})
        } else {
          const errText = await mediaRes.text()
          console.warn('Telegram sendMediaGroup не прошёл, отправляем sendMessage. Причина:', errText)
        }
      } catch (mediaErr) {
        console.warn('Ошибка при отправке sendMediaGroup в Telegram:', mediaErr)
      }
    }

    // Если фото нет или отправка фото не удалась — отправляем обычное текстовое сообщение
    if (!sentWithPhoto) {
      const textEndpoint = `https://api.telegram.org/bot${token}/sendMessage`
      await fetch(textEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: textMessage,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        }),
      })
    }
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
