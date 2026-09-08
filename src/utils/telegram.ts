import prisma from '@/lib/prisma'
import { normalizeAddress } from './address'
import { decryptSecret } from '@/lib/settings/secret-crypto'

export async function getTelegramSettings() {
  let chatId = process.env.TELEGRAM_CHAT_ID || ''
  let token = process.env.TELEGRAM_BOT_TOKEN || ''
  let ownerTag = ''
  let warehouseTag = ''
  let siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''

  const topics: Record<string, string> = {}
  const thresholds: Record<string, number> = {}
  const notifyFlags = {
    new_order: true,
    delivered: true,
    cancelled: true,
    reviews: true,
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
      `SELECT key, value FROM public.system_settings WHERE key LIKE 'telegram_%' OR key LIKE 'stale_threshold_%' OR key LIKE 'tg_notify_%'`
    )
    for (const r of rows) {
      if (r.key === 'telegram_chat_id' && r.value) chatId = r.value.trim()
      if (r.key === 'telegram_bot_token' && r.value) token = decryptSecret(r.value).trim()
      if (r.key === 'telegram_owner_tag' && r.value) ownerTag = r.value.trim()
      if (r.key === 'telegram_warehouse_tag' && r.value) warehouseTag = r.value.trim()
      if (r.key === 'telegram_site_url' && r.value) siteUrl = r.value.trim()

      if (r.key === 'tg_notify_new_order') notifyFlags.new_order = r.value !== 'false'
      if (r.key === 'tg_notify_delivered') notifyFlags.delivered = r.value !== 'false'
      if (r.key === 'tg_notify_cancelled') notifyFlags.cancelled = r.value !== 'false'
      if (r.key === 'tg_notify_reviews') notifyFlags.reviews = r.value !== 'false'

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

  return { chatId, token, ownerTag, warehouseTag, siteUrl, topics, thresholds, notifyFlags }
}

export type OrderNotificationType = 'new_order' | 'updated' | 'delivering' | 'delivered' | 'cancelled'

type TelegramOrderMessageKind = 'text' | 'photo' | 'media_group'

type TelegramOrderMessageReference = {
  chatId: string
  messageId: number
  kind: TelegramOrderMessageKind
}

type TelegramMessage = {
  message_id: number
}

type TelegramApiResponse<T> = {
  ok: boolean
  result?: T
  description?: string
}

const ORDER_TELEGRAM_MESSAGE_KEY_PREFIX = 'order_telegram_message_'

function orderTelegramMessageKey(orderId: string) {
  return `${ORDER_TELEGRAM_MESSAGE_KEY_PREFIX}${orderId}`
}

function isTelegramOrderMessageReference(value: unknown): value is TelegramOrderMessageReference {
  if (!value || typeof value !== 'object') return false

  const reference = value as Partial<TelegramOrderMessageReference>
  return typeof reference.chatId === 'string'
    && Number.isInteger(reference.messageId)
    && (reference.kind === 'text' || reference.kind === 'photo' || reference.kind === 'media_group')
}

async function getOrderTelegramMessageReference(orderId: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: orderTelegramMessageKey(orderId) },
    select: { value: true },
  })

  if (!setting) return null

  try {
    const parsed: unknown = JSON.parse(setting.value)
    return isTelegramOrderMessageReference(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function saveOrderTelegramMessageReference(
  orderId: string,
  reference: TelegramOrderMessageReference
) {
  await prisma.systemSetting.upsert({
    where: { key: orderTelegramMessageKey(orderId) },
    update: { value: JSON.stringify(reference) },
    create: { key: orderTelegramMessageKey(orderId), value: JSON.stringify(reference) },
  })
}

async function readTelegramResponse<T>(response: Response): Promise<TelegramApiResponse<T>> {
  try {
    return await response.json() as TelegramApiResponse<T>
  } catch {
    return { ok: response.ok }
  }
}

async function sendTelegramTextMessage({
  token,
  chatId,
  text,
}: {
  token: string
  chatId: string
  text: string
}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
  const body = await readTelegramResponse<TelegramMessage>(response)

  if (!response.ok || !body.ok || !body.result) {
    console.warn('Telegram sendMessage не прошёл:', body.description || response.statusText)
    return null
  }

  return body.result
}

async function editOrderTelegramMessage({
  token,
  reference,
  text,
}: {
  token: string
  reference: TelegramOrderMessageReference
  text: string
}) {
  const editsText = reference.kind === 'text'
  const method = editsText ? 'editMessageText' : 'editMessageCaption'
  const endpoint = `https://api.telegram.org/bot${token}/${method}`
  const requestBody = JSON.stringify({
    chat_id: reference.chatId,
    message_id: reference.messageId,
    parse_mode: 'HTML',
    ...(editsText ? { text } : { caption: text }),
  })

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: AbortSignal.timeout(10_000),
      })
      const body = await readTelegramResponse<TelegramMessage | true>(response)

      if (response.ok && body.ok) return true

      // Повторное сохранение без фактических изменений тоже считается успешной синхронизацией.
      if (body.description?.toLowerCase().includes('message is not modified')) return true

      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === 3) {
        console.warn(`Telegram ${method} не прошёл:`, body.description || response.statusText)
        return false
      }
    } catch (error) {
      if (attempt === 3) {
        console.warn(`Telegram ${method} не прошёл после 3 попыток:`, error)
        return false
      }
    }

    await new Promise(resolve => setTimeout(resolve, attempt * 300))
  }

  return false
}

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
    const { chatId, token, siteUrl, notifyFlags } = await getTelegramSettings()

    if (!token || !chatId) {
      console.warn('Telegram не настроен (BOT_TOKEN или CHAT_ID не заполнены)')
      return
    }

    if (type === 'new_order' && !notifyFlags.new_order) {
      console.log('Уведомления о новых заказах отключены в настройках Telegram')
      return
    }
    if ((type === 'delivering' || type === 'delivered') && !notifyFlags.delivered) {
      console.log('Уведомления о доставленных заказах отключены в настройках Telegram')
      return
    }
    if (type === 'cancelled' && !notifyFlags.cancelled) {
      console.log('Уведомления об отмене заказов отключены в настройках Telegram')
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
    let managerTag = manager?.telegramUsername?.trim() || ''

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

    if (type === 'new_order' || type === 'updated') {
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

    // Каждая позиция хранит и показывает собственные характеристики.
    // Это особенно важно для отдельных столов и стульев с разными цветами.
    const itemLines: string[] = []

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const rawName = item.variant?.product?.name || ''
        const name = rawName
          .replace(/\s*\(арт\.[^)]+\)/gi, '')
          .replace(/\s*арт\.\s*\S+/gi, '')
          .trim()
        const color = item.customColor?.trim() || item.variant?.color?.trim()
        const pattern = item.variant?.thickness
          || (item.variant?.attributes as { tablePattern?: unknown } | null)?.tablePattern
        const isTable = /^стол(?:\s|$)/i.test(name)
        const isChair = /^стул(?:\s|$)/i.test(name)

        if (isTable) {
          const size = cleanTableSize(item.customTableSize || item.variant?.size)
          const model = name
            .replace(/^стол(?:\s+|$)/i, '')
            .replace(/\b\d{2,3}\/\d{2,3}(?:[xх*]\d{2,3})?\b/gi, '')
            .trim()
          const details = [`стол: ${model}${size ? ` ${size}` : ''}`]
          if (typeof pattern === 'string' && pattern.trim()) details.push(`узор: ${pattern.trim()}`)
          if (color) details.push(`цвет: ${color}`)
          if (item.quantity > 1) details.push(`${item.quantity} шт`)
          itemLines.push(details.join(', '))
          continue
        }

        if (isChair) {
          const model = name.replace(/^стул(?:\s+|$)/i, '').trim()
          const details = [`стул: ${model}${item.quantity > 1 ? ` — ${item.quantity} шт` : ''}`]
          if (color) details.push(`цвет: ${color}`)
          itemLines.push(details.join(', '))
          continue
        }

        const details = [name || 'Товар']
        if (color) details.push(`цвет: ${color}`)
        if (item.quantity > 1) details.push(`${item.quantity} шт`)
        itemLines.push(details.join(', '))
      }
    }

    const itemsFormatted = itemLines.length > 0 ? itemLines.join('\n• ') : null

    // Формируем текст в точности по стандарту менеджеров
    let textMessage = `${title} ${formattedDate}\n\n`
    textMessage += `• ${order.client?.fullName || 'Клиент не указан'}\n`
    textMessage += `• ${normalizeAddress(order.deliveryAddress) || 'Адрес не указан'}\n`
    if (order.client?.primaryPhone) {
      textMessage += `• <code>${order.client.primaryPhone}</code>\n`
    }
    const additionalPhone = order.client?.additionalPhone?.trim()
    if (additionalPhone && additionalPhone !== order.client?.primaryPhone) {
      textMessage += `• Доп. телефон: <code>${additionalPhone}</code>\n`
    }
    if (itemsFormatted) {
      textMessage += `• ${itemsFormatted}\n`
    }
    textMessage += `• Товары: ${((order.totalPrice || 0) / 100).toLocaleString('ru-RU')} ₽\n`
    if (order.discount > 0) {
      textMessage += `• Скидка: −${(order.discount / 100).toLocaleString('ru-RU')} ₽\n`
    }
    if (order.deliveryPrice > 0) {
      textMessage += `• Доставка: +${(order.deliveryPrice / 100).toLocaleString('ru-RU')} ₽\n`
    }
    if (order.assemblyPrice > 0) {
      textMessage += `• Сборка и подъём: +${(order.assemblyPrice / 100).toLocaleString('ru-RU')} ₽\n`
    }
    textMessage += `• <b>Итого: ${totalPriceFormatted} ₽</b>\n`

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
    textMessage += `\n👉 <a href="${orderLink}"><b>Перейти к заказу ${orderNumStr}</b></a>`

    if (type === 'updated') {
      const existingReference = await getOrderTelegramMessageReference(orderId)

      if (existingReference?.chatId === chatId) {
        const edited = await editOrderTelegramMessage({
          token,
          reference: existingReference,
          text: textMessage,
        })

        if (!edited) {
          console.error(`Карточка заказа ${orderNumStr} в Telegram не обновлена`)
        }
        return
      }

      // Для заказов, созданных до появления привязки, один раз публикуем
      // актуальную карточку. Дальше она будет обновляться на месте.
      const replacement = await sendTelegramTextMessage({ token, chatId, text: textMessage })
      if (replacement) {
        await saveOrderTelegramMessageReference(orderId, {
          chatId,
          messageId: replacement.message_id,
          kind: 'text',
        })
      }
      return
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
    let sentMessageReference: TelegramOrderMessageReference | null = null

    if (photoUrls.length === 1) {
      // Одно фото — отправляем sendPhoto
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
          }),
        })

        const photoBody = await readTelegramResponse<TelegramMessage>(photoRes)
        if (photoRes.ok && photoBody.ok) {
          sentWithPhoto = true
          if (photoBody.result) {
            sentMessageReference = {
              chatId,
              messageId: photoBody.result.message_id,
              kind: 'photo',
            }
          }
        } else {
          console.warn(
            'Telegram sendPhoto не прошёл, отправляем sendMessage. Причина:',
            photoBody.description || photoRes.statusText
          )
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

        const mediaBody = await readTelegramResponse<TelegramMessage[]>(mediaRes)
        if (mediaRes.ok && mediaBody.ok) {
          sentWithPhoto = true
          const firstMessage = mediaBody.result?.[0]
          if (firstMessage) {
            sentMessageReference = {
              chatId,
              messageId: firstMessage.message_id,
              kind: 'media_group',
            }
          }
        } else {
          console.warn(
            'Telegram sendMediaGroup не прошёл, отправляем sendMessage. Причина:',
            mediaBody.description || mediaRes.statusText
          )
        }
      } catch (mediaErr) {
        console.warn('Ошибка при отправке sendMediaGroup в Telegram:', mediaErr)
      }
    }

    // Если фото нет или отправка фото не удалась — отправляем обычное текстовое сообщение
    if (!sentWithPhoto) {
      const sentMessage = await sendTelegramTextMessage({ token, chatId, text: textMessage })
      if (sentMessage) {
        sentMessageReference = {
          chatId,
          messageId: sentMessage.message_id,
          kind: 'text',
        }
      }
    }

    if (type === 'new_order' && sentMessageReference) {
      await saveOrderTelegramMessageReference(orderId, sentMessageReference)
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
