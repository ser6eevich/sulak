import 'server-only'

/**
 * Общие константы и разбор query-параметров для внешнего API заказов
 * (`/api/external/orders/*`). Используется Авито-сервисом для сбора статистики.
 */

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'production',
  'production_completed',
  'warehouse',
  'delivery',
  'delivered',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждён',
  production: 'В производстве',
  production_completed: 'Готов на производстве',
  warehouse: 'На складе',
  delivery: 'Доставляется',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid'] as const

export const ORDER_DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'shippedAt',
  'deliveredAt',
  'plannedDeliveryDate',
] as const

export type OrderDateField = (typeof ORDER_DATE_FIELDS)[number]

export const MOSCOW_TIMEZONE = 'Europe/Moscow'
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 400
const DEFAULT_RANGE_DAYS = 30

/** Ошибка валидации входных параметров — превращается в HTTP 400. */
export class ApiParamError extends Error {}

export interface ResolvedRange {
  /** Нижняя граница включительно (UTC). */
  from: Date
  /** Верхняя граница НЕ включительно (UTC). */
  to: Date
}

/**
 * Разбирает одну дату. Поддерживает:
 *  - `YYYY-MM-DD` — трактуется как полночь по Москве (UTC+3, без перехода на летнее время);
 *  - полную ISO-строку (`2026-09-01T12:00:00Z` и т.п.).
 *
 * @param isUpperBound если true и передан `YYYY-MM-DD`, возвращает начало СЛЕДУЮЩИХ
 *        суток по Москве, чтобы весь указанный день попадал в диапазон.
 */
export function parseDateParam(value: string, isUpperBound = false): Date {
  const trimmed = value.trim()
  if (!trimmed) throw new ApiParamError('Пустое значение даты')

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const base = new Date(`${trimmed}T00:00:00.000+03:00`)
    if (Number.isNaN(base.getTime())) {
      throw new ApiParamError(`Некорректная дата: "${value}"`)
    }
    return isUpperBound ? new Date(base.getTime() + DAY_MS) : base
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiParamError(
      `Некорректная дата: "${value}". Используйте YYYY-MM-DD или ISO-8601.`,
    )
  }
  return parsed
}

/** Диапазон дат из `from` / `to`. По умолчанию — последние 30 суток до текущего момента. */
export function resolveRange(searchParams: URLSearchParams, now: Date = new Date()): ResolvedRange {
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')

  const to = toRaw ? parseDateParam(toRaw, true) : now
  const from = fromRaw
    ? parseDateParam(fromRaw, false)
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS)

  if (from.getTime() >= to.getTime()) {
    throw new ApiParamError('Параметр "from" должен быть раньше "to"')
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new ApiParamError(`Максимальный диапазон — ${MAX_RANGE_DAYS} суток`)
  }

  return { from, to }
}

/** Поле даты, по которому фильтруется и группируется выборка. По умолчанию `createdAt`. */
export function resolveDateField(searchParams: URLSearchParams): OrderDateField {
  const raw = (searchParams.get('dateField') ?? 'createdAt').trim()
  if (!(ORDER_DATE_FIELDS as readonly string[]).includes(raw)) {
    throw new ApiParamError(
      `Недопустимое поле dateField: "${raw}". Разрешены: ${ORDER_DATE_FIELDS.join(', ')}`,
    )
  }
  return raw as OrderDateField
}

/**
 * Список статусов из параметра `status` (CSV). Пустой результат означает
 * «без явного фильтра по статусу».
 */
export function resolveStatuses(searchParams: URLSearchParams): OrderStatus[] {
  const raw = searchParams.get('status')
  if (!raw) return []

  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const invalid = parts.filter((p) => !(ORDER_STATUSES as readonly string[]).includes(p))
  if (invalid.length > 0) {
    throw new ApiParamError(
      `Неизвестные статусы: ${invalid.join(', ')}. Разрешены: ${ORDER_STATUSES.join(', ')}`,
    )
  }
  return parts as OrderStatus[]
}

/** Флаг `includeCancelled` (по умолчанию отменённые заказы исключаются). */
export function resolveIncludeCancelled(searchParams: URLSearchParams): boolean {
  return searchParams.get('includeCancelled') === 'true'
}

/** Числовой параметр с валидацией диапазона. */
export function resolveIntParam(
  searchParams: URLSearchParams,
  key: string,
  { def, min, max }: { def: number; min: number; max: number },
): number {
  const raw = searchParams.get(key)
  if (raw === null || raw.trim() === '') return def

  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) {
    throw new ApiParamError(`Параметр "${key}" должен быть целым числом`)
  }
  if (parsed < min || parsed > max) {
    throw new ApiParamError(`Параметр "${key}" должен быть в диапазоне ${min}–${max}`)
  }
  return parsed
}

/** Направление сортировки `order=asc|desc` (по умолчанию `desc`). */
export function resolveSortOrder(searchParams: URLSearchParams): 'asc' | 'desc' {
  const raw = (searchParams.get('order') ?? 'desc').trim().toLowerCase()
  if (raw !== 'asc' && raw !== 'desc') {
    throw new ApiParamError('Параметр "order" должен быть "asc" или "desc"')
  }
  return raw
}

const moscowDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MOSCOW_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Дата в формате `YYYY-MM-DD` по московскому времени. */
export function moscowDayKey(date: Date): string {
  return moscowDayFormatter.format(date)
}

/** Все календарные дни (по Москве) диапазона, включая пустые. */
export function enumerateMoscowDays(range: ResolvedRange): string[] {
  const endKey = moscowDayKey(new Date(range.to.getTime() - 1))
  const days: string[] = []
  let cursor = range.from

  for (let guard = 0; guard <= MAX_RANGE_DAYS + 1; guard += 1) {
    const key = moscowDayKey(cursor)
    days.push(key)
    if (key === endKey) break
    cursor = new Date(cursor.getTime() + DAY_MS)
  }
  return days
}
