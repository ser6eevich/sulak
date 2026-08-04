import { amoClient, AmoEvent } from './AmoClient'

export interface CallsStats {
  incomingCalls: number
  missedCalls: number
  totalCalls: number
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

      const leadIds = Array.from(new Set((allEvents || []).filter((ev) => ev.entity_id && ev.entity_type === 'lead').map((ev) => ev.entity_id)))
      const leads = await amoClient.getLeadsByIds(leadIds)
      const leadMap = new Map(leads.map((l) => [l.id, l]))

      // Проверяем точное кастомное поле SalesBot: ID 1041695 ("Есть звонок (новые)?")
      let incomingCallsCount = 0

      for (const ev of (allEvents || [])) {
        if (!isValueSetToYes(ev)) continue

        const fieldStr = getCustomFieldName(ev).toLowerCase()
        const isCallField = ev.type === 'custom_field_1041695_value_changed' || (fieldStr.includes('звонок') && fieldStr.includes('новые'))

        if (isCallField) {
          const lead = leadMap.get(ev.entity_id)
          const isCreatedToday = !lead || (lead.created_at >= fromTimestamp && lead.created_at <= toTimestamp)
          if (isCreatedToday) {
            incomingCallsCount++
          }
        }
      }

      if (incomingCallsCount > 0) {
        return {
          incomingCalls: incomingCallsCount,
          missedCalls: 0,
          totalCalls: incomingCallsCount,
        }
      }

      // Фолбэк на классический REST API звонков
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
