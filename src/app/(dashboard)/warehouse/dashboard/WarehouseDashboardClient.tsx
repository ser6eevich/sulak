'use client'

import { useMemo, useState } from 'react'
import { updateStockAction } from './actions'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Folder,
  FolderOpen,
  Layers3,
  Minus,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
} from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
}

interface ProductFolder {
  id: string
  categoryId: string
  parentId: string | null
  name: string
}

interface ProductVariant {
  id: string
  sku: string
  size: string | null
  color: string | null
  material: string | null
  thickness: string | null
  stock: number
  purchasePrice: number
  salePrice: number
}

interface Product {
  id: string
  name: string
  baseSku: string
  categoryId: string
  folderId: string | null
  variants: ProductVariant[]
  category: Category
}

interface WarehouseDashboardClientProps {
  initialProducts: Product[]
  categories: Category[]
  folders: ProductFolder[]
}

function pluralizeRussian(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default function WarehouseDashboardClient({ initialProducts, categories, folders }: WarehouseDashboardClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id || '')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [localStocks, setLocalStocks] = useState<Record<string, string | number>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const activeCategory = categories.find(category => category.id === activeCategoryId)
  const categoryProducts = useMemo(
    () => products.filter(product => product.categoryId === activeCategoryId),
    [activeCategoryId, products]
  )
  const categoryVariants = useMemo(
    () => categoryProducts.flatMap(product => product.variants),
    [categoryProducts]
  )
  const totalStock = categoryVariants.reduce((sum, variant) => sum + variant.stock, 0)
  const emptyVariants = categoryVariants.filter(variant => variant.stock === 0).length
  const categoryFolders = folders.filter(folder => (
    folder.categoryId === activeCategoryId && folder.parentId === activeFolderId
  ))
  const isSearching = search.trim() !== ''

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return categoryProducts.filter(product => {
      if (query) {
        return (
          product.name.toLowerCase().includes(query) ||
          product.baseSku.toLowerCase().includes(query) ||
          product.variants.some(variant => variant.sku.toLowerCase().includes(query))
        )
      }

      return (product.folderId || null) === activeFolderId
    })
  }, [activeFolderId, categoryProducts, search])

  const filteredVariantCount = filteredProducts.reduce((sum, product) => sum + product.variants.length, 0)
  const filteredStockedVariants = filteredProducts.reduce(
    (sum, product) => sum + product.variants.filter(variant => variant.stock > 0).length,
    0
  )

  const getRecursiveFolderProductsCount = (folderId: string): number => {
    const subFolderIds = folders.filter(folder => folder.parentId === folderId).map(folder => folder.id)
    const directProductsCount = products.filter(product => product.folderId === folderId).length
    return directProductsCount + subFolderIds.reduce(
      (sum, subFolderId) => sum + getRecursiveFolderProductsCount(subFolderId),
      0
    )
  }

  const getBreadcrumbs = () => {
    const breadcrumbs: ProductFolder[] = []
    let current = folders.find(folder => folder.id === activeFolderId)

    while (current) {
      breadcrumbs.unshift(current)
      current = current.parentId
        ? folders.find(folder => folder.id === current?.parentId)
        : undefined
    }

    return breadcrumbs
  }

  const getFolderPathName = (folderId: string | null) => {
    if (!folderId) return ''

    const parts: string[] = []
    let current = folders.find(folder => folder.id === folderId)

    while (current) {
      parts.unshift(current.name)
      current = current.parentId
        ? folders.find(folder => folder.id === current?.parentId)
        : undefined
    }

    return parts.join(' / ')
  }

  const getStockValue = (variantId: string, dbStock: number) => (
    localStocks[variantId] !== undefined ? localStocks[variantId] : dbStock
  )

  const handleLocalStockChange = (variantId: string, value: string) => {
    setErrorMessage('')
    setLocalStocks(current => ({
      ...current,
      [variantId]: value === '' ? '' : Number(value),
    }))
  }

  const handleStepStock = (variantId: string, dbStock: number, step: number) => {
    const current = Number(getStockValue(variantId, dbStock)) || 0
    setErrorMessage('')
    setLocalStocks(stocks => ({
      ...stocks,
      [variantId]: Math.max(0, current + step),
    }))
  }

  const handleSaveStock = async (variantId: string, dbStock: number) => {
    const currentValue = getStockValue(variantId, dbStock)
    const quantity = currentValue === '' ? 0 : Number(currentValue)

    setErrorMessage('')
    setLoading(variantId)
    const result = await updateStockAction(variantId, quantity)
    setLoading(null)

    if (result.error) {
      setErrorMessage(result.error)
      return
    }

    setProducts(current => current.map(product => ({
      ...product,
      variants: product.variants.map(variant => (
        variant.id === variantId ? { ...variant, stock: quantity } : variant
      )),
    })))
    setLocalStocks(current => {
      const next = { ...current }
      delete next[variantId]
      return next
    })
    setSuccessId(variantId)
    setTimeout(() => setSuccessId(null), 2000)
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка складских остатков">
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Моделей</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{categoryProducts.length}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">В выбранной категории</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Layers3 className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Всего SKU</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{categoryVariants.length}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Складских позиций</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
              <Package className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Единиц на складе</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{totalStock}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Фактический остаток</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <PackageCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Без остатка</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{emptyVariants}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Из {categoryVariants.length} SKU</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-[var(--warning)]">
              <CircleAlert className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
        <div className="border-b border-[var(--border-primary)] p-2">
          <div className="erp-scrollbar-hidden flex gap-1 overflow-x-auto" aria-label="Категории склада">
            {categories.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategoryId(category.id)
                  setActiveFolderId(null)
                  setSearch('')
                }}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-semibold transition-colors ${
                  activeCategoryId === category.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="search"
                aria-label="Поиск по складским позициям"
                placeholder="Модель, базовый артикул или SKU"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="erp-input w-full !pl-9 font-normal"
              />
            </div>
            <div className="flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-3 text-[10px] font-semibold text-[var(--text-secondary)]">
              {filteredProducts.length} {pluralizeRussian(filteredProducts.length, 'модель', 'модели', 'моделей')} · {filteredVariantCount} SKU
            </div>
          </div>

          {!isSearching && activeFolderId && (
            <div className="erp-scrollbar-hidden mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap border-t border-[var(--border-primary)] pt-3 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  const currentFolder = folders.find(folder => folder.id === activeFolderId)
                  setActiveFolderId(currentFolder?.parentId || null)
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent-primary)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Назад
              </button>
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className="shrink-0 rounded-lg px-2 py-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent-primary)]"
              >
                {activeCategory?.name}
              </button>
              {breadcrumbs.map((breadcrumb, index) => (
                <div key={breadcrumb.id} className="flex shrink-0 items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(breadcrumb.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent-primary)] ${
                      index === breadcrumbs.length - 1
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {index === breadcrumbs.length - 1 && <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-primary)]" />}
                    {breadcrumb.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {errorMessage && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-[11px] font-semibold text-[var(--danger)]">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {!isSearching && categoryFolders.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-end justify-between gap-3 px-0.5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {activeFolderId ? 'Подпапки' : 'Разделы склада'}
              </h2>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Выберите раздел, чтобы увидеть модели и остатки</p>
            </div>
            <span className="whitespace-nowrap text-[10px] font-semibold text-[var(--text-tertiary)]">
              {categoryFolders.length} {pluralizeRussian(categoryFolders.length, 'раздел', 'раздела', 'разделов')}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categoryFolders.map(folder => {
              const count = getRecursiveFolderProductsCount(folder.id)

              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-3.5 text-left shadow-xs transition-colors hover:border-[var(--accent-primary)]/30 hover:bg-[var(--bg-surface-hover)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                    <Folder className="h-[18px] w-[18px]" fill="currentColor" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">{folder.name}</span>
                    <span className="mt-1 block whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {count} {pluralizeRussian(count, 'модель', 'модели', 'моделей')}
                    </span>
                  </span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" />
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {isSearching ? 'Результаты поиска' : 'Складские позиции'}
            </h2>
            <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">
              {isSearching
                ? `По всей категории «${activeCategory?.name || ''}»`
                : activeFolderId
                  ? getFolderPathName(activeFolderId)
                  : 'Текущий раздел'}
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-lg bg-[var(--bg-surface-secondary)] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {filteredStockedVariants} с остатком
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
              <Warehouse className="h-6 w-6" strokeWidth={1.7} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
              {isSearching
                ? 'Ничего не найдено'
                : activeFolderId
                  ? 'В этой папке пока нет товаров'
                  : categoryFolders.length > 0
                    ? 'Выберите раздел склада'
                    : 'В категории пока нет товаров'}
            </h3>
            <p className="mt-1 max-w-sm text-[10px] leading-5 text-[var(--text-tertiary)]">
              {isSearching
                ? 'Попробуйте изменить запрос: поиск работает по модели, базовому артикулу и SKU.'
                : categoryFolders.length > 0
                  ? 'Модели и их остатки появятся здесь после выбора папки выше.'
                  : 'Добавьте модели и SKU в каталоге, чтобы вести по ним складской остаток.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {filteredProducts.map(product => {
              const folderPath = getFolderPathName(product.folderId)

              return (
                <article key={product.id}>
                  <div className="flex items-center justify-between gap-3 bg-[var(--bg-table-header)] px-4 py-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{product.name}</h3>
                      {isSearching && folderPath && (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-[9px] font-semibold text-[var(--accent-text)]">
                          <Folder className="h-3 w-3 shrink-0" />
                          <span className="truncate">{folderPath}</span>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[9px] font-semibold text-[var(--text-secondary)]">{product.baseSku}</span>
                  </div>

                  <div className="divide-y divide-[var(--border-primary)] px-4">
                    {product.variants.map(variant => {
                      const isChanged = localStocks[variant.id] !== undefined && Number(localStocks[variant.id]) !== variant.stock
                      const currentValue = getStockValue(variant.id, variant.stock)
                      const isDivan = product.category.slug === 'sofas'
                      const isChair = product.category.slug === 'chairs'
                      const isSet = product.category.slug === 'sets'
                      const description = [
                        variant.size && `Размер: ${variant.size}`,
                        variant.color && `Цвет: ${variant.color}`,
                        !isChair && !isDivan && !isSet && variant.thickness && `Узор: ${variant.thickness}`,
                        variant.material && (isSet ? `Состав: ${variant.material}` : `Каркас: ${variant.material}`),
                      ].filter(Boolean).join(' · ')

                      return (
                        <div key={variant.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[10px] font-semibold text-[var(--text-primary)]" title={variant.sku}>{variant.sku}</p>
                            <p className="mt-1 truncate text-[10px] text-[var(--text-secondary)]" title={description || 'Базовая модификация'}>
                              {description || 'Базовая модификация'}
                            </p>
                          </div>

                          <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
                            <div className={`flex h-8 shrink-0 items-center overflow-hidden rounded-lg border transition-colors ${
                              isChanged
                                ? 'border-[var(--warning)] bg-[var(--warning-soft)]'
                                : 'border-[var(--border-primary)] bg-[var(--bg-surface-secondary)]'
                            }`}>
                              <button
                                type="button"
                                aria-label={`Уменьшить остаток ${variant.sku}`}
                                onClick={() => handleStepStock(variant.id, variant.stock, -1)}
                                className="flex h-full w-8 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                aria-label={`Остаток ${variant.sku}`}
                                value={currentValue}
                                onChange={event => handleLocalStockChange(variant.id, event.target.value)}
                                className="h-full w-11 border-x border-[var(--border-primary)] bg-transparent text-center text-xs font-semibold text-[var(--text-primary)] outline-none"
                              />
                              <button
                                type="button"
                                aria-label={`Увеличить остаток ${variant.sku}`}
                                onClick={() => handleStepStock(variant.id, variant.stock, 1)}
                                className="flex h-full w-8 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex w-[92px] shrink-0 justify-end">
                              {loading === variant.id ? (
                                <span className="flex h-8 w-8 items-center justify-center text-[var(--text-tertiary)]">
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                </span>
                              ) : successId === variant.id ? (
                                <span className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--success-soft)] px-2.5 text-[9px] font-semibold text-[var(--success)]">
                                  <Check className="h-3.5 w-3.5" />
                                  Сохранено
                                </span>
                              ) : isChanged ? (
                                <button
                                  type="button"
                                  onClick={() => handleSaveStock(variant.id, variant.stock)}
                                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-[var(--accent-primary)] px-3 text-[9px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                                >
                                  Сохранить
                                </button>
                              ) : (
                                <span className={`inline-flex h-8 items-center whitespace-nowrap rounded-lg px-2.5 text-[9px] font-semibold ${
                                  variant.stock > 0
                                    ? 'bg-[var(--success-soft)] text-[var(--success)]'
                                    : 'bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]'
                                }`}>
                                  {variant.stock > 0 ? 'В наличии' : 'Нет остатка'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
