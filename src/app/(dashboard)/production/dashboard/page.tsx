import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProductionDashboardClient from './ProductionDashboardClient'
import { Hammer } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Hammer className="h-6 w-6 text-brand" />
            Товары в производстве
          </h1>
          <p className="text-[11px] font-medium text-slate-400 mt-1.5">
            Информационный монитор текущих изделий, находящихся в процессе изготовления
          </p>
        </div>
      </div>

      <ProductionDashboardClient initialOrders={orders} />
    </div>
  )
}
