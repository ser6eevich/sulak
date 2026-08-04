'use client'

import { useState, useEffect } from 'react'
import { Bell, BellCheck, Send, AlertCircle, X, HelpCircle, RefreshCw, Trash2 } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setPermission(Notification.permission)
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => {
            if (reg.pushManager) {
              return reg.pushManager.getSubscription()
            }
            return null
          })
          .then(sub => {
            if (sub) {
              setSubscription(sub)
            }
          })
          .catch(err => console.error('SW Error:', err))
      }
    }
  }, [])

  const resetAndUnsubscribe = async () => {
    setLoading(true)
    setStatusMsg('')
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const reg of registrations) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            await sub.unsubscribe()
          }
          await reg.unregister()
        }
      }
      setSubscription(null)
      setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default')
      setStatusMsg('Старая подписка очищена. Попробуйте нажать Включить Push заново.')
    } catch (e: any) {
      setStatusMsg('Подписка сброшена.')
    } finally {
      setLoading(false)
    }
  }

  const subscribeUserToPush = async () => {
    setLoading(true)
    setStatusMsg('')

    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setStatusMsg('iOS Safari отключает Push в обычной вкладке. Добавьте сайт на экран «Домой»!')
        setShowInfoModal(true)
        setLoading(false)
        return
      }

      const resPermission = await Notification.requestPermission()
      setPermission(resPermission)

      if (resPermission !== 'granted') {
        setStatusMsg('Разрешение отклонено в iOS. Очистите историю Safari.')
        setShowInfoModal(true)
        setLoading(false)
        return
      }

      if (!('serviceWorker' in navigator)) {
        setStatusMsg('Откройте сайт с иконки на рабочем столе!')
        setShowInfoModal(true)
        setLoading(false)
        return
      }

      let reg = await navigator.serviceWorker.register('/sw.js?v=' + Date.now())
      await navigator.serviceWorker.ready

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setStatusMsg('VAPID ключ не настроен.')
        setLoading(false)
        return
      }

      const convertedKey = urlBase64ToUint8Array(vapidPublicKey)
      let sub = await reg.pushManager.getSubscription()

      if (sub) {
        await sub.unsubscribe()
      }

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      })

      setSubscription(sub)
      setStatusMsg('Push-уведомления успешно подключены! 🚀')
    } catch (err: any) {
      console.error('Push error:', err)
      setStatusMsg(err.message || 'Ошибка подписки.')
      setShowInfoModal(true)
    } finally {
      setLoading(false)
    }
  }

  const sendTestNotification = async () => {
    if (!subscription) {
      subscribeUserToPush()
      return
    }

    setLoading(true)
    setStatusMsg('')
    try {
      const res = await fetch('/api/push/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          title: 'Сулак CRM 🔔',
          body: 'Тестовое нативное Push-уведомление на iPhone работает отлично!',
          url: '/orders'
        })
      })

      const data = await res.json()
      if (res.ok) {
        setStatusMsg('Всплывашка отправлена! Проверьте шторку iPhone 📲')
      } else {
        setStatusMsg(`Ошибка отправки: ${data.error}`)
      }
    } catch (err: any) {
      setStatusMsg('Не удалось отправить тестовое уведомление')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {permission === 'granted' ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
              <BellCheck className="h-3 w-3 text-emerald-500" />
              Push активен
            </span>
            <button
              type="button"
              onClick={sendTestNotification}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface-active)] text-[var(--text-primary)] text-[11px] font-medium border border-[var(--border-primary)] transition cursor-pointer touch-manipulation"
              title="Отправить тестовое уведомление на iPhone"
            >
              <Send className="h-3 w-3 text-[var(--accent-primary)]" />
              <span>Тест Push</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={subscribeUserToPush}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50 touch-manipulation"
              title="Включить Push-уведомления на iPhone"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{loading ? 'Подключение...' : 'Включить Push'}</span>
            </button>

            {permission === 'denied' && (
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium transition cursor-pointer touch-manipulation"
                title="Показать инструкцию по сбросу"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Инструкция</span>
              </button>
            )}
          </div>
        )}

        {statusMsg && (
          <div className="text-[10px] text-[var(--text-secondary)] font-medium max-w-[200px] truncate" title={statusMsg}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* Модалка с подробными инструкциями для iOS */}
      {showInfoModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowInfoModal(false)}
        >
          <div 
            className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl shadow-2xl p-5 space-y-4 text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Сброс блокировки уведомлений на iPhone
              </h3>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs space-y-3 text-[var(--text-secondary)]">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg text-xs space-y-1">
                <strong className="block">Удалять иконку не требуется!</strong>
                <div>Разрешения запоминаются в браузере Safari. Сбросьте историю Safari ниже.</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-[var(--text-primary)] uppercase text-[10px] tracking-wider">Как сбросить отказ за 15 секунд:</h4>
                <div className="bg-[var(--bg-surface-secondary)] p-3 rounded-lg border border-[var(--border-primary)] space-y-2 font-medium">
                  <div>1. Зайдите в <strong>Настройки iPhone ➔ Safari</strong>.</div>
                  <div>2. Нажмите <strong>Очистить историю и данные</strong>.</div>
                  <div>3. Переоткройте приложение с иконки на рабочем столе ➔ нажмите <strong>Включить Push</strong> ➔ выберите <strong>Разрешить</strong>.</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetAndUnsubscribe}
                  className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-[var(--text-primary)] text-xs font-medium flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Сбросить подписку в браузере
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full erp-button-primary text-xs py-2"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  )
}
