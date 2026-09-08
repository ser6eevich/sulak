import { withExternalApi } from '@/lib/external-api/auth'
import { getOrdersStats, resolveOrderQuery } from '@/lib/external-api/orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/external/orders/stats
 * Агрегированное количество заказов и выручка за период.
 *
 * Query: from, to, dateField, status, includeCancelled — см. docs/EXTERNAL_ORDERS_API.md
 */
export const GET = withExternalApi(async (_request, url) => {
  const options = resolveOrderQuery(url.searchParams)
  const result = await getOrdersStats(options)
  return Response.json(result)
})
