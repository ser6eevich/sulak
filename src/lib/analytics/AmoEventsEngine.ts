import { amoClient, AmoEvent } from './AmoClient'

export const FIELD_NEW_MESSAGE_ID = 1042391 // "Есть обращение (новые)? Отчет"
export const FIELD_REPEAT_MESSAGE_ID = 1042419 // "Есть обращение (повторные)? Отчет"
export const FIELD_NEW_CALL_ID = 1041695 // "Есть звонок (новые)?"

export interface AmoCalculatedStats {
  newMessages: number
  repeatMessages: number
  incomingCalls: number
  totalLeads: number
  totalEventsCount: number
}

export interface AmoDiagnosticRow {
  date: string
  eventId: string
  eventType: string
  leadId: number
  fieldId: number | null
  valueBefore: string
  valueAfter: string
  enumId: number | null
  createdAtFormatted: string
}

/**
 * Вспомогательная функция расчёта Unix Timestamp для Europe/Moscow (UTC+3)
 */
export function getMoscowDayTimestamps(dateString: string): { fromTs: number; toTs: number } {
  // dateString: "YYYY-MM-DD"
  const [yearStr, monthStr, dayStr] = dateString.split('-')
  const y = parseInt(yearStr || '2026', 10)
  const m = parseInt(monthStr || '01', 10)
  const d = parseInt(dayStr || '01', 10)

  // 00:00:00 MSK (UTC+3)
  const startIso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+03:00`
  // 23:59:59 MSK (UTC+3)
  const endIso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T23:59:59+03:00`

  const fromTs = Math.floor(Date.parse(startIso) / 1000)
  const toTs = Math.floor(Date.parse(endIso) / 1000)

  return { fromTs, toTs }
}

export class AmoEventsEngine {
  /**
   * Загрузка всех событий дня из /api/v4/events по Europe/Moscow
   */
  async fetchRawEventsForDate(dateString: string): Promise<AmoEvent[]> {
    const { fromTs, toTs } = getMoscowDayTimestamps(dateString)

    const allEvents: AmoEvent[] = []
    const seenEventIds = new Set<string>()
    let page = 1
    const limit = 250

    console.log(`\n📡 [AmoEventsEngine] Начало выгрузки событий за ${dateString} (Europe/Moscow: ${fromTs}..${toTs})`)

    while (true) {
      const endpoint = `/api/v4/events?limit=${limit}&page=${page}&filter[created_at][from]=${fromTs}&filter[created_at][to]=${toTs}&filter[entity]=lead`
      
      const data = await amoClient.request<{ _embedded?: { events?: AmoEvent[] }; _links?: { next?: any } }>(endpoint)

      if (!data || !data._embedded || !data._embedded.events) {
        console.log(`[AmoEventsEngine] Страница ${page}: событий не найдено или конец ленты.`)
        break
      }

      const events = data._embedded.events
      console.log(`[AmoEventsEngine] Страница ${page}: загружено ${events.length} событий`)

      if (events.length === 0) break

      for (const ev of events) {
        if (ev && ev.id && !seenEventIds.has(String(ev.id))) {
          seenEventIds.add(String(ev.id))
          allEvents.push(ev)
        }
      }

      if (events.length < limit) break
      if (!data._links?.next) break

      page++
      if (page > 50) break // Страховочное ограничение на 50 страниц (12,500 событий)
    }

    console.log(`✅ [AmoEventsEngine] Итого загружено уникальных событий: ${allEvents.length}\n`)
    return allEvents
  }

