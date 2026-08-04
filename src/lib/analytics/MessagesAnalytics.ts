import { amoClient, AmoEvent, AmoTalk } from './AmoClient'

export interface MessagesStats {
  newMessages: number
  repeatMessages: number
  newIncoming: number
  totalEventsCount: number
}

function getCustomFieldName(ev: AmoEvent): string {
  if (!ev.value_after) return ''
  try {
    const val = Array.isArray(ev.value_after) ? ev.value_after[0] : ev.value_after
    if (val?.custom_field?.name) return String(val.custom_field.name)
    if (val?.name) return String(val.name)
    return JSON.stringify(ev.value_after)
  } catch {
    return ''
  }
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

    // 1. Загружаем все события за выбранный день
    const events = await amoClient.getEvents(fromTimestamp, toTimestamp, [])

    if (!events || events.length === 0) {
      return {
        newMessages: 0,
        repeatMessages: 0,
        newIncoming: 0,
        totalEventsCount: 0,
      }
    }

    // 2. Ищем события изменения кастомных полей SalesBot: "Есть обращение (новые)" и "Есть обращение (повторные)"
    const newMsgFieldEvents = events.filter((ev) => {
      const fieldStr = getCustomFieldName(ev).toLowerCase()
      return fieldStr.includes('обращение') && fieldStr.includes('новые')
    })

    const repeatMsgFieldEvents = events.filter((ev) => {
      const fieldStr = getCustomFieldName(ev).toLowerCase()
      return fieldStr.includes('обращение') && (fieldStr.includes('повтор') || fieldStr.includes('повторные'))
    })

    // Если есть записи полей SalesBot — утилизируем точные цифры бота
    if (newMsgFieldEvents.length > 0 || repeatMsgFieldEvents.length > 0) {
      return {
        newMessages: newMsgFieldEvents.length,
        repeatMessages: repeatMsgFieldEvents.length,
        newIncoming: newMsgFieldEvents.length,
        totalEventsCount: newMsgFieldEvents.length + repeatMsgFieldEvents.length,
      }
    }

    // Фолбэк: анализ классических чат-событий если SalesBot не заполнял поля
    const incomingChatEvents = events.filter((ev) => ev.type === 'incoming_chat_message')

    const leadIds: number[] = []
    const contactIds: number[] = []
    const talkIds: number[] = []

    incomingChatEvents.forEach((ev) => {
      if (!ev.entity_id) return
      if (ev.entity_type === 'lead') leadIds.push(ev.entity_id)
      else if (ev.entity_type === 'contact') contactIds.push(ev.entity_id)
      else talkIds.push(ev.entity_id)
    })

    const [leads, contacts, talksById] = await Promise.all([
      amoClient.getLeadsByIds(leadIds),
      amoClient.getContactsByIds(contactIds),
      amoClient.getTalksByIds(talkIds),
    ])

    const leadMap = new Map(leads.map((l) => [l.id, l]))
    const contactMap = new Map(contacts.map((c) => [c.id, c]))
    const talkMap = new Map<number, AmoTalk>()
    for (const t of talksById) if (t.id) talkMap.set(t.id, t)

    const newContacts = new Set<number>()
    const repeatContacts = new Set<number>()

    for (const ev of incomingChatEvents) {
      const entityId = ev.entity_id
      let createdAtTimestamp: number | undefined

      if (ev.entity_type === 'lead') createdAtTimestamp = leadMap.get(entityId)?.created_at
      else if (ev.entity_type === 'contact') createdAtTimestamp = contactMap.get(entityId)?.created_at
      else if (ev.entity_type === 'talk') createdAtTimestamp = talkMap.get(entityId)?.created_at

      if (!createdAtTimestamp) {
        createdAtTimestamp =
          talkMap.get(entityId)?.created_at ||
          leadMap.get(entityId)?.created_at ||
          contactMap.get(entityId)?.created_at
      }

      if (createdAtTimestamp) {
        if (createdAtTimestamp >= fromTimestamp && createdAtTimestamp <= toTimestamp) {
          newContacts.add(entityId)
        } else if (createdAtTimestamp < fromTimestamp) {
          repeatContacts.add(entityId)
        }
      } else {
        newContacts.add(entityId)
      }
    }

    return {
      newMessages: newContacts.size,
      repeatMessages: repeatContacts.size,
      newIncoming: newContacts.size,
      totalEventsCount: incomingChatEvents.length,
    }
  }
}

export const messagesAnalytics = new MessagesAnalytics()
