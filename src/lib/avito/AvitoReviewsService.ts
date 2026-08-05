/**
 * AvitoReviewsService.ts
 * Сервис: обходит все настроенные аккаунты Авито, находит новые отзывы
 * и отправляет уведомления в Telegram.
 */

import prisma from '@/lib/prisma'
import { getTelegramSettings } from '@/utils/telegram'
import {
  fetchAvitoReviews,
  buildReviewUrl,
  reviewTypeLabel,
  type AvitoReview,
} from './AvitoReviewsClient'

export {
  fetchAvitoReviews,
  buildReviewUrl,
  reviewTypeLabel,
  type AvitoReview,
}

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

    const accounts: Record<string, Partial<AvitoAccount>> = {}

    for (const row of rows) {
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

/** Первоначальное наполнение базы ID всех существующих отзывов (без отправки в Telegram) */
export async function seedExistingAvitoReviewIds(): Promise<{
  seededAccounts: number
  totalReviewsSeeded: number
}> {
  const accounts = await loadAvitoAccounts()
  let totalReviewsSeeded = 0

  for (const acc of accounts) {
    try {
      const reviews = await fetchAvitoReviews(acc.clientId, acc.clientSecret, 50)
      for (const rev of reviews) {
        const compositeKey = `${acc.clientId}_${rev.id}`
        await prisma.avitoSentReview.upsert({
          where: { reviewId: compositeKey },
          update: {},
          create: {
            reviewId: compositeKey,
            accountName: acc.name,
          },
        })
        totalReviewsSeeded++
      }
    } catch (err) {
      console.error(`[AvitoReviewsService] Ошибка первичного посева отзывов аккаунта ${acc.name}:`, err)
    }
  }

  return {
    seededAccounts: accounts.length,
    totalReviewsSeeded,
  }
}

/** Отправить одно уведомление в Telegram */
async function sendReviewNotification(
  review: AvitoReview,
  accountName: string,
  chatId: string,
  token: string
) {
  const date = new Date((review.createdAt || Math.floor(Date.now() / 1000)) * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })

  const authorUrl = buildReviewUrl(review.author?.url || '')
  const scoreVal = review.score || 5
  const ratingStr = '⭐'.repeat(scoreVal)
  const authorName = review.sender?.name || review.author?.name || 'Неизвестный'
  const itemTitle = review.item?.title ? `\n📦 <b>Товар:</b> ${review.item.title}` : ''

  const text =
    `⭐ <b>Новый отзыв на Авито (${ratingStr})</b>\n` +
    `🏪 <b>Аккаунт:</b> ${accountName}${itemTitle}\n` +
    `──────────────\n` +
    `👤 <b>Автор:</b> ${authorName}\n` +
    `📅 <b>Дата:</b> ${date}\n` +
    (review.text
      ? `\n💬 <i>${review.text}</i>\n`
      : `\n<i>(Отзыв без текста)</i>\n`) +
    (review.answer
      ? `\n✏️ <b>Ваш ответ:</b> <i>${review.answer.text}</i>\n`
      : '') +
    `──────────────\n` +
    `#отзыв_авито`

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }

  if (authorUrl && authorUrl !== 'https://www.avito.ru') {
    body.reply_markup = {
      inline_keyboard: [
        [{ text: '👤 Профиль покупателя', url: authorUrl }],
      ],
    }
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

/**
 * Главный метод крона: обходит все аккаунты, находит новые отзывы и рассылает алерты.
 */
export async function checkAndNotifyAvitoReviews(): Promise<{
  checkedAccounts: number
  newReviewsFound: number
  errors: string[]
}> {
  const errors: string[] = []
  let newReviewsFound = 0

  const { chatId, token, notifyFlags } = await getTelegramSettings()

  if (!chatId || !token) {
    return {
      checkedAccounts: 0,
      newReviewsFound: 0,
      errors: ['Telegram не настроен (TELEGRAM_CHAT_ID / TELEGRAM_BOT_TOKEN не заданы)'],
    }
  }

  if (!notifyFlags.reviews) {
    console.log('[AvitoReviewsService] Уведомления об отзывах Авито отключены в настройках Telegram')
    return { checkedAccounts: 0, newReviewsFound: 0, errors: [] }
  }

  const accounts = await loadAvitoAccounts()

  if (accounts.length === 0) {
    return {
      checkedAccounts: 0,
      newReviewsFound: 0,
      errors: ['Не настроен ни один аккаунт Авито'],
    }
  }

  // Проверяем: если база ещё пустая (первый запуск), наполняем её текущими ID, чтобы не спамить старыми отзывами
  try {
    const totalRecords = await prisma.avitoSentReview.count()
    if (totalRecords === 0) {
      console.log('[AvitoReviewsService] База отзывов пуста. Первоначальный посев всех существующих ID...')
      await seedExistingAvitoReviewIds()
      console.log('[AvitoReviewsService] Посев завершён. Теперь отслеживаем новые отзывы.')
      return {
        checkedAccounts: accounts.length,
        newReviewsFound: 0,
        errors: [],
      }
    }
  } catch (dbErr) {
    console.error('[AvitoReviewsService] Ошибка проверки базы avitoSentReview:', dbErr)
  }

  for (const acc of accounts) {
    try {
      const reviews = await fetchAvitoReviews(acc.clientId, acc.clientSecret, 30)

      for (const rev of reviews) {
        const compositeKey = `${acc.clientId}_${rev.id}`
        const existing = await prisma.avitoSentReview.findUnique({
          where: { reviewId: compositeKey },
        })

        if (existing) continue

        // Найден действительно НОВЫЙ отзыв!
        await sendReviewNotification(rev, acc.name, chatId, token)

        await prisma.avitoSentReview.create({
          data: {
            reviewId: compositeKey,
            accountName: acc.name,
          },
        })

        newReviewsFound++
      }
    } catch (err: any) {
      const msg = `Ошибка аккаунта «${acc.name}»: ${err?.message || String(err)}`
      console.error(`[AvitoReviewsService] ${msg}`)
      errors.push(msg)
    }
  }

  return {
    checkedAccounts: accounts.length,
    newReviewsFound,
    errors,
  }
}
