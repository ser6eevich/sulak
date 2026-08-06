import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LogisticianDashboardClient from './LogisticianDashboardClient'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          Логистика
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Заказы в пути, назначения водителей и управление доставкой
        </p>
      </div>

      <LogisticianDashboardClient orders={orders} drivers={drivers} />
    </div>
  )
}
