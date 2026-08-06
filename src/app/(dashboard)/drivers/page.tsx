import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DriversDashboardClient from './DriversDashboardClient'

export const dynamic = 'force-dynamic'

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager', 'logistician'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  const rawDrivers = await prisma.profile.findMany({
    where: {
      role: 'driver',
      isActive: true,
    },
    include: {
      driverOrders: {
        include: {
          client: {
            select: {
              fullName: true,
              primaryPhone: true,
              additionalPhone: true,
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
      },
    },
    orderBy: {
      fullName: 'asc',
    },
  })

  const drivers = rawDrivers.map(d => ({
    id: d.id,
    fullName: d.fullName,
    phone: d.phone,
    email: d.email,
    direction: d.direction,
    orders: d.driverOrders,
  }))

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Экипажи водителей
          </h1>
          <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
            Состав экипажей, текущая нагрузка и история доставки заказов
          </p>
        </div>
      </div>

      <DriversDashboardClient drivers={drivers} userRole={profile.role} />
    </div>
  )
}
