import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import WarehouseDashboardClient from './WarehouseDashboardClient'

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          Складской учёт
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Фактические остатки готовой продукции по моделям и артикулам
        </p>
      </div>

      <WarehouseDashboardClient initialProducts={products} categories={categories} folders={folders} />
    </div>
  )
}
