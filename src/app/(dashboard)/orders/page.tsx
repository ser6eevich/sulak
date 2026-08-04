import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import OrderManagement from './OrderManagement'
import { ShoppingCart } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive) {
    redirect('/unauthorized')
  }

  const orders = await prisma.order.findMany({
    orderBy: [
      { createdAt: 'desc' }
    ],
    include: {
      client: true,
      creator: {
        select: {
          id: true,
          fullName: true,
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  })

  const products = await prisma.product.findMany({
    where: { archivedAt: null, isActive: true },
    include: {
      variants: {
        where: { isActive: true },
      },
    },
  })

  const drivers = await prisma.profile.findMany({
    where: { role: 'driver', isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  const sellers = await prisma.profile.findMany({
    where: {
      role: 'manager',
      isActive: true,
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  const folders = await prisma.productFolder.findMany({
    where: { isActive: true },
  })

  const categories = await prisma.productCategory.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[var(--accent-primary)]" />
            Реестр заказов
          </h1>
          <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
            Оформление новых заказов, отслеживание этапов производства, складской логистики и отгрузки
          </p>
        </div>
      </div>

      <OrderManagement 
        initialOrders={orders} 
        products={products}
        folders={folders}
        categories={categories}
        userRole={profile.role}
        drivers={drivers}
        sellers={sellers}
        currentUserId={user.id}
      />
    </div>
  )
}
