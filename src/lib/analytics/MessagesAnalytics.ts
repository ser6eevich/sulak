import { amoClient, AmoEvent, AmoTalk } from './AmoClient'

export interface MessagesStats {
  newMessages: number
  repeatMessages: number
  newIncoming: number
  totalEventsCount: number
}

export class MessagesAnalytics {
  /**
   * Полный расчёт метрик сообщений за выбранную дату
   * @param dateString Формат 'YYYY-MM-DD' или ISO дата
   */
  async calculateForDate(dateString: string): Promise<MessagesStats> {
    const targetDate = new Date(dateString)

    // Вычисляем временные рамки дня (с 00:00:00 до 23:59:59 в московском времени)
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)

    const fromTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000)

    // 1. Загружаем все входящие события сообщений за день и беседы
    const [events, talks] = await Promise.all([
      amoClient.getEvents(fromTimestamp, toTimestamp, ['incoming_chat_message']),
      amoClient.getTalks(),
    ])

    if (!events || events.length === 0) {
      return {
        newMessages: 0,
        repeatMessages: 0,
        newIncoming: 0,
        totalEventsCount: 0,
      }
    }

    // Сопоставление бесед по entity_id / id
    const talkMap = new Map<number, AmoTalk>()
    for (const t of talks) {
      if (t.id) talkMap.set(t.id, t)
      if (t.contact_id) talkMap.set(t.contact_id, t)
    }

    // Сбор уникальных контактов за выбранный день
    const newContacts = new Set<number>()
    const repeatContacts = new Set<number>()
    const allContactsToday = new Set<number>()

    for (const ev of events) {
      const talk = talkMap.get(ev.entity_id)
      const contactId = talk?.contact_id || ev.entity_id

      allContactsToday.add(contactId)

      if (talk && talk.created_at) {
        // Если беседа создана ВНУТРИ выбранного дня -> Новые сообщения
        if (talk.created_at >= fromTimestamp && talk.created_at <= toTimestamp) {
          newContacts.add(contactId)
        } else if (talk.created_at < fromTimestamp) {
          // Если беседа создана РАНЕЕ этого дня -> Повторные сообщения
          repeatContacts.add(contactId)
        }
      } else {
        // Если беседа не найдена в текущем списке бесед, относим к новым по времени события
        if (ev.created_at >= fromTimestamp && ev.created_at <= toTimestamp) {
          newContacts.add(contactId)
        }
      }
    }

    // 3. Новые входящие — уникальные клиенты, которые обратились сегодня впервые
    const newIncomingCount = newContacts.size

    return {
      newMessages: newContacts.size,
      repeatMessages: repeatContacts.size,
      newIncoming: newIncomingCount,
      totalEventsCount: events.length,
    }
  }
}

export const messagesAnalytics = new MessagesAnalytics()
