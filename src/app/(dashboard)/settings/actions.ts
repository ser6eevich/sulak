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
