import prisma from '@/lib/prisma'

export interface ManagerSales {
  managerName: string
  ordersCount: number
  totalRevenue: number // в рублях
}

export interface DailySalesStats {
  totalOrdersCount: number
  totalRevenue: number // в рублях
  managers: ManagerSales[]
  breakdownText: string // Например: "Зоя 4 - 193.000₽ / Софа 2 - 52.000₽"
}

export class SalesAnalytics {
  /**
   * Сбор продаж за день из базы данных Сулак CRM
   */
  async calculateForDate(dateString: string): Promise<DailySalesStats> {
    const parts = dateString.split('-').map(Number)
    const year = parts[0] || new Date().getFullYear()
    const month = (parts[1] || 1) - 1
    const day = parts[2] || new Date().getDate()

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0)
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

    // Запрашиваем заказы, созданные в этот день и не отмененные, включая подзаказы (items.subOrderIndex)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'cancelled',
        },
      },
      include: {
        seller: {
          select: {
            fullName: true,
          },
        },
        items: {
          select: {
            subOrderIndex: true,
          },
        },
      },
    })

    if (!orders || orders.length === 0) {
      return {
        totalOrdersCount: 0,
        totalRevenue: 0,
        managers: [],
        breakdownText: 'Нет заказов за выбр. дату',
      }
    }

    // Группировка продаж по менеджерам
    const managerMap = new Map<string, { count: number; sum: number }>()

    let grandTotalCents = 0
    let grandTotalSubOrders = 0

    for (const order of orders) {
      // Считаем количество подзаказов (комплектов/позиций) внутри одного заказа по уник. subOrderIndex
      const uniqueSubOrderIndices = new Set(
        (order.items || []).map((it) => it.subOrderIndex ?? 0)
      )
      const subOrderCount = Math.max(1, uniqueSubOrderIndices.size)
      grandTotalSubOrders += subOrderCount

      // Для отчёта менеджеров считаем стоимость товара (сумма позиций минус скидка), не включая доставку
      const orderTotalCents = Math.max(0, order.totalPrice - order.discount)
      grandTotalCents += orderTotalCents

      const managerName = order.seller?.fullName
        ? order.seller.fullName.split(' ')[0]
        : 'Не указан'

      if (!managerMap.has(managerName)) {
        managerMap.set(managerName, { count: 0, sum: 0 })
      }

      const entry = managerMap.get(managerName)!
      entry.count += subOrderCount
      entry.sum += orderTotalCents
    }

    const managersList: ManagerSales[] = []
    const breakdownParts: string[] = []

    for (const [name, data] of managerMap.entries()) {
      const sumRubles = Math.round(data.sum / 100)
      managersList.push({
        managerName: name,
        ordersCount: data.count,
        totalRevenue: sumRubles,
      })

      // Форматируем сумму с разделением тысяч точками (например: 193.000₽)
      const formattedSum = sumRubles.toLocaleString('ru-RU').replace(/\s/g, '.')
      breakdownParts.push(`${name} ${data.count} - ${formattedSum}₽`)
    }

    const totalRevenueRubles = Math.round(grandTotalCents / 100)
    const breakdownText = breakdownParts.join(' / ')

    return {
      totalOrdersCount: grandTotalSubOrders,
      totalRevenue: totalRevenueRubles,
      managers: managersList,
      breakdownText,
    }
  }
}

export const salesAnalytics = new SalesAnalytics()
