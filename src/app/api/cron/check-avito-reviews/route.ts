import { NextRequest, NextResponse } from 'next/server'
import { checkAndNotifyAvitoReviews } from '@/lib/avito/AvitoReviewsService'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[SECURITY WARNING] CRON_SECRET не настроен. Доступ заблокирован.')
    return false
  }

  const authHeader = request.headers.get('authorization')
  const secretHeader = request.headers.get('x-cron-secret')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '')?.trim()
  const querySecret = request.nextUrl.searchParams.get('secret')?.trim()

  return (
    bearerToken === cronSecret ||
    secretHeader?.trim() === cronSecret ||
    querySecret === cronSecret
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    )
  }

  try {
    const result = await checkAndNotifyAvitoReviews()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
