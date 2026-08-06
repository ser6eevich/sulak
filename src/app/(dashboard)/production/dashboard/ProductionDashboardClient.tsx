'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Hammer,
  Layers3,
  PackageCheck,
  Search,
  User,
} from 'lucide-react'

interface Variant {
  sku: string
  size: string | null
  color: string | null
  material: string | null
  thickness: string | null
  product: {
    name: string
    category: {
      name: string
    }
  }
}

interface OrderItem {
  id: string
  quantity: number
  customTableSize: string | null
  customChairsCount: number | null
  variant: Variant
}

interface Order {
  id: string
  number?: string | null
  createdAt: Date | string
  client: {
    fullName: string
  }
  items: OrderItem[]
}

interface ProductionDashboardClientProps {
  initialOrders: Order[]
}

function pluralizeRussian(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default function ProductionDashboardClient({ initialOrders }: ProductionDashboardClientProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const allItems = useMemo(() => initialOrders.flatMap(order => order.items), [initialOrders])
  const totalUnits = useMemo(
    () => allItems.reduce((sum, item) => sum + item.quantity, 0),
    [allItems]
  )
  const uniqueSkuCount = useMemo(
    () => new Set(allItems.map(item => item.variant.sku)).size,
    [allItems]
  )
  const categories = useMemo(
    () => Array.from(new Set(allItems.map(item => item.variant.product.category.name))).sort((a, b) => a.localeCompare(b, 'ru')),
    [allItems]
  )

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()

    return initialOrders.filter(order => {
      const categoryMatches = activeCategory === 'all' || order.items.some(
        item => item.variant.product.category.name === activeCategory
      )

      if (!categoryMatches) return false
      if (!query) return true

      const matchesNumber = order.number?.toLowerCase().includes(query) || order.id.toLowerCase().includes(query)
      const matchesClient = order.client.fullName.toLowerCase().includes(query)
      const matchesItems = order.items.some(item =>
        item.variant.product.name.toLowerCase().includes(query) ||
        item.variant.sku.toLowerCase().includes(query)
      )

      return matchesNumber || matchesClient || matchesItems
    })
  }, [activeCategory, initialOrders, search])

  const filteredUnits = filteredOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  )

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Сводка производства">
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Заказов в работе</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{initialOrders.length}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Текущая очередь производства</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Hammer className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Изделий</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{totalUnits}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Суммарное количество единиц</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <PackageCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Уникальных SKU</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{uniqueSkuCount}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Модификации в текущей работе</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
              <Layers3 className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
        <div className="border-b border-[var(--border-primary)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Очередь производства</h2>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Старые заказы отображаются первыми</p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  type="search"
                  aria-label="Поиск по производственной очереди"
                  placeholder="Модель, SKU, клиент или № заказа"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="erp-input w-full !pl-9 font-normal"
                />
              </div>
              <div className="flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-3 text-[10px] font-semibold text-[var(--text-secondary)]">
                {filteredOrders.length} {pluralizeRussian(filteredOrders.length, 'заказ', 'заказа', 'заказов')} · {filteredUnits} {pluralizeRussian(filteredUnits, 'изделие', 'изделия', 'изделий')}
              </div>
            </div>
          </div>

          {categories.length > 1 && (
            <div className="erp-scrollbar-hidden mt-3 flex gap-1.5 overflow-x-auto" aria-label="Фильтр по категории">
              {['all', ...categories].map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                    activeCategory === category
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {category === 'all' ? 'Все изделия' : category}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
              <Hammer className="h-6 w-6" strokeWidth={1.7} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
              {search || activeCategory !== 'all' ? 'Ничего не найдено' : 'Нет изделий в производстве'}
            </h3>
            <p className="mt-1 max-w-sm text-[10px] leading-5 text-[var(--text-tertiary)]">
              {search || activeCategory !== 'all'
                ? 'Попробуйте изменить запрос или выбрать другую категорию.'
                : 'Заказы появятся здесь после перевода в статус «В производстве».'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {filteredOrders.map(order => {
              const orderNumber = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
              const orderUnits = order.items.reduce((sum, item) => sum + item.quantity, 0)

              return (
                <article key={order.id} className="group">
                  <div className="flex flex-col gap-3 bg-[var(--bg-table-header)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="whitespace-nowrap font-mono text-xs font-semibold text-[var(--text-primary)]">{orderNumber}</span>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        <User className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                        <span className="truncate">{order.client.fullName}</span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <span className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        <Clock3 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {orderUnits} {pluralizeRussian(orderUnits, 'изделие', 'изделия', 'изделий')}
                      </span>
                      <Link
                        href={`/orders?id=${encodeURIComponent(order.number || order.id)}`}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[10px] font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)]"
                      >
                        Открыть заказ
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border-primary)] px-4">
                    {order.items.map(item => {
                      const categoryName = item.variant.product.category.name
                      const unitLabel = categoryName.toLowerCase() === 'диваны' ? 'компл.' : 'шт.'
                      const specifications = [
                        item.variant.size && `Размер: ${item.variant.size}`,
                        item.variant.color && `Цвет: ${item.variant.color}`,
                        item.variant.material && `Ткань/подстолье: ${item.variant.material}`,
                        item.variant.thickness && `Узор: ${item.variant.thickness}`,
                      ].filter(Boolean)

                      return (
                        <div key={item.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.variant.product.name}</h3>
                              <span className="shrink-0 whitespace-nowrap rounded-md bg-[var(--bg-surface-secondary)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-tertiary)]">{categoryName}</span>
                            </div>
                            <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-tertiary)]">SKU: {item.variant.sku}</p>
                          </div>

                          <div className="min-w-0 space-y-1.5">
                            {specifications.length > 0 && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-secondary)]">
                                {specifications.map(specification => <span key={String(specification)}>{specification}</span>)}
                              </div>
                            )}
                            {(item.customTableSize || item.customChairsCount !== null) && (
                              <div className="flex flex-wrap gap-1.5">
                                {item.customTableSize && (
                                  <span className="whitespace-nowrap rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-semibold text-[var(--accent-text)]">
                                    Инд. размер: {item.customTableSize}
                                  </span>
                                )}
                                {item.customChairsCount !== null && item.customChairsCount !== undefined && (
                                  <span className="whitespace-nowrap rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-semibold text-[var(--accent-text)]">
                                    Стульев: {item.customChairsCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-baseline justify-between gap-3 lg:block lg:text-right">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Количество</span>
                            <p className="whitespace-nowrap text-base font-semibold text-[var(--accent-primary)]">{item.quantity} {unitLabel}</p>
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
