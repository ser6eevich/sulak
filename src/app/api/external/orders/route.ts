import { withExternalApi } from '@/lib/external-api/auth'
import { getOrdersList, resolveOrderQuery } from '@/lib/external-api/orders'
import { resolveIntParam, resolveSortOrder } from '@/lib/external-api/params'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/external/orders
 * Постраничный список заказов за период (без персональных данных клиента).
 *
 * Query: from, to, dateField, status, includeCancelled, limit, offset, order
 * — см. docs/EXTERNAL_ORDERS_API.md
 */
export const GET = withExternalApi(async (_request, url) => {
  const base = resolveOrderQuery(url.searchParams)
  const limit = resolveIntParam(url.searchParams, 'limit', { def: 50, min: 1, max: 200 })
  const offset = resolveIntParam(url.searchParams, 'offset', { def: 0, min: 0, max: 1_000_000 })
  const order = resolveSortOrder(url.searchParams)

  const result = await getOrdersList({ ...base, limit, offset, order })
  return Response.json(result)
})
