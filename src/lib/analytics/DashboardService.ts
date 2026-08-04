import { amoEventsEngine } from './AmoEventsEngine'
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
   * Сбор полной статистики и генерация отчёта за день на основе движка событий
   */
  async getDashboardStats(
    dateString: string,
    manualInputs?: { missedCalls?: number; totalLeads?: number }
  ): Promise<DailyReportData> {
    const parts = dateString.split('-').map(Number)
    const dayStr = String(parts[2] || 1).padStart(2, '0')
    const monthStr = String(parts[1] || 1).padStart(2, '0')
    const dateLabel = `${dayStr}.${monthStr}`

    // Запрашиваем аналитику amoCRM из нового прозрачного движка событий и продажи из CRM
    const [amoStats, salesStats] = await Promise.all([
      amoEventsEngine.calculateForDate(dateString),
      salesAnalytics.calculateForDate(dateString),
    ])

    // Поле "Не дозвонились" берем из ручного ввода либо по умолчанию 0
    const missedCalls = manualInputs?.missedCalls !== undefined
      ? manualInputs.missedCalls
      : 0

    // "Всего лидов" = Новые сообщения + Входящие звонки
    const calculatedTotalLeads = amoStats.totalLeads
    const totalLeads = manualInputs?.totalLeads !== undefined
      ? manualInputs.totalLeads
      : calculatedTotalLeads

    // Форматируем сумму продаж (например: 245.000)
    const formattedTotalRevenue = salesStats.totalRevenue.toLocaleString('ru-RU').replace(/\s/g, '.')

    // Форматируем текст отчета для копирования в мессенджеры
    const formattedReportText = `ОТЧЕТ ПО ПРОДАЖАМ СТОЛОВ  
Дата: ${dateLabel}

- Всего лидов: ${totalLeads}
- Сообщения: ${amoStats.newMessages}
- Повторные сообщения: ${amoStats.repeatMessages}
- Входящие звонки: ${amoStats.incomingCalls}
- Не дозвонились: ${missedCalls}


ПРОДАЖИ
- Количество заказов: ${salesStats.totalOrdersCount}
- Сумма заказов: ${salesStats.breakdownText}
Итого: ${formattedTotalRevenue}₽`

    return {
      dateStr: dateString,
      dateLabel,
      messages: {
        newMessages: amoStats.newMessages,
        repeatMessages: amoStats.repeatMessages,
        newIncoming: amoStats.newMessages,
      },
      calls: {
        incomingCalls: amoStats.incomingCalls,
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
