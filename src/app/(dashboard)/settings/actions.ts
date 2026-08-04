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

  if (!profile || !profile.isActive || !['admin', 'owner'].includes(profile.role)) {
    throw new Error('Управлять настройками может только администратор или владелец')
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
) {
  try {
    await checkAdminOrOwner()

    const cleanChatId = chatId.trim()
    const cleanToken = botToken.trim()
    const cleanOwnerTag = (ownerTag || '').trim()
    const cleanWarehouseTag = (warehouseTag || '').trim()
    const cleanSiteUrl = (siteUrl || '').trim()

    if (!cleanChatId) {
      return { error: 'ID чата Telegram не может быть пустым' }
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.system_settings (key, value, updated_at)
      VALUES ('telegram_chat_id', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `, cleanChatId)

    if (cleanToken) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.system_settings (key, value, updated_at)
        VALUES ('telegram_bot_token', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
      `, cleanToken)
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.system_settings (key, value, updated_at)
      VALUES ('telegram_owner_tag', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `, cleanOwnerTag)

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.system_settings (key, value, updated_at)
      VALUES ('telegram_warehouse_tag', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `, cleanWarehouseTag)

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.system_settings (key, value, updated_at)
      VALUES ('telegram_site_url', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `, cleanSiteUrl)

    if (thresholds && typeof thresholds === 'object') {
      for (const [statusKey, hoursVal] of Object.entries(thresholds)) {
        if (typeof hoursVal === 'number' && hoursVal > 0) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO public.system_settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
          `, `stale_threshold_${statusKey}`, String(hoursVal))
        }
      }
    }

    if (topics && typeof topics === 'object') {
      for (const [tKey, tVal] of Object.entries(topics)) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.system_settings (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        `, `telegram_topic_${tKey}`, (tVal || '').trim())
      }
    }

    revalidatePath('/settings')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера при сохранении' }
  }
}

export async function testTelegramNotificationAction(chatId: string, botToken: string, topicId?: string) {
  try {
    await checkAdminOrOwner()

    const cleanChatId = chatId.trim()
    const cleanToken = botToken.trim()

    if (!cleanChatId || !cleanToken) {
      return { error: 'Укажите ID чата и Токен бота для проверки' }
    }

    const textMessage = `🎉 <b>Тестовое сообщение CRM «Сулак»</b>\n\nПроверка доставки уведомлений прошла успешно! Chat ID (${cleanChatId}) сохранен и готов к работе. ⭐`
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`

    const payload: any = {
      chat_id: cleanChatId,
      text: textMessage,
      parse_mode: 'HTML',
    }

    if (topicId && !isNaN(parseInt(topicId.trim(), 10))) {
      payload.message_thread_id = parseInt(topicId.trim(), 10)
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      return { error: `Telegram API вернул ошибку: ${data.description || 'Неверный Chat ID или Token'}` }
    }

    return { success: true, message: `Сообщение успешно отправлено в чат! (ID сообщения: ${data.result?.message_id})` }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка отправки в Telegram' }
  }
}

// ─────────────────────────────────────────────────────────────
// Авито: сохранение аккаунтов и топика «Отзывы»
// ─────────────────────────────────────────────────────────────

export interface AvitoAccountInput {
  name: string
  clientId: string
  clientSecret: string
}

export async function saveAvitoSettingsAction(
  reviewsTopicId: string,
  accounts: AvitoAccountInput[]
): Promise<{ error?: string; success?: boolean }> {
  try {
    await checkAdminOrOwner()

    const upserts: Promise<any>[] = []

    // Сохраняем ID темы «Отзывы»
    upserts.push(
      prisma.systemSetting.upsert({
        where: { key: 'telegram_topic_reviews' },
        update: { value: reviewsTopicId.trim() },
        create: { key: 'telegram_topic_reviews', value: reviewsTopicId.trim() },
      })
    )

    // Сначала удаляем старые записи аккаунтов (1..7)
    for (let i = 1; i <= 7; i++) {
      for (const field of ['name', 'client_id', 'client_secret']) {
        upserts.push(
          prisma.systemSetting.deleteMany({
            where: { key: `avito_account_${i}_${field}` },
          })
        )
      }
    }

    await Promise.all(upserts)

    // Сохраняем новые аккаунты
    const accountUpserts: Promise<any>[] = []
    accounts.forEach((acc, idx) => {
      const i = idx + 1
      if (!acc.name && !acc.clientId) return
      if (acc.name) {
        accountUpserts.push(
          prisma.systemSetting.upsert({
            where: { key: `avito_account_${i}_name` },
            update: { value: acc.name.trim() },
            create: { key: `avito_account_${i}_name`, value: acc.name.trim() },
          })
        )
      }
      if (acc.clientId) {
        accountUpserts.push(
          prisma.systemSetting.upsert({
            where: { key: `avito_account_${i}_client_id` },
            update: { value: acc.clientId.trim() },
            create: { key: `avito_account_${i}_client_id`, value: acc.clientId.trim() },
          })
        )
      }
      if (acc.clientSecret) {
        accountUpserts.push(
          prisma.systemSetting.upsert({
            where: { key: `avito_account_${i}_client_secret` },
            update: { value: acc.clientSecret.trim() },
            create: { key: `avito_account_${i}_client_secret`, value: acc.clientSecret.trim() },
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

