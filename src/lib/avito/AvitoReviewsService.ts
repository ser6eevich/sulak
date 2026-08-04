/**
 * AvitoReviewsService.ts
 * Сервис: обходит все настроенные аккаунты Авито, находит новые отзывы
 * и отправляет уведомления в Telegram-тему «Отзывы».
 */

import prisma from '@/lib/prisma'
import { getTelegramSettings } from '@/utils/telegram'
import {
  fetchAvitoReviews,
  buildReviewUrl,
  reviewTypeLabel,
  AvitoReview,
} from './AvitoReviewsClient'

export interface AvitoAccount {
  name: string
  clientId: string
  clientSecret: string
}

/** Загрузить список аккаунтов Авито из system_settings */
export async function loadAvitoAccounts(): Promise<AvitoAccount[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
      `SELECT key, value FROM public.system_settings WHERE key LIKE 'avito_account_%'`
    )

    // Ключи имеют вид:
    //   avito_account_1_name, avito_account_1_client_id, avito_account_1_client_secret
    const accounts: Record<string, Partial<AvitoAccount>> = {}

    for (const row of rows) {
      // avito_account_3_client_secret → idx=3, field=client_secret
      const match = row.key.match(/^avito_account_(\d+)_(.+)$/)
      if (!match) continue
      const idx = match[1]
      const field = match[2]

      if (!accounts[idx]) accounts[idx] = {}
      if (field === 'name') accounts[idx].name = row.value
      if (field === 'client_id') accounts[idx].clientId = row.value
      if (field === 'client_secret') accounts[idx].clientSecret = row.value
    }

    return Object.values(accounts).filter(
      (a): a is AvitoAccount => !!(a.name && a.clientId && a.clientSecret)
    )
  } catch (err) {
    console.error('[AvitoReviewsService] Ошибка чтения аккаунтов из БД:', err)
    return []
  }
}

/** Отправить одно уведомление в Telegram */
async function sendReviewNotification(
  review: AvitoReview,
  accountName: string,
  chatId: string,
  token: string,
  reviewsTopicId?: string
) {
  const date = new Date(review.createdAt * 1000).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })

  const typeLabel = reviewTypeLabel(review.type)
  const authorUrl = buildReviewUrl(review.author?.url || '')
  const ratingVal = review.type === 'positive' ? 5 : (review.type === 'negative' ? 1 : 3)
  const ratingStr = '⭐'.repeat(ratingVal)
  const authorName = review.author?.name || 'Неизвестный'

  const text =
    `#отзыв_авито\n` +
    `⭐ <b>Новый отзыв на Авито (${ratingStr})</b>\n` +
    `🏪 <b>Аккаунт:</b> ${accountName}\n` +
    `─────────────────────────\n` +
    `👤 <b>Автор:</b> ${authorName}\n` +
    `📅 <b>Дата:</b> ${date}\n` +
    (review.text
      ? `\n💬 <i>${review.text}</i>\n`
      : `\n<i>(Отзыв без текста)</i>\n`) +
    (review.answer
      ? `\n✏️ <b>Ваш ответ:</b> <i>${review.answer.text}</i>\n`
      : '') +
    `─────────────────────────\n`

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }

  // Добавляем кнопку «Профиль покупателя» если есть ссылка
  if (authorUrl && authorUrl !== 'https://www.avito.ru') {
    body.reply_markup = {
      inline_keyboard: [
        [{ text: '👤 Профиль покупателя', url: authorUrl }],
      ],
    }
  }

  // Отправляем в тему «Отзывы» если ID темы задан
  if (reviewsTopicId && !isNaN(parseInt(reviewsTopicId))) {
    body.message_thread_id = parseInt(reviewsTopicId)
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error(`[AvitoReviewsService] Ошибка Telegram для отзыва ${review.id}:`, err)
  }
}

/** Основная функция: проверить все аккаунты и уведомить о новых отзывах */
export async function checkAndNotifyAvitoReviews(): Promise<{
  processed: number
  newReviews: number
  errors: string[]
}> {
  const accounts = await loadAvitoAccounts()
  const { chatId, token, topics } = await getTelegramSettings()

  const result = { processed: 0, newReviews: 0, errors: [] as string[] }

  if (!chatId || !token) {
    result.errors.push('Telegram не настроен (нет chatId или token)')
    return result
  }

  if (accounts.length === 0) {
    result.errors.push('Нет настроенных аккаунтов Авито')
    return result
  }

  const reviewsTopicId = topics?.reviews || ''

  for (const account of accounts) {
    result.processed++
    try {
      const reviews = await fetchAvitoReviews(account.clientId, account.clientSecret, 20)

      for (const review of reviews) {
        const reviewId = String(review.id)

        // Проверяем, не отправляли ли уже
        const existing = await prisma.avitoSentReview.findUnique({
          where: { reviewId },
        })

        if (existing) continue // Уже отправлено

        // Защита от спама старыми отзывами при первом подключении:
        // Если отзыв старше 48 часов, просто помечаем его как сохраненный в БД без отправки в Telegram
        const nowSec = Math.floor(Date.now() / 1000)
        const isOldReview = review.createdAt && (nowSec - review.createdAt > 48 * 3600)

        if (isOldReview) {
          await prisma.avitoSentReview.create({
            data: {
              reviewId,
              accountName: account.name,
            },
          })
          continue
        }

        // Отправляем уведомление в Telegram только для новых свежих отзывов
        await sendReviewNotification(review, account.name, chatId, token, reviewsTopicId)

        // Сохраняем в БД
        await prisma.avitoSentReview.create({
          data: {
            reviewId,
            accountName: account.name,
          },
        })

        result.newReviews++

        // Небольшая пауза между сообщениями, чтобы не попасть в rate limit Telegram
        await new Promise(r => setTimeout(r, 300))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[AvitoReviewsService] Ошибка аккаунта «${account.name}»:`, msg)
      result.errors.push(`${account.name}: ${msg}`)
    }
  }

  return result
}
