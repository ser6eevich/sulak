import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import OrderManagement from './OrderManagement'
import type { Prisma } from '@prisma/client'
import { requireAccess } from '@/lib/auth/dal'
import { parseExactOrderNumberQuery } from '@/lib/orders/search'

export const dynamic = 'force-dynamic'

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive) {
    redirect('/unauthorized')
  }

  await requireAccess('orders', ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'])

  const params = await searchParams
  const query = (typeof params.q === 'string' ? params.q : '').trim().slice(0, 100)
  const exactOrderNumber = parseExactOrderNumberQuery(query)
  const requestedStatus = typeof params.status === 'string' ? params.status : 'all'
  const allowedStatuses = ['pending', 'confirmed', 'production', 'warehouse', 'awaiting_delivery', 'delivery', 'delivered', 'cancelled']
  const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'all'
  const requestedPageSize = Number(typeof params.pageSize === 'string' ? params.pageSize : 20)
  const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 20
  const requestedPage = Math.max(1, Number(typeof params.page === 'string' ? params.page : 1) || 1)

  const where: Prisma.OrderWhereInput = {
    ...(status !== 'all' ? { status } : {}),
    ...(query
      ? exactOrderNumber
        ? { number: exactOrderNumber }
        : {
            OR: [
              { client: { fullName: { contains: query, mode: 'insensitive' } } },
              { client: { primaryPhone: { contains: query } } },
              { client: { additionalPhone: { contains: query } } },
            ],
          }
      : {}),
  }

  const totalOrders = await prisma.order.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize))
  const page = Math.min(requestedPage, totalPages)

  const orders = await prisma.order.findMany({
    orderBy: [
      { createdAt: 'desc' }
    ],
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      client: true,
      creator: {
        select: {
          id: true,
          fullName: true,
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  })

  const products = await prisma.product.findMany({
    where: { archivedAt: null, isActive: true },
    include: {
      variants: {
        where: { isActive: true },
      },
    },
  })

  const drivers = await prisma.profile.findMany({
    where: { role: 'driver', isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  const sellers = await prisma.profile.findMany({
    where: {
      role: 'manager',
      isActive: true,
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  const folders = await prisma.productFolder.findMany({
    where: { isActive: true },
  })

  const categories = await prisma.productCategory.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  const [statusCounts, revenueRows] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.$queryRaw<{ revenue: bigint }[]>`
      SELECT COALESCE(SUM(total_price - discount + delivery_price + assembly_price), 0)::bigint AS revenue
      FROM orders
      WHERE status <> 'cancelled'
    `,
  ])
  const counts = Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count.id]))
  const summary = {
    active: statusCounts
      .filter((entry) => !['delivered', 'cancelled'].includes(entry.status))
      .reduce((sum, entry) => sum + entry._count.id, 0),
    delivered: counts.delivered || 0,
    revenue: Number(revenueRows[0]?.revenue ?? 0) / 100,
    statuses: counts,
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          Реестр заказов
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Оформление новых заказов, отслеживание этапов производства, складской логистики и отгрузки
        </p>
      </div>

      <OrderManagement 
        initialOrders={orders} 
        products={products}
        folders={folders}
        categories={categories}
        userRole={profile.role}
        drivers={drivers}
        sellers={sellers}
        currentUserId={user.id}
        initialQuery={query}
        initialStatus={status}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalOrders={totalOrders}
        summary={summary}
      />
    </div>
  )
}
