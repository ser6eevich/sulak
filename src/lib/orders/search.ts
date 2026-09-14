const PREFIXED_ORDER_NUMBER_QUERY = /^[№#]\s*(\d+)\s*(?:заказ)?$/i
const SHORT_ORDER_NUMBER_QUERY = /^(\d{1,6})\s*(?:заказ)?$/i

/**
 * Распознаёт запрос, в котором указан только номер заказа.
 * Телефоны с «+», скобками или дефисами не попадают в этот режим.
 */
export function parseExactOrderNumberQuery(query: string): string | null {
  const normalizedQuery = query.trim()
  // Четырёхзначные и более длинные комбинации с восьмёрки — это обычно
  // начало телефона (например, 8900), а не номер заказа.
  if (/^8\d{3,}$/.test(normalizedQuery)) return null

  const match = normalizedQuery.match(PREFIXED_ORDER_NUMBER_QUERY)
    ?? normalizedQuery.match(SHORT_ORDER_NUMBER_QUERY)
  return match?.[1] ?? null
}

/** Приводит начало российского номера к формату, в котором он хранится в CRM (+7...). */
export function normalizePhoneSearchQuery(query: string): string | null {
  const digits = query.replace(/\D/g, '')
  if (digits.length < 3) return null
  return digits.startsWith('8') ? `7${digits.slice(1)}` : digits
}
