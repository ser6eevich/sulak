import 'server-only'

import type { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'

import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUSES,
  enumerateMoscowDays,
  moscowDayKey,
  resolveDateField,
  resolveIncludeCancelled,
  resolveRange,
  resolveStatuses,
  type OrderDateField,
  type OrderStatus,
  type ResolvedRange,
} from './params'

export interface QueryOptions {
  range: ResolvedRange
  dateField: OrderDateField
  statuses: OrderStatus[]
  includeCancelled: boolean
}

/** Единый разбор общих для всех эндпоинтов параметров фильтрации. */
export function resolveOrderQuery(searchParams: URLSearchParams): QueryOptions {
  return {
    range: resolveRange(searchParams),
    dateField: resolveDateField(searchParams),
    statuses: resolveStatuses(searchParams),
    includeCancelled: resolveIncludeCancelled(searchParams),
  }
}

interface AmountRow {
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
}

/** Итоговая сумма заказа в копейках: позиции − скидка + доставка + сборка. */
function orderTotalKopecks(row: AmountRow): number {
  return row.totalPrice - row.discount + row.deliveryPrice + row.assemblyPrice
}

function toRub(kopecks: number): number {
  return Math.round(kopecks / 100)
}

function buildWhere({ range, dateField, statuses, includeCancelled }: QueryOptions): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    [dateField]: { gte: range.from, lt: range.to },
  }

  if (statuses.length > 0) {
    where.status = { in: statuses }
  } else if (!includeCancelled) {
    where.status = { not: 'cancelled' }
  }

  return where
}

function emptyStatusMap(): Record<string, number> {
  return Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]))
}

function emptyPaymentMap(): Record<string, number> {
  return Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0]))
}

function rangeMeta(options: QueryOptions) {
  return {
    from: options.range.from.toISOString(),
    to: options.range.to.toISOString(),
    dateField: options.dateField,
    statuses: options.statuses.length > 0 ? options.statuses : null,
    includeCancelled: options.includeCancelled,
  }
}

// ── Агрегированная статистика ───────────────────────────────────────────────

export interface OrdersStatsResult {
  ok: true
  range: ReturnType<typeof rangeMeta>
  orders: {
    total: number
    byStatus: Record<string, number>
    byStatusLabels: Record<string, string>
    byPaymentStatus: Record<string, number>
  }
  revenue: {
    currency: 'RUB'
    itemsTotal: number
    discount: number
    delivery: number
    assembly: number
    grandTotal: number
    kopecks: {
      itemsTotal: number
      discount: number
      delivery: number
      assembly: number
      grandTotal: number
    }
  }
  generatedAt: string
}

export async function getOrdersStats(options: QueryOptions): Promise<OrdersStatsResult> {
  const where = buildWhere(options)

  const [byStatusRows, byPaymentRows] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: {
        totalPrice: true,
        discount: true,
        deliveryPrice: true,
        assemblyPrice: true,
      },
    }),
    prisma.order.groupBy({
      by: ['paymentStatus'],
      where,
      _count: { _all: true },
    }),
  ])

  const byStatus = emptyStatusMap()
  const byPaymentStatus = emptyPaymentMap()

  let total = 0
  const sum = { itemsTotal: 0, discount: 0, delivery: 0, assembly: 0 }

  for (const row of byStatusRows) {
    const count = row._count._all
    total += count
    byStatus[row.status] = (byStatus[row.status] ?? 0) + count

    sum.itemsTotal += row._sum.totalPrice ?? 0
    sum.discount += row._sum.discount ?? 0
    sum.delivery += row._sum.deliveryPrice ?? 0
    sum.assembly += row._sum.assemblyPrice ?? 0
  }

  for (const row of byPaymentRows) {
    byPaymentStatus[row.paymentStatus] = (byPaymentStatus[row.paymentStatus] ?? 0) + row._count._all
  }

  const grandTotalKopecks = sum.itemsTotal - sum.discount + sum.delivery + sum.assembly

  return {
    ok: true,
    range: rangeMeta(options),
    orders: {
      total,
      byStatus,
      byStatusLabels: ORDER_STATUS_LABELS,
      byPaymentStatus,
    },
    revenue: {
      currency: 'RUB',
      itemsTotal: toRub(sum.itemsTotal),
      discount: toRub(sum.discount),
      delivery: toRub(sum.delivery),
      assembly: toRub(sum.assembly),
      grandTotal: toRub(grandTotalKopecks),
      kopecks: {
        itemsTotal: sum.itemsTotal,
        discount: sum.discount,
        delivery: sum.delivery,
        assembly: sum.assembly,
        grandTotal: grandTotalKopecks,
      },
    },
    generatedAt: new Date().toISOString(),
  }
}

