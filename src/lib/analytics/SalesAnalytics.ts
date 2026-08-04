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
  breakdownText: string // Например: "Зоя 4 - 193.000₽ / Софа 1 - 52.000₽"
}

export class SalesAnalytics {
  /**
   * Сбор продаж за день из базы данных Сулак CRM
   */
  async calculateForDate(dateString: string): Promise<DailySalesStats> {
    const targetDate = new Date(dateString)

    // Временные границы дня (с 00:00:00 до 23:59:59 MSK)
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)

    // Запрашиваем заказы, созданные в этот день и не отмененные
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

    for (const order of orders) {
      // Для отчёта менеджеров считаем только стоимость товара (сумма позиций минус скидка), не включая доставку
      const orderTotalCents = Math.max(0, order.totalPrice - order.discount)
      grandTotalCents += orderTotalCents

      const managerName = order.seller?.fullName
        ? order.seller.fullName.split(' ')[0] // берём имя (например "Зоя", "Софа")
        : 'Не указан'

      if (!managerMap.has(managerName)) {
        managerMap.set(managerName, { count: 0, sum: 0 })
      }

      const entry = managerMap.get(managerName)!
      entry.count += 1
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
      totalOrdersCount: orders.length,
      totalRevenue: totalRevenueRubles,
      managers: managersList,
      breakdownText,
    }
  }
}

export const salesAnalytics = new SalesAnalytics()
