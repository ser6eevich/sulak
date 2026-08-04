'use client'

import { useState } from 'react'
import { 
  Search, 
  Hammer, 
  Calendar, 
  User, 
  Layers
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

export default function ProductionDashboardClient({ initialOrders }: ProductionDashboardClientProps) {
  const [orders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')

  const filteredOrders = orders.filter(o => {
    const s = search.toLowerCase()
    const matchesNumber = o.number?.toLowerCase().includes(s) || o.id.toLowerCase().includes(s)
    const matchesClient = o.client.fullName.toLowerCase().includes(s)
    const matchesItems = o.items.some(
      i =>
        i.variant.product.name.toLowerCase().includes(s) ||
        i.variant.sku.toLowerCase().includes(s)
    )
    return matchesNumber || matchesClient || matchesItems
  })

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
      {/* Search toolbar */}
      <div className="erp-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Поиск по модели, SKU, клиенту или № заказа..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="erp-input w-full !pl-9 font-normal"
          />
        </div>
        <div className="text-[11px] text-[var(--text-tertiary)] font-normal">
          Очередь по дате добавления
        </div>
      </div>

      {/* Production items grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredOrders.length === 0 ? (
          <div className="md:col-span-2 erp-card p-12 text-center text-[var(--text-tertiary)]">
            <Hammer className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-normal">Нет изделий в производстве</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const shortId = order.id.slice(-6).toUpperCase()
            return (
              <div 
                key={order.id} 
                className="erp-card overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="bg-[var(--bg-table-header)] px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-[var(--text-primary)]">
                      {order.number ? `№${order.number}` : `#${shortId}`}
                    </span>
                    <span className="text-[var(--border-strong)]">|</span>
                    <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                      <Calendar className="h-3 w-3" />
                      {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 font-medium text-[var(--text-primary)]">
                    <User className="h-3 w-3 text-[var(--accent-primary)]" />
                    {order.client.fullName}
                  </span>
                </div>

                {/* Items */}
                <div className="p-4 flex-1 space-y-4 divide-y divide-[var(--border-primary)]">
                  {order.items.map((item, idx) => {
                    const isDivan = item.variant.product.category.name.toLowerCase() === 'диваны'
                    return (
                      <div key={item.id} className={`flex items-start justify-between gap-4 ${idx > 0 ? 'pt-4' : ''}`}>
                        <div className="space-y-1 text-xs">
                          <h4 className="font-medium text-[var(--text-primary)] text-sm">
                            {item.variant.product.name}
                          </h4>
                          <p className="font-mono text-[10px] text-[var(--text-tertiary)]">
                            SKU: {item.variant.sku}
                          </p>
                          
                          {/* Options */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[var(--text-secondary)] font-normal">
                            {item.variant.size && <span>Размер: {item.variant.size}</span>}
                            {item.variant.color && <span>Цвет: {item.variant.color}</span>}
                            {item.variant.material && <span>Ткань/Подстолье: {item.variant.material}</span>}
                            {item.variant.thickness && <span>Узор: {item.variant.thickness}</span>}
                          </div>

                          {/* Custom Options */}
                          {item.customTableSize && (
                            <div className="mt-1.5 p-2 rounded bg-[var(--accent-soft)] border border-[var(--accent-primary)]/20 text-[var(--accent-text)] text-[11px] font-medium">
                              Индивидуальный размер стола: {item.customTableSize}
                            </div>
                          )}
                          {item.customChairsCount !== null && item.customChairsCount !== undefined && (
                            <div className="mt-1 p-2 rounded bg-[var(--accent-soft)] border border-[var(--accent-primary)]/20 text-[var(--accent-text)] text-[11px] font-medium">
                              Количество стульев в комплекте: {item.customChairsCount} шт.
                            </div>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] uppercase font-normal text-[var(--text-tertiary)]">Кол-во</span>
                          <span className="text-base font-semibold text-[var(--accent-primary)]">
                            {item.quantity} {isDivan ? 'компл.' : 'шт.'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
