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

    // Собираем ID по типам сущностей (lead, contact, talk)
    const leadIds: number[] = []
    const contactIds: number[] = []
    const talkIds: number[] = []

    events.forEach((ev) => {
      if (!ev.entity_id) return
      if (ev.entity_type === 'lead') leadIds.push(ev.entity_id)
      else if (ev.entity_type === 'contact') contactIds.push(ev.entity_id)
      else talkIds.push(ev.entity_id)
    })

    // 2. Получаем метаданные сущностей по их ID
    const [leads, contacts, talksById, recentTalks] = await Promise.all([
      amoClient.getLeadsByIds(leadIds),
      amoClient.getContactsByIds(contactIds),
      amoClient.getTalksByIds(talkIds),
      amoClient.getTalks(),
    ])

    const leadMap = new Map(leads.map((l) => [l.id, l]))
    const contactMap = new Map(contacts.map((c) => [c.id, c]))
    const talkMap = new Map<number, AmoTalk>()
    for (const t of recentTalks) if (t.id) talkMap.set(t.id, t)
    for (const t of talksById) if (t.id) talkMap.set(t.id, t)

    const talksCreatedToday = new Set<number>()
    events.forEach((ev) => {
      if (ev.type === 'talk_created') talksCreatedToday.add(ev.entity_id)
    })

    const newContacts = new Set<number>()
    const repeatContacts = new Set<number>()
    const incomingEvents = events.filter((ev) => ev.type === 'incoming_chat_message')

    for (const ev of incomingEvents) {
      const entityId = ev.entity_id
      let createdAtTimestamp: number | undefined

      if (ev.entity_type === 'lead') {
        createdAtTimestamp = leadMap.get(entityId)?.created_at
      } else if (ev.entity_type === 'contact') {
        createdAtTimestamp = contactMap.get(entityId)?.created_at
      } else if (ev.entity_type === 'talk') {
        createdAtTimestamp = talkMap.get(entityId)?.created_at
      }

      // Если в профильном мапе не нашли, проверяем другие мапы на всякий случай
      if (!createdAtTimestamp) {
        createdAtTimestamp =
          talkMap.get(entityId)?.created_at ||
          leadMap.get(entityId)?.created_at ||
          contactMap.get(entityId)?.created_at
      }

      if (createdAtTimestamp) {
        // Если сущность (сделка/контакт/беседа) создана СЕГОДНЯ — новое сообщение
        if (createdAtTimestamp >= fromTimestamp && createdAtTimestamp <= toTimestamp) {
          newContacts.add(entityId)
        } else if (createdAtTimestamp < fromTimestamp) {
          // Если сущность создана ДО сегодняшнего дня — повторное сообщение
          repeatContacts.add(entityId)
        }
      } else {
        // Если через API не удалось найти дату создания сущности:
        // Проверяем событие talk_created за сегодня
        if (talksCreatedToday.has(entityId)) {
          newContacts.add(entityId)
        } else {
          // При отсутствии даты по умолчанию относим к новым, если сообщение пришло сегодня
          newContacts.add(entityId)
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
