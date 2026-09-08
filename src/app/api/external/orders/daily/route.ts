import { withExternalApi } from '@/lib/external-api/auth'
import { getOrdersDaily, resolveOrderQuery } from '@/lib/external-api/orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/external/orders/daily
 * Ряд «заказы и выручка по дням» (календарные сутки по Москве), с нулевыми днями.
 *
 * Query: from, to, dateField, status, includeCancelled — см. docs/EXTERNAL_ORDERS_API.md
 */
export const GET = withExternalApi(async (_request, url) => {
  const options = resolveOrderQuery(url.searchParams)
  const result = await getOrdersDaily(options)
  return Response.json(result)
})
