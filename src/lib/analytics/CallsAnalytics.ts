import { amoClient } from './AmoClient'

export interface CallsStats {
  incomingCalls: number
  missedCalls: number
  totalCalls: number
}

export class CallsAnalytics {
  async calculateForDate(dateString: string): Promise<CallsStats> {
    const targetDate = new Date(dateString)

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)

    const fromTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000)

    try {
      const calls = await amoClient.getCalls(fromTimestamp, toTimestamp)

      if (!calls || calls.length === 0) {
        return { incomingCalls: 0, missedCalls: 0, totalCalls: 0 }
      }

      // Входящие звонки (direction === 'in')
      const incoming = calls.filter((c: any) => c.direction === 'in' || c.call_result === 'answered')
      const missed = calls.filter((c: any) => c.direction === 'in' && (c.call_result === 'no_answer' || c.duration === 0))

      return {
        incomingCalls: incoming.length,
        missedCalls: missed.length,
        totalCalls: calls.length,
      }
    } catch {
      return { incomingCalls: 0, missedCalls: 0, totalCalls: 0 }
    }
  }
}

export const callsAnalytics = new CallsAnalytics()
