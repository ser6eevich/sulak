import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProductionDashboardClient from './ProductionDashboardClient'

export const dynamic = 'force-dynamic'

export default async function ProductionDashboard() {
  // 1. Проверка авторизации
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Получение профиля и проверка активности
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive) {
    redirect('/unauthorized')
  }

  // 3. Загружаем заказы в статусе "В производстве"
  const orders = await prisma.order.findMany({
    where: {
      status: 'production',
    },
    include: {
      client: {
        select: {
          fullName: true,
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
      createdAt: 'asc', // по правилу очереди (старые сверху)
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          Цех производства
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Очередь заказов и изделий, которые сейчас находятся в процессе изготовления
        </p>
      </div>

      <ProductionDashboardClient initialOrders={orders} />
    </div>
  )
}
