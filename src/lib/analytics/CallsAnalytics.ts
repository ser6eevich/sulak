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
      const [allEvents, callsCreated, callsUpdated] = await Promise.all([
        amoClient.getEvents(fromTimestamp, toTimestamp, []),
        amoClient.getCalls(fromTimestamp, toTimestamp),
        amoClient.getCallsByUpdatedAt(fromTimestamp, toTimestamp),
      ])

      const leadIds = (allEvents || [])
        .filter((ev) => ev.entity_id && ev.entity_type === 'lead')
        .map((ev) => ev.entity_id)

      const leads = await amoClient.getLeadsByIds(leadIds)
      const leadMap = new Map(leads.map((l) => [l.id, l]))

      // Поле SalesBot "Есть звонок (новые)" — фильтруем по дате создания сделки (Созданы: сегодня)
      const callFieldEvents = (allEvents || []).filter((ev) => {
        const fieldStr = getCustomFieldName(ev).toLowerCase()
        if (!fieldStr.includes('звонок') || !fieldStr.includes('новые')) return false
        const lead = leadMap.get(ev.entity_id)
        return !lead || (lead.created_at >= fromTimestamp && lead.created_at <= toTimestamp)
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
