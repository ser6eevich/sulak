import { amoClient } from './AmoClient'

export interface CallsStats {
  incomingCalls: number
  missedCalls: number
  totalCalls: number
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
      // 1. Загружаем звонки из REST API /api/v4/calls
      // 2. Также загружаем события звонков из /api/v4/events (для интеграций телефоний, пишущих в события)
      const [calls, callEvents] = await Promise.all([
        amoClient.getCalls(fromTimestamp, toTimestamp),
        amoClient.getEvents(fromTimestamp, toTimestamp, [
          'incoming_call',
          'outgoing_call',
          'call_in',
          'call_out',
        ]),
      ])

      let incomingCount = 0
      let missedCount = 0
      let totalCount = (calls?.length || 0)

      if (calls && calls.length > 0) {
        calls.forEach((c: any) => {
          const dir = String(c.direction || c.type || '').toLowerCase()
          const isIncoming = dir === 'in' || dir === 'inbound' || dir === 'incoming' || c.call_result === 'answered'
          const isMissed = dir === 'in' && (c.call_result === 'no_answer' || c.duration === 0)

          if (isIncoming) incomingCount++
          if (isMissed) missedCount++
        })
      }

      // Если в /api/v4/calls звонков мало или 0, проверяем события телефонии
      if (callEvents && callEvents.length > 0) {
        const incomingEvents = callEvents.filter((ev) =>
          ['incoming_call', 'call_in'].includes(ev.type)
        )
        // Если из событий пришло больше входящих звонков, используем их
        if (incomingEvents.length > incomingCount) {
          incomingCount = incomingEvents.length
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