  /**
   * Разбор значения события кастомного поля
   */
  parseEventFieldValue(ev: AmoEvent): {
    fieldId: number | null
    textAfter: string
    textBefore: string
    enumIdAfter: number | null
    isYes: boolean
  } {
    let fieldId: number | null = null
    let textAfter = ''
    let textBefore = ''
    let enumIdAfter: number | null = null

    if (ev.value_after) {
      const valAfter = Array.isArray(ev.value_after) ? ev.value_after[0] : ev.value_after
      const item = valAfter?.custom_field_value || valAfter
      if (item) {
        if (item.field_id) fieldId = Number(item.field_id)
        if (item.text !== undefined && item.text !== null) textAfter = String(item.text).trim()
        if (item.enum_id !== undefined && item.enum_id !== null) enumIdAfter = Number(item.enum_id)
      }
    }

    if (ev.value_before) {
      const valBefore = Array.isArray(ev.value_before) ? ev.value_before[0] : ev.value_before
      const item = valBefore?.custom_field_value || valBefore
      if (item) {
        if (!fieldId && item.field_id) fieldId = Number(item.field_id)
        if (item.text !== undefined && item.text !== null) textBefore = String(item.text).trim()
      }
    }

    // В type может быть ID поля: custom_field_1042391_value_changed
    if (!fieldId && ev.type && ev.type.startsWith('custom_field_')) {
      const parts = ev.type.split('_')
      if (parts[2] && !isNaN(Number(parts[2]))) {
        fieldId = Number(parts[2])
      }
    }

    const lowerAfter = textAfter.toLowerCase()
    const isYes =
      lowerAfter === 'да' ||
      enumIdAfter === 701271 ||
      enumIdAfter === 701315 ||
      enumIdAfter === 701695

    return { fieldId, textAfter, textBefore, enumIdAfter, isYes }
  }

  /**
   * Расчёт статистики метрик по требованиям
   */
  async calculateForDate(dateString: string): Promise<AmoCalculatedStats> {
    const rawEvents = await this.fetchRawEventsForDate(dateString)

    let newMessages = 0
    let repeatMessages = 0
    let incomingCalls = 0

    for (const ev of rawEvents) {
      const { fieldId, isYes } = this.parseEventFieldValue(ev)

      if (!isYes) continue

      if (fieldId === FIELD_NEW_MESSAGE_ID || ev.type === `custom_field_${FIELD_NEW_MESSAGE_ID}_value_changed`) {
        newMessages++
      } else if (fieldId === FIELD_REPEAT_MESSAGE_ID || ev.type === `custom_field_${FIELD_REPEAT_MESSAGE_ID}_value_changed`) {
        repeatMessages++
      } else if (fieldId === FIELD_NEW_CALL_ID || ev.type === `custom_field_${FIELD_NEW_CALL_ID}_value_changed`) {
        incomingCalls++
      }
    }

    const totalLeads = newMessages + incomingCalls

    return {
      newMessages,
      repeatMessages,
      incomingCalls,
      totalLeads,
      totalEventsCount: rawEvents.length,
    }
  }

  /**
   * Режим диагностики: формирование таблицы строк для сверки с лентой amoCRM
   */
  async getDiagnosticRows(dateString: string): Promise<AmoDiagnosticRow[]> {
    const rawEvents = await this.fetchRawEventsForDate(dateString)
    const rows: AmoDiagnosticRow[] = []

    for (const ev of rawEvents) {
      const { fieldId, textAfter, textBefore, enumIdAfter, isYes } = this.parseEventFieldValue(ev)

      if (
        fieldId === FIELD_NEW_MESSAGE_ID ||
        fieldId === FIELD_REPEAT_MESSAGE_ID ||
        fieldId === FIELD_NEW_CALL_ID ||
        ev.type.includes('custom_field_')
      ) {
        if (isYes) {
          const dt = new Date(ev.created_at * 1000)
          rows.push({
            date: dateString,
            eventId: String(ev.id),
            eventType: ev.type,
            leadId: Number(ev.entity_id),
            fieldId,
            valueBefore: textBefore || '-',
            valueAfter: textAfter || 'Да',
            enumId: enumIdAfter,
            createdAtFormatted: dt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
          })
        }
      }
    }

    return rows
  }
}

export const amoEventsEngine = new AmoEventsEngine()
