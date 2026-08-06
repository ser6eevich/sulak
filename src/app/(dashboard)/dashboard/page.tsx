import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // 1. Проверяем сессию пользователя
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Получаем профиль текущего пользователя
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  // Доступ имеют админы, владельцы, либо пользователи с включенным разрешением "dashboard"
  const userPerms = profile && typeof profile.permissions === 'object' && profile.permissions !== null
    ? (profile.permissions as Record<string, boolean>)
    : {}
  const hasAccess = ['admin', 'owner'].includes(profile?.role || '') || userPerms.dashboard === true

  if (!profile || !profile.isActive || !hasAccess) {
    redirect('/unauthorized')
  }

  // Параллельно загружаем все данные
  const [
    ordersStats,
    deliveredRevenueRows,
    latestOrders,
    allOrdersForAnalytics,
    onlineProfiles,
    recentAuditLogs,
  ] = await Promise.all([
    // А. Статистика по статусам
    prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // Б. Выручка — доставленные заказы
    prisma.$queryRaw<{ revenue: bigint }[]>`
      SELECT COALESCE(SUM(total_price - discount + delivery_price + assembly_price), 0)::bigint AS revenue
      FROM orders
      WHERE status = 'delivered'
    `,

    // В. Последние 5 заказов
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        client: true,
        creator: { select: { fullName: true } },
      },
    }),

    // Г. Все заказы для гео-анализа МСК/МО (включая позиции для аналитики моделей)
    prisma.order.findMany({
      select: {
        id: true, number: true, createdAt: true, status: true,
        totalPrice: true, discount: true, deliveryPrice: true, assemblyPrice: true,
        deliveryAddress: true,
        client: { select: { region: true, city: true, address: true } },
        items: {
          select: {
            quantity: true,
            variant: {
              select: {
                sku: true,
                size: true,
                color: true,
                material: true,
                product: {
                  select: {
                    name: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Д. Онлайн-пользователи (активность за последние 2 минуты)
    prisma.$queryRawUnsafe<{ id: string; fullName: string; role: string; lastSeenAt: Date | null }[]>(
      `SELECT id, full_name AS "fullName", role, last_seen_at AS "lastSeenAt" 
       FROM public.profiles 
       WHERE is_active = true AND last_seen_at >= NOW() - INTERVAL '2 minutes' 
       ORDER BY last_seen_at DESC`
    ).catch(() => []),

    // Е. История последних 40 действий из аудит-лога
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        user: { select: { fullName: true, role: true } },
      },
    }),
  ])

  const totalRevenue = Number(deliveredRevenueRows[0]?.revenue ?? 0)

  const stats = {
    revenue: totalRevenue / 100,
    total: ordersStats.reduce((sum, item) => sum + item._count.id, 0),
    delivered: ordersStats.find(item => item.status === 'delivered')?._count.id || 0,
    cancelled: ordersStats.find(item => item.status === 'cancelled')?._count.id || 0,
    active: ordersStats
      .filter(item => !['delivered', 'cancelled'].includes(item.status))
      .reduce((sum, item) => sum + item._count.id, 0),
  }

  return (
    <DashboardClient 
      stats={stats}
      latestOrders={latestOrders}
      allOrders={allOrdersForAnalytics}
      onlineUsers={onlineProfiles}
      auditLogs={recentAuditLogs}
    />
  )
}
