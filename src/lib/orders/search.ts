const PREFIXED_ORDER_NUMBER_QUERY = /^[№#]\s*(\d+)\s*(?:заказ)?$/i
const SHORT_ORDER_NUMBER_QUERY = /^(\d{1,6})\s*(?:заказ)?$/i

/**
 * Распознаёт запрос, в котором указан только номер заказа.
 * Телефоны с «+», скобками или дефисами не попадают в этот режим.
 */
export function parseExactOrderNumberQuery(query: string): string | null {
  const normalizedQuery = query.trim()
  const match = normalizedQuery.match(PREFIXED_ORDER_NUMBER_QUERY)
    ?? normalizedQuery.match(SHORT_ORDER_NUMBER_QUERY)
  return match?.[1] ?? null
}