// ── Ряд по дням ─────────────────────────────────────────────────────────────

export interface OrdersDailyResult {
  ok: true
  range: ReturnType<typeof rangeMeta>
  timezone: string
  totals: { orders: number; revenue: number; revenueKopecks: number }
  days: Array<{ date: string; orders: number; revenue: number; revenueKopecks: number }>
  generatedAt: string
}

export async function getOrdersDaily(options: QueryOptions): Promise<OrdersDailyResult> {
  const where = buildWhere(options)
  const { dateField } = options

  const rows = await prisma.order.findMany({
    where,
    select: {
      createdAt: true,
      updatedAt: true,
      shippedAt: true,
      deliveredAt: true,
      plannedDeliveryDate: true,
      totalPrice: true,
      discount: true,
      deliveryPrice: true,
      assemblyPrice: true,
    },
  })

  const buckets = new Map<string, { orders: number; revenueKopecks: number }>()
  for (const day of enumerateMoscowDays(options.range)) {
    buckets.set(day, { orders: 0, revenueKopecks: 0 })
  }

  let totalOrders = 0
  let totalKopecks = 0

  for (const row of rows) {
    const value = row[dateField]
    if (!value) continue

    const key = moscowDayKey(value)
    const bucket = buckets.get(key) ?? { orders: 0, revenueKopecks: 0 }
    const kopecks = orderTotalKopecks(row)

    bucket.orders += 1
    bucket.revenueKopecks += kopecks
    buckets.set(key, bucket)

    totalOrders += 1
    totalKopecks += kopecks
  }

  const days = Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, value]) => ({
      date,
      orders: value.orders,
      revenue: toRub(value.revenueKopecks),
      revenueKopecks: value.revenueKopecks,
    }))

  return {
    ok: true,
    range: rangeMeta(options),
    timezone: 'Europe/Moscow',
    totals: {
      orders: totalOrders,
      revenue: toRub(totalKopecks),
      revenueKopecks: totalKopecks,
    },
    days,
    generatedAt: new Date().toISOString(),
  }
}

// ── Список заказов ──────────────────────────────────────────────────────────

export interface OrdersListItem {
  id: string
  number: string
  status: string
  paymentStatus: string
  itemsCount: number
  amountRub: number
  amountKopecks: number
  createdAt: string
  updatedAt: string
  shippedAt: string | null
  deliveredAt: string | null
  plannedDeliveryDate: string | null
}

export interface OrdersListResult {
  ok: true
  range: ReturnType<typeof rangeMeta>
  pagination: {
    limit: number
    offset: number
    order: 'asc' | 'desc'
    total: number
    returned: number
    hasMore: boolean
  }
  items: OrdersListItem[]
  generatedAt: string
}

export async function getOrdersList(
  options: QueryOptions & { limit: number; offset: number; order: 'asc' | 'desc' },
): Promise<OrdersListResult> {
  const where = buildWhere(options)
  const { limit, offset, order, dateField } = options

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { [dateField]: order },
      skip: offset,
      take: limit,
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        totalPrice: true,
        discount: true,
        deliveryPrice: true,
        assemblyPrice: true,
        createdAt: true,
        updatedAt: true,
        shippedAt: true,
        deliveredAt: true,
        plannedDeliveryDate: true,
        _count: { select: { items: true } },
      },
    }),
  ])

  const items: OrdersListItem[] = rows.map((row) => {
    const amountKopecks = orderTotalKopecks(row)
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      paymentStatus: row.paymentStatus,
      itemsCount: row._count.items,
      amountRub: toRub(amountKopecks),
      amountKopecks,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      shippedAt: row.shippedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      plannedDeliveryDate: row.plannedDeliveryDate?.toISOString() ?? null,
    }
  })

  return {
    ok: true,
    range: rangeMeta(options),
    pagination: {
      limit,
      offset,
      order,
      total,
      returned: items.length,
      hasMore: offset + items.length < total,
    },
    items,
    generatedAt: new Date().toISOString(),
  }
}
