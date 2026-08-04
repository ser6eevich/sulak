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
   * @param dateString Формат 'YYYY-MM-DD'
   */
  async calculateForDate(dateString: string): Promise<MessagesStats> {
    // Парсим дату с учётом UTC/MSK компонента
    const parts = dateString.split('-').map(Number)
    const year = parts[0] || new Date().getFullYear()
    const month = (parts[1] || 1) - 1
    const day = parts[2] || new Date().getDate()

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0)
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

    const fromTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000)

    // 1. Загружаем все события сообщений за выбранный день
    const events = await amoClient.getEvents(fromTimestamp, toTimestamp, [
      'incoming_chat_message',
      'talk_created',
    ])

    if (!events || events.length === 0) {
      return {
        newMessages: 0,
        repeatMessages: 0,
        newIncoming: 0,
        totalEventsCount: 0,
      }
    }

    // Собираем все ID диалогов/сущностей
    const talkEntityIds = events.map((ev) => ev.entity_id).filter(Boolean)

    // 2. Получаем метаданные бесед по их ID + последние беседы
    const [talksById, recentTalks] = await Promise.all([
      amoClient.getTalksByIds(talkEntityIds),
      amoClient.getTalks(),
    ])

    const talkMap = new Map<number, AmoTalk>()
    for (const t of recentTalks) {
      if (t.id) talkMap.set(t.id, t)
    }
    for (const t of talksById) {
      if (t.id) talkMap.set(t.id, t)
    }

    // Собираем ID бесед, созданных строго СЕГОДНЯ
    const talksCreatedToday = new Set<number>()
    events.forEach((ev) => {
      if (ev.type === 'talk_created') {
        talksCreatedToday.add(ev.entity_id)
      }
    })

    const newContacts = new Set<number>()
    const repeatContacts = new Set<number>()
    const incomingEvents = events.filter((ev) => ev.type === 'incoming_chat_message')

    for (const ev of incomingEvents) {
      const talk = talkMap.get(ev.entity_id)
      const contactId = talk?.contact_id || ev.entity_id

      if (talk && talk.created_at) {
        // Если беседа создана СЕГОДНЯ — это новое сообщение
        if (talk.created_at >= fromTimestamp && talk.created_at <= toTimestamp) {
          newContacts.add(contactId)
        } else {
          // Если беседа создана ДО текущего дня — это ПОВТОРНОЕ сообщение!
          repeatContacts.add(contactId)
        }
      } else {
        // Если беседа создана сегодня (зафиксировано событием talk_created)
        if (talksCreatedToday.has(ev.entity_id)) {
          newContacts.add(contactId)
        } else {
          // Иначе это ранее открытый диалог -> повторное сообщение
          repeatContacts.add(contactId)
        }
      }
    }

    return {
      newMessages: newContacts.size,
      repeatMessages: repeatContacts.size,
      newIncoming: newContacts.size,
      totalEventsCount: incomingEvents.length,
    }
  }
}

export const messagesAnalytics = new MessagesAnalytics()
