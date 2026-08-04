import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/utils/supabase/server'

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@sulak.ru'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  )
}

export async function POST(req: Request) {
  try {
    // 1. Проверяем аутентификацию сотрудника
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    const { subscription, title, body, url } = await req.json()

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Подписка не передана' }, { status: 400 })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID ключи не настроены на сервере' }, { status: 500 })
    }

    const payload = JSON.stringify({
      title: title || 'Сулак CRM 🚀',
      body: body || 'Уведомления на iPhone успешно подключены!',
      url: url || '/orders',
      icon: '/icon-192.png'
    })

    await webpush.sendNotification(subscription, payload)

    return NextResponse.json({ success: true, message: 'Push-уведомление отправлено на iPhone!' })
  } catch (error: any) {
    console.error('Ошибка отправки Web Push:', error)
    return NextResponse.json({ error: error.message || 'Ошибка отправки push' }, { status: 500 })
  }
}
