import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import CatalogManagement from './CatalogManagement'
import { Package, Grid, Layers } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await prisma.profile.findUnique({ where: { id: user.id } }) : null

  const categories = await prisma.productCategory.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  })

  const folders = await prisma.productFolder.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      archivedAt: null,
    },
    include: {
      category: true,
      variants: {
        where: {
          isActive: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const totalProducts = products.length
  const totalVariants = products.reduce((acc, p) => acc + p.variants.length, 0)
  const totalCategories = categories.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Grid className="h-5 w-5 text-[var(--accent-primary)]" />
          Каталог моделей
        </h1>
        <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
          Управление категориями товаров, номенклатурными папками и вариантами выгрузки
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Моделей товаров</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">{totalProducts}</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <Package className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Модификаций (SKU)</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">{totalVariants}</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <Layers className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Категорий</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">{totalCategories}</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <Grid className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Catalog Management Client */}
      <CatalogManagement categories={categories} initialProducts={products} initialFolders={folders} userRole={profile?.role || ''} />
    </div>
  )
}
