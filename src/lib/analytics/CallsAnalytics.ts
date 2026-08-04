import { amoClient, AmoEvent } from './AmoClient'

export interface CallsStats {
  incomingCalls: number
  missedCalls: number
  totalCalls: number
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

export class CallsAnalytics {
  async calculateForDate(dateString: string): Promise<CallsStats> {
    const parts = dateString.split('-').map(Number)
    const year = parts[0] || new Date().getFullYear()
    const month = (parts[1] || 1) - 1
    const day = parts[2] || new Date().getDate()

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0)
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

    const fromTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000)

    try {
      // 1. Загружаем все события дня из /api/v4/events
      // 2. Загружаем звонки из /api/v4/calls
      const [allEvents, callsCreated, callsUpdated] = await Promise.all([
        amoClient.getEvents(fromTimestamp, toTimestamp, []),
        amoClient.getCalls(fromTimestamp, toTimestamp),
        amoClient.getCallsByUpdatedAt(fromTimestamp, toTimestamp),
      ])

      // Проверяем поле SalesBot: "Есть звонок (новые)"
      const callFieldEvents = (allEvents || []).filter((ev) => {
        const fieldStr = getCustomFieldName(ev).toLowerCase()
        return fieldStr.includes('звонок') && fieldStr.includes('новые')
      })

      if (callFieldEvents.length > 0) {
        return {
          incomingCalls: callFieldEvents.length,
          missedCalls: 0,
          totalCalls: callFieldEvents.length,
        }
      }

      // Фолбэк на стандартный REST API звонков
      const callMap = new Map<number, any>()
      ;(callsCreated || []).forEach((c: any) => { if (c.id) callMap.set(c.id, c) })
      ;(callsUpdated || []).forEach((c: any) => { if (c.id) callMap.set(c.id, c) })
      const calls = Array.from(callMap.values())

      let incomingCount = 0
      let missedCount = 0
      let totalCount = calls.length

      if (calls.length > 0) {
        calls.forEach((c: any) => {
          const dir = String(c.direction || c.type || c.call_direction || '').toLowerCase()
          const isOutgoing = dir === 'out' || dir === 'outbound' || dir === 'outgoing' || dir === '2'
          const isIncoming = !isOutgoing || c.call_result === 'answered'
          const isMissed = isIncoming && (c.call_result === 'no_answer' || c.duration === 0 || c.call_status === 6)

          if (isIncoming) incomingCount++
          if (isMissed) missedCount++
        })
      }

      const callEvents = (allEvents || []).filter((ev) => {
        const type = String(ev.type || '').toLowerCase()
        return (
          type.includes('call') ||
          type.includes('phone') ||
          type === 'call_in' ||
          type === 'incoming_call'
        )
      })

      if (callEvents.length > 0) {
        const incomingCallEvents = callEvents.filter((ev) => {
          const type = String(ev.type || '').toLowerCase()
          return !type.includes('outgoing') && type !== 'call_out'
        })

        if (incomingCallEvents.length > incomingCount) {
          incomingCount = incomingCallEvents.length
        }
        if (callEvents.length > totalCount) {
          totalCount = callEvents.length
        }
      }

      return {
        incomingCalls: incomingCount,
        missedCalls: missedCount,
        totalCalls: totalCount,
      }
    } catch {
      return { incomingCalls: 0, missedCalls: 0, totalCalls: 0 }
    }
  }
}

export const callsAnalytics = new CallsAnalytics()
