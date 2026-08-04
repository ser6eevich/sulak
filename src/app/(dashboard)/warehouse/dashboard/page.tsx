import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import WarehouseDashboardClient from './WarehouseDashboardClient'
import { Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function WarehouseDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager', 'warehouse'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  const folders = await prisma.productFolder.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      variants: {
        where: { isActive: true },
        orderBy: { sku: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Package className="h-5 w-5 text-[var(--accent-primary)]" />
            Складской учет и остатки
          </h1>
          <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
            Мониторинг фактических запасов готовой продукции и инвентаризация по артикулам
          </p>
        </div>
      </div>

      <WarehouseDashboardClient initialProducts={products} categories={categories} folders={folders} />
    </div>
  )
}
