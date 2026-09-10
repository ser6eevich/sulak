import { NextRequest, NextResponse } from 'next/server'
import {
  retryPendingTelegramOrderNotifications,
  sendOrderTelegramNotification,
} from '@/utils/telegram'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  return bearerToken === cronSecret || request.headers.get('x-cron-secret')?.trim() === cronSecret
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const orderId = request.nextUrl.searchParams.get('orderId')?.trim()
  const notificationType = request.nextUrl.searchParams.get('type') === 'updated' ? 'updated' : 'new_order'
  try {
    if (orderId) {
      const delivered = await sendOrderTelegramNotification(orderId, notificationType)
      return NextResponse.json({ success: delivered, orderId })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...(await retryPendingTelegramOrderNotifications()),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
