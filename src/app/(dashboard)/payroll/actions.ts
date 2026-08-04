'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getRateForOrderCount, getPeriodBoundsForDate, getEffectiveDeliveryBounds } from '@/utils/payroll'

async function checkAdminOrOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  const userPerms = profile && typeof profile.permissions === 'object'
    ? (profile.permissions as Record<string, boolean>)
    : {}
  const hasAccess = ['admin', 'owner'].includes(profile?.role || '') || userPerms.payroll === true

  if (!profile || !profile.isActive || !hasAccess) {
    redirect('/unauthorized')
  }
}

export async function getPayrollDataAction(startDateStr: string, endDateStr: string) {
  try {
    await checkAdminOrOwner()

    const start = new Date(startDateStr)
    const end = new Date(endDateStr)

    // Границы фактического времени доставки (отсечка 30-го числа месяца: 30-е и 31-е числа уходят в след. месяц)
    const { deliveryStart, deliveryEnd } = getEffectiveDeliveryBounds(start, end)

    // Загружаем всех сотрудников с ролью менеджер
    const employees = await prisma.profile.findMany({
      where: {
        role: 'manager',
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
    })

    const payrollReport = []

    for (const emp of employees) {
      // 1. Считаем общее число оформленных логических подзаказов за отчетный период (исключая cancelled) для определения ставки
      const currentPeriodItems = await prisma.orderItem.findMany({
        where: {
          order: {
            sellerId: emp.id,
            createdAt: {
              gte: start,
              lte: end,
            },
            status: { not: 'cancelled' },
          },
        },
        select: {
          orderId: true,
          subOrderIndex: true,
        },
      })

      const uniqueSubOrders = new Set(currentPeriodItems.map(it => `${it.orderId}-${it.subOrderIndex}`))
      const totalOrdersCount = uniqueSubOrders.size
      const currentRate = getRateForOrderCount(totalOrdersCount)

      // Дополнительно: считаем абсолютно все созданные подзаказы (включая cancelled) за отчетный период
      const totalCreatedItems = await prisma.orderItem.findMany({
        where: {
          order: {
            sellerId: emp.id,
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        },
        select: {
          orderId: true,
          subOrderIndex: true,
        },
      })
      const totalCreatedCount = new Set(totalCreatedItems.map(it => `${it.orderId}-${it.subOrderIndex}`)).size

      // Дополнительно: считаем отмененные подзаказы, созданные в отчетном периоде
      const cancelledItems = await prisma.orderItem.findMany({
        where: {
          order: {
            sellerId: emp.id,
            createdAt: {
              gte: start,
              lte: end,
            },
            status: 'cancelled',
          },
        },
        select: {
          orderId: true,
          subOrderIndex: true,
        },
      })
      const cancelledCount = new Set(cancelledItems.map(it => `${it.orderId}-${it.subOrderIndex}`)).size

      // 2. Доставленные подзаказы, которые были созданы в отчетном периоде И доставлены в окно этого периода (до 30-го числа)
      const currentDeliveredItems = await prisma.orderItem.findMany({
        where: {
          order: {
            sellerId: emp.id,
            createdAt: {
              gte: start,
              lte: end,
            },
            status: 'delivered',
            deliveredAt: {
              gte: deliveryStart,
              lt: deliveryEnd,
            },
          },
        },
        include: {
          order: true,
        },
      })

      const currentDeliveredMap = new Map<string, typeof currentDeliveredItems[0]>()
      for (const item of currentDeliveredItems) {
        const key = `${item.orderId}-${item.subOrderIndex}`
        if (!currentDeliveredMap.has(key)) {
          currentDeliveredMap.set(key, item)
        }
      }
      const currentDeliveredCount = currentDeliveredMap.size
      const currentDeliveriesSum = currentDeliveredCount * currentRate

      // 3. Подзаказы из ПРЕДЫДУЩИХ периодов, которые были доставлены в окно этого периода (включая 30-31 прошлого месяца) -> (Надбавка)
      const pastDeliveredItems = await prisma.orderItem.findMany({
        where: {
          order: {
            sellerId: emp.id,
            createdAt: {
              lt: start, // созданы до начала отчетного периода
            },
            status: 'delivered',
            deliveredAt: {
              gte: deliveryStart,
              lt: deliveryEnd, // доставлены в окне этого периода (с 30-го по 30-е)
            },
          },
        },
        include: {
          order: true,
        },
      })

      const pastDeliveredMap = new Map<string, typeof pastDeliveredItems[0][]>()
      for (const item of pastDeliveredItems) {
        const key = `${item.orderId}-${item.subOrderIndex}`
        if (!pastDeliveredMap.has(key)) {
          pastDeliveredMap.set(key, [])
        }
        pastDeliveredMap.get(key)!.push(item)
      }

      // Считаем исторические ставки для прошлых подзаказов
      const pastDeliveredCalculated = []
      let pastDeliveriesSum = 0

      for (const [key, items] of pastDeliveredMap.entries()) {
        const firstItem = items[0]
        // Определяем период создания этого прошлого заказа
        const { startDate: pastStart, endDate: pastEnd } = getPeriodBoundsForDate(new Date(firstItem.order.createdAt))
        
        // Считаем общее количество подзаказов менеджера в том историческом периоде
        const pastPeriodTotalItems = await prisma.orderItem.findMany({
          where: {
            order: {
              sellerId: emp.id,
              createdAt: {
                gte: pastStart,
                lte: pastEnd,
              },
              status: { not: 'cancelled' },
            },
          },
          select: {
            orderId: true,
            subOrderIndex: true,
          },
        })

        const pastPeriodTotalOrders = new Set(pastPeriodTotalItems.map(it => `${it.orderId}-${it.subOrderIndex}`)).size
        const historicalRate = getRateForOrderCount(pastPeriodTotalOrders)
        pastDeliveriesSum += historicalRate

        pastDeliveredCalculated.push({
          id: key,
          number: firstItem.order.number,
          createdAt: firstItem.order.createdAt,
          deliveredAt: firstItem.order.deliveredAt!,
          historicalRate,
          pastPeriodTotalOrders,
        })
      }

      // 4. Отзывы и бонусы по уникальным заказам, доставленным в отсечке этого периода
      const allDeliveredInPeriod = await prisma.order.findMany({
        where: {
          sellerId: emp.id,
          status: 'delivered',
          deliveredAt: {
            gte: deliveryStart,
            lt: deliveryEnd,
          },
        },
      })

      let feedbackBonusSum = 0
      const feedbacks = []

      for (const order of allDeliveredInPeriod) {
        if (order.feedbackType && order.feedbackType !== 'none') {
          const bonus = order.feedbackType === 'with_photo' ? 500 : 300
          feedbackBonusSum += bonus
          feedbacks.push({
            id: order.id,
            number: order.number,
            feedbackType: order.feedbackType,
            feedbackAuthor: order.feedbackAuthor,
            feedbackUrl: order.feedbackUrl,
            bonus,
          })
        }
      }

      const totalPayout = currentDeliveriesSum + pastDeliveriesSum + feedbackBonusSum

      payrollReport.push({
        manager: {
          id: emp.id,
          fullName: emp.fullName,
          email: emp.email,
        },
        metrics: {
          totalOrdersCount,
          currentRate,
          currentDeliveredCount,
          currentDeliveriesSum,
          pastDeliveredCount: pastDeliveredMap.size,
          pastDeliveriesSum,
          feedbackBonusCount: feedbacks.length,
          feedbackBonusSum,
          totalPayout,
          totalCreatedCount,
          cancelledCount,
        },
        details: {
          currentDelivered: Array.from(currentDeliveredMap.values()).map(item => ({
            id: `${item.orderId}-${item.subOrderIndex}`,
            number: item.order.number,
            createdAt: item.order.createdAt,
            deliveredAt: item.order.deliveredAt!,
          })),
          pastDelivered: pastDeliveredCalculated,
          feedbacks,
        },
      })
    }

    return { success: true, report: payrollReport }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
