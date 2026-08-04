'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function checkAdminOrOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    redirect('/dashboard')
  }
  return user.id
}

export async function saveTelegramSettingsAction(
  chatId: string,
  botToken: string,
  ownerTag?: string,
  warehouseTag?: string,
  thresholds?: Record<string, number>,
  topics?: Record<string, string>,
  siteUrl?: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await checkAdminOrOwner()

    const upserts = [
      prisma.systemSetting.upsert({
        where: { key: 'telegram_chat_id' },
        update: { value: chatId.trim() },
        create: { key: 'telegram_chat_id', value: chatId.trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'telegram_bot_token' },
        update: { value: botToken.trim() },
        create: { key: 'telegram_bot_token', value: botToken.trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'telegram_owner_tag' },
        update: { value: (ownerTag || '').trim() },
        create: { key: 'telegram_owner_tag', value: (ownerTag || '').trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'telegram_warehouse_tag' },
        update: { value: (warehouseTag || '').trim() },
        create: { key: 'telegram_warehouse_tag', value: (warehouseTag || '').trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'telegram_site_url' },
        update: { value: (siteUrl || '').trim() },
        create: { key: 'telegram_site_url', value: (siteUrl || '').trim() },
      }),
    ]

    await Promise.all(upserts)
    revalidatePath('/settings')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сохранения настроек Telegram' }
  }
}

export async function testTelegramNotificationAction(
  chatId: string,
  botToken: string
): Promise<{ error?: string; success?: boolean; message?: string }> {
  try {
    await checkAdminOrOwner()

    const cleanChatId = chatId.trim()
    const cleanToken = botToken.trim()

    if (!cleanChatId || !cleanToken) {
      return { error: 'Заполните Chat ID и Bot Token' }
    }

    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: '🔔 <b>[ТЕСТ] Сообщение из настроек Сулак CRM!</b>\n\nИнтеграция с Telegram успешно работает.',
        parse_mode: 'HTML',
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      return { error: `Telegram API error: ${data.description || 'Не удалось отправить тестовое сообщение'}` }
    }

    return { success: true, message: 'Тестовое сообщение успешно отправлено в Telegram!' }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка отправки тестового сообщения' }
  }
}

export interface AvitoAccountInput {
  name: string
  clientId: string
  clientSecret: string
}

export async function saveAvitoSettingsAction(
  accounts: AvitoAccountInput[],
  topicId?: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await checkAdminOrOwner()

    const accountUpserts: any[] = []

    accounts.forEach((acc, idx) => {
      const num = idx + 1
      const name = acc.name.trim()
      const clientId = acc.clientId.trim()
      const clientSecret = acc.clientSecret.trim()

      if (name && clientId && clientSecret) {
        accountUpserts.push(
          prisma.systemSetting.upsert({
            where: { key: `avito_account_${num}_name` },
            update: { value: name },
            create: { key: `avito_account_${num}_name`, value: name },
          })
        )
        accountUpserts.push(
          prisma.systemSetting.upsert({
            where: { key: `avito_account_${num}_client_id` },
            update: { value: clientId },
            create: { key: `avito_account_${num}_client_id`, value: clientId },
          })
        )
        accountUpserts.push(
          prisma.systemSetting.upsert({
            where: { key: `avito_account_${num}_client_secret` },
            update: { value: clientSecret },
            create: { key: `avito_account_${num}_client_secret`, value: clientSecret },
          })
        )
      }
    })

    await Promise.all(accountUpserts)

    revalidatePath('/settings')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сохранения настроек Авито' }
  }
}

export async function sendLatestReviewPerAccountAction(): Promise<{ error?: string; success?: boolean; message?: string }> {
  try {
    await checkAdminOrOwner()

    const { getTelegramSettings } = await import('@/utils/telegram')
    const { chatId, token } = await getTelegramSettings()

    if (!chatId || !token) {
      return { error: 'Telegram не настроен (заполните Chat ID и Bot Token во вкладке Telegram)' }
    }

    const { loadAvitoAccounts, fetchAvitoReviews } = await import('@/lib/avito/AvitoReviewsService')
    const accounts = await loadAvitoAccounts()

    if (!accounts || accounts.length === 0) {
      return { error: 'Не найдено ни одного настроенного аккаунта Авито. Заполните аккаунты и сохраните настройки.' }
    }

    let sentCount = 0

    for (const acc of accounts) {
      try {
        const reviews = await fetchAvitoReviews(acc.clientId, acc.clientSecret, 5)
        if (reviews && reviews.length > 0) {
          const latest = reviews[0]
          const ratingVal = latest.type === 'positive' ? 5 : (latest.type === 'negative' ? 1 : 3)
          const ratingStr = '⭐'.repeat(ratingVal)
          const authorName = latest.author?.name || 'Неизвестный'
          const authorUrl = latest.author?.url || 'https://www.avito.ru'
          const date = new Date((latest.createdAt || Math.floor(Date.now() / 1000)) * 1000).toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
          })

          const textMessage =
            `⭐ <b>Новый отзыв на Авито (${ratingStr})</b>\n` +
            `🏪 <b>Аккаунт:</b> ${acc.name}\n` +
            `─────────────────────────\n` +
            `👤 <b>Автор:</b> ${authorName}\n` +
            `📅 <b>Дата:</b> ${date}\n` +
            (latest.text ? `\n💬 <i>${latest.text}</i>\n` : `\n<i>(Отзыв без текста)</i>\n`) +
            `─────────────────────────\n` +
            `#отзыв_авито`

          const payload: any = {
            chat_id: chatId,
            text: textMessage,
            parse_mode: 'HTML',
          }

          if (authorUrl && authorUrl !== 'https://www.avito.ru') {
            payload.reply_markup = {
              inline_keyboard: [[{ text: '👤 Профиль покупателя', url: authorUrl }]],
            }
          }

          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

          if (res.ok) sentCount++
        }
      } catch (accErr) {
        console.error(`Ошибка отправки последнего отзыва аккаунта ${acc.name}:`, accErr)
      }
    }

    if (sentCount === 0) {
      return { error: 'Не удалось получить отзывы ни с одного аккаунта (проверьте Client ID и Client Secret).' }
    }

    return { success: true, message: `Успешно отправлено по 1 последнему отзыву с ${sentCount} аккаунтов Авито в Telegram!` }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка отправки отзывов Авито' }
  }
}
