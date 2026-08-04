import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DriversDashboardClient from './DriversDashboardClient'
import { Truck } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="h-5 w-5 text-[var(--accent-primary)]" />
            Экипажи водителей и рейсы
          </h1>
          <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
            Просмотр рейсов, направлений маршрутов и оперативные отметки о вручении заказов
          </p>
        </div>
      </div>

      <DriversDashboardClient drivers={drivers} userRole={profile.role} />
    </div>
  )
}
