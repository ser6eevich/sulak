import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LogisticianDashboardClient from './LogisticianDashboardClient'
import { Truck } from 'lucide-react'
import { checkAndSendDeliveryAlerts } from './actions'

export const dynamic = 'force-dynamic'

export default async function LogisticianDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager', 'logistician'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  checkAndSendDeliveryAlerts().catch(err => {
    console.error('Ошибка фоновой проверки просроченных доставок:', err)
  })

  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ['awaiting_delivery', 'delivery']
      }
    },
    include: {
      client: {
        select: {
          fullName: true,
          primaryPhone: true,
          additionalPhone: true,
        },
      },
      driver: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const drivers = await prisma.profile.findMany({
    where: {
      role: 'driver',
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      direction: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="h-5 w-5 text-[var(--accent-primary)]" />
            Управление логистикой и рейсами
          </h1>
          <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
            Контроль статусов заказов в пути, назначение экипажей водителей и отслеживание сроков доставки
          </p>
        </div>
      </div>

      <LogisticianDashboardClient orders={orders} drivers={drivers} />
    </div>
  )
}
