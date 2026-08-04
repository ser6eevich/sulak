import { amoClient, AmoEvent } from './AmoClient'

export interface MessagesStats {
  newMessages: number
  repeatMessages: number
  newIncoming: number
  totalEventsCount: number
}

function isValueSetToYes(ev: AmoEvent): boolean {
  if (!ev.value_after) return false
  const val = Array.isArray(ev.value_after) ? ev.value_after[0] : ev.value_after
  const item = val?.custom_field_value || val
  if (!item) return false
  const text = String(item.text || '').toLowerCase()
  return text === 'да' || item.enum_id === 701271 || item.enum_id === 701315 || item.enum_id === 701695
}

function getCustomFieldName(ev: AmoEvent): string {
  let str = ''
  if (ev.value_after) {
    try {
      const val = Array.isArray(ev.value_after) ? ev.value_after[0] : ev.value_after
      if (val?.custom_field?.name) str += ' ' + String(val.custom_field.name)
      if (val?.name) str += ' ' + String(val.name)
      str += ' ' + JSON.stringify(ev.value_after)
    } catch {}
  }
  return str
}

export class MessagesAnalytics {
  async calculateForDate(dateString: string): Promise<MessagesStats> {
    const parts = dateString.split('-').map(Number)
    const year = parts[0] || new Date().getFullYear()
    const month = (parts[1] || 1) - 1
    const day = parts[2] || new Date().getDate()

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0)
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

    const fromTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000)

    // 1. Загружаем все события за день
    const events = await amoClient.getEvents(fromTimestamp, toTimestamp, [])

    if (!events || events.length === 0) {
      return { newMessages: 0, repeatMessages: 0, newIncoming: 0, totalEventsCount: 0 }
    }

    // 2. Сбор дат создания сделок/контактов
    const leadIds = Array.from(new Set(events.filter((ev) => ev.entity_id && ev.entity_type === 'lead').map((ev) => ev.entity_id)))
    const leads = await amoClient.getLeadsByIds(leadIds)
    const leadMap = new Map(leads.map((l) => [l.id, l]))

    let newMsgsCount = 0
    let repeatMsgsCount = 0

    // Проверяем точные кастомные поля SalesBot:
    // ID 1042391: "Есть обращение (новые)? Отчет"
    // ID 1042419: "Есть обращение (повторные)? Отчет"
    for (const ev of events) {
      if (!isValueSetToYes(ev)) continue

      const fieldStr = getCustomFieldName(ev).toLowerCase()
      const isNewField = ev.type === 'custom_field_1042391_value_changed' || (fieldStr.includes('обращение') && fieldStr.includes('новые'))
      const isRepeatField = ev.type === 'custom_field_1042419_value_changed' || (fieldStr.includes('обращение') && (fieldStr.includes('повтор') || fieldStr.includes('повторные')))

      if (isNewField) {
        const lead = leadMap.get(ev.entity_id)
        const isCreatedToday = !lead || (lead.created_at >= fromTimestamp && lead.created_at <= toTimestamp)
        if (isCreatedToday) {
          newMsgsCount++
        }
      } else if (isRepeatField) {
        repeatMsgsCount++
      }
    }

    // Если нашли события полей SalesBot — отдаём их точные значения
    if (newMsgsCount > 0 || repeatMsgsCount > 0) {
      return {
        newMessages: newMsgsCount,
        repeatMessages: repeatMsgsCount,
        newIncoming: newMsgsCount,
        totalEventsCount: newMsgsCount + repeatMsgsCount,
      }
    }

    // Фолбэк на стандартные входящие чат-сообщения
    const incomingChatEvents = events.filter((ev) => ev.type === 'incoming_chat_message')
    const newContacts = new Set<number>()
    const repeatContacts = new Set<number>()

    for (const ev of incomingChatEvents) {
      const lead = leadMap.get(ev.entity_id)
      if (lead && lead.created_at) {
        if (lead.created_at >= fromTimestamp && lead.created_at <= toTimestamp) {
          newContacts.add(ev.entity_id)
        } else {
          repeatContacts.add(ev.entity_id)
        }
      } else {
        newContacts.add(ev.entity_id)
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
