import { messagesAnalytics } from './MessagesAnalytics'
import { callsAnalytics } from './CallsAnalytics'
import { salesAnalytics } from './SalesAnalytics'

export interface DailyReportData {
  dateStr: string // "2026-08-03"
  dateLabel: string // "03.08"
  messages: {
    newMessages: number
    repeatMessages: number
    newIncoming: number
  }
  calls: {
    incomingCalls: number
    missedCalls: number
  }
  sales: {
    totalOrdersCount: number
    totalRevenue: number
    breakdownText: string
  }
  manualInputs: {
    totalLeads?: number
    missedCalls?: number
  }
  formattedReportText: string
}

export class DashboardService {
  /**
   * Сбор полной статистики и генерация отчёта за день
   */
  async getDashboardStats(
    dateString: string,
    manualInputs?: { missedCalls?: number; totalLeads?: number }
  ): Promise<DailyReportData> {
    const targetDate = new Date(dateString)

    // Форматируем дату для заголовка отчета "31.07"
    const dayStr = String(targetDate.getDate()).padStart(2, '0')
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0')
    const dateLabel = `${dayStr}.${monthStr}`

    // Запрашиваем аналитику amoCRM и продаж параллельно
    const [msgStats, callStats, salesStats] = await Promise.all([
      messagesAnalytics.calculateForDate(dateString),
      callsAnalytics.calculateForDate(dateString),
      salesAnalytics.calculateForDate(dateString),
    ])

    // Поле "Не дозвонились" берем либо из ручного ввода менеджера, либо из статистики звонков
    const missedCalls = manualInputs?.missedCalls !== undefined
      ? manualInputs.missedCalls
      : callStats.missedCalls

    // Поле "Всего лидов" берем либо из ручного ввода, либо рассчитываем как (Новые сообщения + Входящие звонки)
    const calculatedTotalLeads = msgStats.newMessages + callStats.incomingCalls
    const totalLeads = manualInputs?.totalLeads !== undefined
      ? manualInputs.totalLeads
      : (calculatedTotalLeads > 0 ? calculatedTotalLeads : msgStats.newMessages)

    // Форматируем сумму продаж (например: 245.000)
    const formattedTotalRevenue = salesStats.totalRevenue.toLocaleString('ru-RU').replace(/\s/g, '.')

    // Генерируем красивый текст отчета для мгновенного копирования
    const formattedReportText = `ОТЧЕТ ПО ПРОДАЖАМ СТОЛОВ  
Дата: ${dateLabel}

- Всего лидов: ${totalLeads}
- Сообщения: ${msgStats.newMessages}
- Повторные сообщения: ${msgStats.repeatMessages}
- Входящие звонки: ${callStats.incomingCalls}
- Не дозвонились: ${missedCalls}


ПРОДАЖИ
- Количество заказов: ${salesStats.totalOrdersCount}
- Сумма заказов: ${salesStats.breakdownText}
Итого: ${formattedTotalRevenue}₽`

    return {
      dateStr: dateString,
      dateLabel,
      messages: {
        newMessages: msgStats.newMessages,
        repeatMessages: msgStats.repeatMessages,
        newIncoming: msgStats.newIncoming,
      },
      calls: {
        incomingCalls: callStats.incomingCalls,
        missedCalls,
      },
      sales: {
        totalOrdersCount: salesStats.totalOrdersCount,
        totalRevenue: salesStats.totalRevenue,
        breakdownText: salesStats.breakdownText,
      },
      manualInputs: {
        totalLeads,
        missedCalls,
      },
      formattedReportText,
    }
  }
}

export const dashboardService = new DashboardService()
