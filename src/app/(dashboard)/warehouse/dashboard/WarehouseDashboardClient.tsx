'use client'

import { useState } from 'react'
import { updateStockAction } from './actions'
import { 
  Search, 
  Package, 
  Layers, 
  Check, 
  Plus, 
  Minus,
  RefreshCw,
  Folder,
  FolderOpen,
  ArrowLeft,
  ChevronRight
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

export default function WarehouseDashboardClient({ initialProducts, categories, folders }: WarehouseDashboardClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id || '')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [localStocks, setLocalStocks] = useState<Record<string, string | number>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  const activeCategory = categories.find(c => c.id === activeCategoryId)

  // Папки текущего уровня (внутри выбранной категории и текущей родительской папки)
  const categoryFolders = folders.filter(f => f.categoryId === activeCategoryId && f.parentId === activeFolderId)

  // Рекурсивный подсчет товаров в папке и ее подпапках
  const getRecursiveFolderProductsCount = (folderId: string): number => {
    const subFolderIds = folders.filter(f => f.parentId === folderId).map(f => f.id)
    const directProductsCount = products.filter(p => p.folderId === folderId).length
    const subProductsCount = subFolderIds.reduce((sum, subId) => sum + getRecursiveFolderProductsCount(subId), 0)
    return directProductsCount + subProductsCount
  }

  // Получить цепочку хлебных крошек
  const getBreadcrumbs = () => {
    const breadcrumbs: ProductFolder[] = []
    let current = folders.find(f => f.id === activeFolderId)
    while (current) {
      breadcrumbs.unshift(current)
      const pId = current.parentId
      current = pId ? folders.find(f => f.id === pId) : undefined
    }
    return breadcrumbs
  }

  // Получить строковый путь папок для вывода в результатах поиска
  const getFolderPathName = (folderId: string | null): string => {
    if (!folderId) return ''
    const parts: string[] = []
    let current = folders.find(f => f.id === folderId)
    while (current) {
      parts.unshift(current.name)
      const pId = current.parentId
      current = pId ? folders.find(f => f.id === pId) : undefined
    }
    return parts.join(' / ')
  }

  const isSearching = search.trim() !== ''

  // Фильтрация товаров:
  // Если поиск пустой — показываем только товары ТЕКУЩЕЙ папки (или корня)
  // Если поисковый запрос введен — ищем по ВСЕМ товарам категории
  const filteredProducts = products.filter(p => {
    const matchesCategory = p.categoryId === activeCategoryId
    if (!matchesCategory) return false

    if (isSearching) {
      const query = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(query) ||
        p.baseSku.toLowerCase().includes(query) ||
        p.variants.some(v => v.sku.toLowerCase().includes(query))
      )
    }

    return (p.folderId || null) === activeFolderId
  })

  // Получить текущее значение остатка (из локального стейта или из БД)
  const getStockValue = (variantId: string, dbStock: number) => {
    if (localStocks[variantId] !== undefined) {
      return localStocks[variantId]
    }
    return dbStock
  }

  // Изменение локального остатка
  const handleLocalStockChange = (variantId: string, value: string) => {
    setLocalStocks(prev => ({
      ...prev,
      [variantId]: value === '' ? '' : Number(value)
    }))
  }

  // Шаг изменения остатка (+ / -)
  const handleStepStock = (variantId: string, dbStock: number, step: number) => {
    const current = Number(getStockValue(variantId, dbStock)) || 0
    const nextVal = Math.max(0, current + step)
    setLocalStocks(prev => ({
      ...prev,
      [variantId]: nextVal
    }))
  }

  // Сохранить остаток в базу данных
  const handleSaveStock = async (variantId: string, dbStock: number) => {
    const currentVal = getStockValue(variantId, dbStock)
    const quantity = currentVal === '' ? 0 : Number(currentVal)
    
    setLoading(variantId)
    const result = await updateStockAction(variantId, quantity)
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      setProducts(prev => 
        prev.map(p => ({
          ...p,
          variants: p.variants.map(v => 
            v.id === variantId ? { ...v, stock: quantity } : v
          )
        }))
      )
      setLocalStocks(prev => {
        const next = { ...prev }
        delete next[variantId]
        return next
      })
      setSuccessId(variantId)
      setTimeout(() => setSuccessId(null), 2000)
    }
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
      {/* 1. Категории товаров (Вкладки) */}
      <div className="flex border border-[var(--border-primary)] bg-[var(--bg-surface)] rounded-md p-1.5 gap-1 overflow-x-auto min-w-0 max-w-full">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => { 
              setActiveCategoryId(cat.id)
              setActiveFolderId(null)
              setSearch('') 
            }}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded text-xs font-medium transition-all cursor-pointer shrink-0 ${
              activeCategoryId === cat.id
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            {cat.name}
          </button>
        ))}
      </div>

      {/* 2. Панель поиска и сводка */}
      <div className="flex flex-col gap-3 erp-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Поиск по названию модели или артикулу (SKU)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="erp-input w-full !pl-9 font-normal"
          />
        </div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-4">
          <span>
            Моделей: {filteredProducts.length}
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Всего SKU: {filteredProducts.reduce((acc, p) => acc + p.variants.length, 0)} шт
          </span>
        </div>
      </div>

      {/* 3. Хлебные крошки и навигация назад (если зашли в папку) */}
      {!isSearching && activeFolderId && (
        <div className="flex items-center justify-between erp-card p-3 text-xs font-medium">
          <div className="flex items-center flex-wrap gap-2">
            <button 
              onClick={() => {
                const currentFolder = folders.find(f => f.id === activeFolderId)
                setActiveFolderId(currentFolder?.parentId || null)
              }}
              className="flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors cursor-pointer mr-3 text-[var(--text-tertiary)] font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
            
            <button 
              onClick={() => setActiveFolderId(null)}
              className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer text-[var(--text-secondary)]"
            >
              {activeCategory?.name}
            </button>
            
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <button
                  onClick={() => setActiveFolderId(crumb.id)}
                  className={`flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors cursor-pointer ${
                    idx === breadcrumbs.length - 1 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {idx === breadcrumbs.length - 1 && <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-primary)]" />}
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Сетка папок */}
      {!isSearching && categoryFolders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-0.5">
            {activeFolderId ? 'Подпапки' : 'Разделы и папки'}
          </h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {categoryFolders.map(folder => {
              const count = getRecursiveFolderProductsCount(folder.id)
              return (
                <div
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  className="erp-card p-3.5 cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-all flex items-center gap-3 group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] transition-colors">
                    <Folder className="h-4 w-4 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-[var(--text-primary)] text-xs truncate group-hover:text-[var(--accent-primary)] transition-colors">{folder.name}</h4>
                    <p className="text-[10px] text-[var(--text-tertiary)] font-normal mt-0.5 uppercase tracking-wider">{count} моделей</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. Список товаров (Моделей) */}
      <div className="space-y-3">
        {!isSearching && categoryFolders.length > 0 && filteredProducts.length > 0 && (
          <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-0.5 pt-1">
            Товары в этом разделе
          </h3>
        )}

        {filteredProducts.length === 0 ? (
          <div className="erp-card p-12 text-center text-[var(--text-tertiary)] font-normal">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-normal">
              {isSearching 
                ? 'По вашему запросу ничего не найдено'
                : activeFolderId 
                  ? 'В этой папке пока нет товаров' 
                  : categoryFolders.length > 0 
                    ? 'Выберите папку выше для просмотра товаров'
                    : 'В данной категории пока нет товаров'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredProducts.map(product => {
              const folderPath = getFolderPathName(product.folderId)

              return (
                <div 
                  key={product.id} 
                  className="erp-card overflow-hidden flex flex-col"
                >
                  {/* Шапка карточки товара */}
                  <div className="bg-[var(--bg-table-header)] px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <h4 className="font-medium text-[var(--text-primary)] text-sm truncate">{product.name}</h4>
                      {isSearching && folderPath && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent-text)] mt-0.5">
                          <Folder className="h-3 w-3" /> {folderPath}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-surface-secondary)] px-2 py-0.5 rounded border border-[var(--border-primary)] shrink-0">
                      {product.baseSku}
                    </span>
                  </div>

                  {/* Варианты и управление остатками */}
                  <div className="p-4 divide-y divide-[var(--border-primary)] space-y-3">
                    {product.variants.map((v, idx) => {
                      const isChanged = localStocks[v.id] !== undefined && Number(localStocks[v.id]) !== v.stock
                      const currentVal = getStockValue(v.id, v.stock)
                      const isDivan = product.category.slug === 'sofas'
                      const isChair = product.category.slug === 'chairs'
                      const isSet = product.category.slug === 'sets'

                      const desc = [
                        v.size ? `Размер: ${v.size}` : null,
                        v.color ? `Цвет: ${v.color}` : null,
                        !isChair && !isDivan && !isSet && v.thickness ? `Узор: ${v.thickness}` : null,
                        v.material ? (isSet ? `Состав: ${v.material}` : `Каркас: ${v.material}`) : null,
                      ].filter(Boolean).join(', ')

                      return (
                        <div key={v.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${idx > 0 ? 'pt-3' : ''}`}>
                          {/* Характеристики модификации */}
                          <div className="space-y-0.5 text-xs">
                            <p className="font-mono font-medium text-[var(--text-primary)]">{v.sku}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-normal">{desc || 'Базовая модификация'}</p>
                          </div>

                          {/* Управление количеством */}
                          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                            <div className={`flex items-center border rounded bg-[var(--bg-surface-secondary)] transition-all ${
                              isChanged ? 'border-[var(--warning)] bg-[var(--warning-soft)]' : 'border-[var(--border-primary)]'
                            }`}>
                              <button
                                type="button"
                                onClick={() => handleStepStock(v.id, v.stock, -1)}
                                className="p-1 hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              
                              <input
                                type="number"
                                min={0}
                                value={currentVal}
                                onChange={e => handleLocalStockChange(v.id, e.target.value)}
                                className="w-10 text-center text-xs font-semibold bg-transparent border-none outline-none text-[var(--text-primary)]"
                              />

                              <button
                                type="button"
                                onClick={() => handleStepStock(v.id, v.stock, 1)}
                                className="p-1 hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Кнопка сохранения изменений */}
                            <div className="w-20 flex justify-end">
                              {loading === v.id ? (
                                <RefreshCw className="h-4 w-4 text-[var(--text-tertiary)] animate-spin mr-2" />
                              ) : successId === v.id ? (
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[var(--success-soft)] text-[var(--success)] mr-2">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : isChanged ? (
                                <button
                                  type="button"
                                  onClick={() => handleSaveStock(v.id, v.stock)}
                                  className="erp-button-primary py-1 px-2.5 text-[10px] cursor-pointer"
                                >
                                  Записать
                                </button>
                              ) : (
                                <span className="text-[10px] text-[var(--text-tertiary)] font-normal mr-1 uppercase">
                                  В наличии
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
