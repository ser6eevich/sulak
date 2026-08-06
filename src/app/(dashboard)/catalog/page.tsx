import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import CatalogManagement from './CatalogManagement'
import type { CatalogAttributes } from './CatalogManagement'
import { Grid3X3, Layers3, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; folder?: string | string[] }>
}) {
  const query = await searchParams
  const initialCategorySlug = typeof query.category === 'string' ? query.category : undefined
  const initialFolderId = typeof query.folder === 'string' ? query.folder : null
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
  const safeProducts = products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      attributes:
        variant.attributes && typeof variant.attributes === 'object' && !Array.isArray(variant.attributes)
          ? (variant.attributes as CatalogAttributes)
          : null,
    })),
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          Каталог моделей
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Управление категориями товаров, номенклатурными папками и вариантами выгрузки
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Моделей товаров</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalProducts}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Package className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Модификаций (SKU)</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalVariants}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Layers3 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Категорий</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalCategories}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Grid3X3 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>
      </div>

      <CatalogManagement
        categories={categories}
        initialProducts={safeProducts}
        initialFolders={folders}
        initialCategorySlug={initialCategorySlug}
        initialFolderId={initialFolderId}
        userRole={profile?.role || ''}
      />
    </div>
  )
}
