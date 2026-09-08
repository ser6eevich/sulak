import { withExternalApi } from '@/lib/external-api/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/external/ping
 * Проверка доступности внешнего API и корректности токена.
 */
export const GET = withExternalApi(async () => {
  return Response.json({
    ok: true,
    service: 'sulak-crm',
    scope: 'external-orders-api',
    time: new Date().toISOString(),
  })
})
