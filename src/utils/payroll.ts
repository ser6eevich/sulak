// Чистые утилиты для расчета зарплат и отчетных периодов менеджеров

// Сетка ставок
export function getRateForOrderCount(count: number): number {
  if (count < 65) return 850
  if (count < 80) return 1000
  if (count < 100) return 1300
  if (count < 120) return 1700
  return 2000
}

// Границы перехода на новую систему расчёта
const TRANSITION_START = new Date(2026, 6, 15, 0, 0, 0, 0) // 15 июля 2026
const TRANSITION_END   = new Date(2026, 7, 1, 0, 0, 0, 0)  // 1 августа 2026

/**
 * Генерирует список отчётных периодов для выбора в интерфейсе ЗП:
 * 1. Будущие/текущие месячные периоды: с 1-го по 1-е (начиная с 1 августа 2026)
 * 2. Переходный период: 15 июля 2026 — 1 августа 2026
 * 3. Исторические периоды (с 14-го по 14-е): 14 июня — 14 июля, 14 мая — 14 июня и т.д.
 */
export function generatePayrollPeriods(): { label: string; startDate: string; endDate: string }[] {
  const monthNames = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ]

  const periods: { label: string; startDate: string; endDate: string }[] = []
  const now = new Date()

  const makeLabel = (start: Date, end: Date) => {
    return `${start.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()} — ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`
  }

  // 1. Если текущее время уже после 1 августа 2026 — добавляем регулярные месячные периоды (1-е по 1-е)
  if (now >= TRANSITION_END) {
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const cursor = new Date(currentMonthStart)

    while (cursor >= TRANSITION_END) {
      const end = new Date(cursor)
      end.setMonth(end.getMonth() + 1)

      periods.push({
        label: makeLabel(cursor, end),
        startDate: cursor.toISOString(),
        endDate: end.toISOString(),
      })

      cursor.setMonth(cursor.getMonth() - 1)
    }
  }

  // 2. Переходный период (15 июля 2026 — 1 августа 2026)
  periods.push({
    label: makeLabel(TRANSITION_START, TRANSITION_END),
    startDate: TRANSITION_START.toISOString(),
    endDate: TRANSITION_END.toISOString(),
  })

  // 3. Предыдущие исторические периоды (с 14-го по 14-е):
  // 14 июня 2026 — 14 июля 2026
  // 14 мая 2026 — 14 июня 2026
  // 14 апреля 2026 — 14 мая 2026
  // 14 марта 2026 — 14 апреля 2026
  const histCursor = new Date(2026, 5, 14, 0, 0, 0, 0) // 14 июня 2026
  for (let i = 0; i < 4; i++) {
    const start = new Date(histCursor)
    start.setMonth(start.getMonth() - i)

    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setHours(23, 59, 59, 999)

    periods.push({
      label: makeLabel(start, end),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    })
  }

  return periods
}

/**
 * Определяет, к какому расчётному периоду относится дата создания заказа (createdAt).
 * Используется в actions.ts для точного расчёта исторической ставки (historicalRate).
 */
export function getPeriodBoundsForDate(date: Date): { startDate: Date; endDate: Date } {
  const d = new Date(date)

  // 1. Переходный период (15 июля 2026 - 1 августа 2026)
  if (d >= TRANSITION_START && d < TRANSITION_END) {
    return { startDate: TRANSITION_START, endDate: TRANSITION_END }
  }

  // 2. Новые регулярные периоды (с 1 августа 2026) -> с 1-го по 1-е
  if (d >= TRANSITION_END) {
    const startDate = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
    const endDate   = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0)
    return { startDate, endDate }
  }

  // 3. Старые исторические периоды (до 15 июля 2026) -> с 14-го по 14-е
  const day = d.getDate()
  const year = d.getFullYear()
  const month = d.getMonth()

  let startYear = year
  let startMonth = month
  if (day < 14) {
    startMonth = month - 1
    if (startMonth < 0) {
      startMonth = 11
      startYear = year - 1
    }
  }

  const startDate = new Date(startYear, startMonth, 14, 0, 0, 0, 0)

  let endMonth = startMonth + 1
  let endYear = startYear
  if (endMonth > 11) {
    endMonth = 0
    endYear = startYear + 1
  }
  const endDate = new Date(endYear, endMonth, 14, 23, 59, 59, 999)

  return { startDate, endDate }
}

/**
 * Рассчитывает границы времени доставки для отчётного периода.
 * Зарплата рассчитывается примерно 30-го числа каждого месяца, 
 * поэтому заказы, доставленные 30-го или 31-го числа, автоматически переходят 
 * в окно расчёта следующего месяца (как надбавка за прошлые заказы).
 */
export function getEffectiveDeliveryBounds(start: Date, end: Date): { deliveryStart: Date; deliveryEnd: Date } {
  const dStart = new Date(start)
  const dEnd = new Date(end)

  let deliveryStart: Date
  let deliveryEnd: Date

  // Если дата начала периода — 1-е число месяца (например, 1 августа), 
  // то окно доставок начинается с 30-го числа предыдущего месяца (30 июля)
  if (dStart.getDate() === 1) {
    deliveryStart = new Date(dStart.getFullYear(), dStart.getMonth() - 1, 30, 0, 0, 0, 0)
  } else {
    deliveryStart = dStart
  }

  // Если дата окончания периода — 1-е число месяца (например, 1 августа или 1 сентября),
  // то отсечка окончания доставок = 30-е число предыдущего месяца (30 июля для 1 августа, 30 августа для 1 сентября)
  if (dEnd.getDate() === 1) {
    deliveryEnd = new Date(dEnd.getFullYear(), dEnd.getMonth() - 1, 30, 0, 0, 0, 0)
  } else {
    deliveryEnd = dEnd
  }

  return { deliveryStart, deliveryEnd }
}
