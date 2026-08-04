'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderStatusInLogisticsAction } from './actions'
import { normalizeAddress } from '@/utils/address'
import { 
  Search, 
  User, 
  Truck,
  ClipboardList,
  MapPin,
  CheckCircle2,
  X,
  Phone,
  Package,
  LayoutList,
  LayoutGrid,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  AlertCircle
} from 'lucide-react'

const STATUSES: Record<string, { label: string; badgeClass: string }> = {
  awaiting_delivery: { 
    label: 'Ожидает отправку', 
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
  },
  delivery: { 
    label: 'Доставляется / В пути', 
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
  },
  delivered: { 
    label: 'Доставлен', 
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
  },
  cancelled: { 
    label: 'Отменен', 
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
  },
}

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
  customTableSize?: string | null
  customChairsCount?: number | null
  variant: Variant
}

interface Driver {
  id: string
  fullName: string
  phone?: string | null
  direction?: string | null
}

interface Order {
  id: string
  number?: string | null
  status: string
  createdAt: Date | string
  shippedAt: Date | string | null
  deliveredAt: Date | string | null
  deliveryAddress: string | null
  comment?: string | null
  client: {
    fullName: string
    primaryPhone?: string | null
    additionalPhone?: string | null
  }
  driver: {
    id: string
    fullName: string
    phone?: string | null
  } | null
  items: OrderItem[]
}

interface LogisticianDashboardClientProps {
  orders: Order[]
  drivers: Driver[]
}

export default function LogisticianDashboardClient({ orders, drivers }: LogisticianDashboardClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('all')
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null)

  // Модальное окно смены статуса / водителя
  const [modalOpen, setModalOpen] = useState(false)
  const [targetOrder, setTargetOrder] = useState<Order | null>(null)
  const [targetStatus, setTargetStatus] = useState<string>('')
  const [targetDriverId, setTargetDriverId] = useState<string>('')
  const [statusComment, setStatusComment] = useState<string>('')
  const [customDeliveredAt, setCustomDeliveredAt] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Закрытие модалок по Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false)
        setTargetOrder(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  // Фильтрация заказов по поиску, водителю и статусу
  const filteredOrders = orders.filter(order => {
    const query = search.toLowerCase()
    const num = (order.number ? `№${order.number}` : `#${order.id.slice(-5)}`).toLowerCase()
    const clientName = order.client.fullName.toLowerCase()
    const driverName = order.driver?.fullName.toLowerCase() || ''
    const phone = order.client.primaryPhone || ''
    const addr = (order.deliveryAddress || '').toLowerCase()

    const matchesSearch = num.includes(query) || clientName.includes(query) || driverName.includes(query) || phone.includes(query) || addr.includes(query)

    const matchesDriver = selectedDriverFilter === 'all' 
      ? true 
      : selectedDriverFilter === 'unassigned' 
        ? !order.driver 
        : order.driver?.id === selectedDriverFilter

    const matchesStatus = selectedStatusTab === 'all' ? true : order.status === selectedStatusTab

    return matchesSearch && matchesDriver && matchesStatus
  })

  // Статистика
  const countInTransit = orders.filter(o => o.status === 'delivery').length
  const countAwaiting = orders.filter(o => o.status === 'awaiting_delivery').length
  const uniqueDriversCount = new Set(orders.map(o => o.driver?.id).filter(Boolean)).size

  // Скопировать адрес
  const handleCopyAddress = (orderId: string, address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddressId(orderId)
    setTimeout(() => setCopiedAddressId(null), 2000)
  }

  // Открытие модалки подтверждения смены статуса
  const openStatusModal = (order: Order, newStatus: string) => {
    setTargetOrder(order)
    setTargetStatus(newStatus)
    setTargetDriverId(order.driver?.id || '')
    setStatusComment('')
    setCustomDeliveredAt(new Date().toISOString().slice(0, 16))
    setModalOpen(true)
  }

  // Обработчик сохранения смены статуса
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetOrder || !targetStatus) return

    if (targetStatus === 'cancelled' && !statusComment.trim()) {
      alert('Пожалуйста, укажите причину отмены заказа.')
      return
    }

    setLoading(true)
    try {
      const res = await updateOrderStatusInLogisticsAction(
        targetOrder.id,
        targetStatus,
        statusComment.trim() || undefined,
        targetDriverId || undefined,
        targetStatus === 'delivered' && customDeliveredAt ? new Date(customDeliveredAt).toISOString() : undefined
      )

      if (!res.success) {
        alert(res.error || 'Ошибка при обновлении статуса')
      } else {
        setModalOpen(false)
        setTargetOrder(null)
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      alert('Произошла ошибка при смене статуса.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-hidden">
      {/* ── 1. Верхняя статистика ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="erp-stat-card">
          <div>
            <p className="stat-label">В пути</p>
            <h3 className="stat-value">{countInTransit} заказов</h3>
          </div>
          <div className="stat-icon bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        <div className="erp-stat-card">
          <div>
            <p className="stat-label">Ожидают отправки</p>
            <h3 className="stat-value">{countAwaiting} заказов</h3>
          </div>
          <div className="stat-icon bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="erp-stat-card">
          <div>
            <p className="stat-label">Экипажей на маршрутах</p>
            <h3 className="stat-value">{uniqueDriversCount} чел</h3>
          </div>
          <div className="stat-icon bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ── 2. Быстрые фильтры по Водителям (Рейсы) ── */}
      <div className="erp-card p-3 space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>Быстрый фильтр по экипажам / водителям:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDriverFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              selectedDriverFilter === 'all'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-primary)]'
            }`}
          >
            Все экипажи ({orders.length})
          </button>

          {drivers.map(driver => {
            const driverOrdersCount = orders.filter(o => o.driver?.id === driver.id).length
            if (driverOrdersCount === 0) return null

            return (
              <button
                key={driver.id}
                onClick={() => setSelectedDriverFilter(driver.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedDriverFilter === driver.id
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'bg-[var(--bg-surface-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-primary)]'
                }`}
              >
                <User className="h-3.5 w-3.5 opacity-70" />
                <span>{driver.fullName}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/10 dark:bg-white/10">
                  {driverOrdersCount}
                </span>
              </button>
            )
          })}

          {orders.some(o => !o.driver) && (
            <button
              onClick={() => setSelectedDriverFilter('unassigned')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDriverFilter === 'unassigned'
                  ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                  : 'bg-[var(--bg-surface-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-primary)]'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5 opacity-70" />
              <span>Без водителя</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/10 dark:bg-white/10">
                {orders.filter(o => !o.driver).length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Панель Поиска и переключатель Таблица / Сетка ── */}
      <div className="erp-card p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Поиск по № заказа, клиенту, телефону, адресу..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="erp-input w-full !pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-[var(--bg-surface-secondary)] p-1 rounded-md border border-[var(--border-primary)]">
            <button
              onClick={() => setSelectedStatusTab('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                selectedStatusTab === 'all' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-tertiary)]'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setSelectedStatusTab('delivery')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                selectedStatusTab === 'delivery' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold' : 'text-[var(--text-tertiary)]'
              }`}
            >
              🚚 В пути ({countInTransit})
            </button>
            <button
              onClick={() => setSelectedStatusTab('awaiting_delivery')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                selectedStatusTab === 'awaiting_delivery' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold' : 'text-[var(--text-tertiary)]'
              }`}
            >
              📦 Склад ({countAwaiting})
            </button>
          </div>
        </div>

        {/* Переключатель вида: Таблица / Карточки */}
        <div className="flex items-center gap-1 bg-[var(--bg-surface-secondary)] p-1 rounded-md border border-[var(--border-primary)] self-end sm:self-center">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
              viewMode === 'table' ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs font-semibold' : 'text-[var(--text-tertiary)]'
            }`}
            title="Вид: Маршрутный лист (Таблица)"
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span>Таблица</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs font-semibold' : 'text-[var(--text-tertiary)]'
            }`}
            title="Вид: Крупные карточки"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Карточки</span>
          </button>
        </div>
      </div>

      {/* ── 4. Главный список (Вид: Таблица или Карточки) ── */}
      {filteredOrders.length === 0 ? (
        <div className="erp-card p-12 erp-empty-state">
          <ClipboardList className="h-10 w-10 text-[var(--text-tertiary)] mb-2 opacity-50" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Заказы с выбранными параметрами не найдены</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ───── РЕЖИМ 1: МАРШРУТНЫЙ ЛИСТ (ТАБЛИЦА) ───── */
        <div className="erp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="w-28">Заказ №</th>
                  <th className="w-48">Экипаж / Водитель</th>
                  <th className="w-72">Клиент и Адрес доставки</th>
                  <th>Состав груза (Позиции)</th>
                  <th className="w-44 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {filteredOrders.map(order => {
                  const shortId = order.id.slice(-5)
                  const cleanAddr = normalizeAddress(order.deliveryAddress) || 'Адрес не указан'
                  const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(cleanAddr)}`
                  const statusInfo = STATUSES[order.status] || { label: order.status, badgeClass: 'bg-slate-500/10 text-slate-600' }

                  return (
                    <tr key={order.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                      {/* 1. Номер и дата */}
                      <td className="align-top py-3 font-mono">
                        <div className="font-bold text-[var(--text-primary)] text-sm">
                          {order.number ? `№${order.number}` : `#${shortId}`}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div className="mt-1.5">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </td>

                      {/* 2. Водитель */}
                      <td className="align-top py-3">
                        {order.driver ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                              <User className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                              <span>{order.driver.fullName}</span>
                            </div>
                            {order.driver.phone && (
                              <a
                                href={`tel:${order.driver.phone}`}
                                className="text-[11px] font-mono text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                              >
                                <Phone className="h-3 w-3" />
                                <span>{order.driver.phone}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                            <AlertCircle className="h-3 w-3" />
                            <span>Водитель не назначен</span>
                          </span>
                        )}
                      </td>

                      {/* 3. Клиент и Адрес */}
                      <td className="align-top py-3 space-y-1">
                        <div className="font-semibold text-sm text-[var(--text-primary)]">
                          {order.client.fullName}
                        </div>
                        {order.client.primaryPhone && (
                          <a
                            href={`tel:${order.client.primaryPhone}`}
                            className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline font-mono"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{order.client.primaryPhone}</span>
                          </a>
                        )}

                        <div className="bg-[var(--bg-surface-secondary)] p-2 rounded-md border border-[var(--border-primary)] text-xs mt-1 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span className="font-medium text-[var(--text-primary)] leading-tight">{cleanAddr}</span>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-primary)]/50 text-[10px]">
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--accent-primary)] hover:underline flex items-center gap-0.5 font-medium"
                            >
                              <span>Открыть карту</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            <span className="text-[var(--text-tertiary)]">•</span>
                            <button
                              type="button"
                              onClick={() => handleCopyAddress(order.id, cleanAddr)}
                              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-0.5 cursor-pointer"
                            >
                              {copiedAddressId === order.id ? (
                                <>
                                  <Check className="h-2.5 w-2.5 text-emerald-500" />
                                  <span className="text-emerald-500 font-medium">Скопировано</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-2.5 w-2.5" />
                                  <span>Скопировать</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 4. Состав груза */}
                      <td className="align-top py-3">
                        <div className="space-y-1.5">
                          {order.items.map(item => {
                            const sizeVal = item.customTableSize || item.variant.size
                            return (
                              <div key={item.id} className="p-2 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-[var(--text-primary)] text-xs">
                                    {item.variant.product.name}
                                  </span>
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--bg-surface)] border border-[var(--border-primary)] shrink-0">
                                    {item.quantity} шт
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {sizeVal && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-500/10 text-slate-700 dark:text-slate-300">
                                      📏 {sizeVal} {item.customTableSize ? '(Инд.)' : ''}
                                    </span>
                                  )}
                                  {item.variant.color && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      🎨 {item.variant.color}
                                    </span>
                                  )}
                                  {item.variant.thickness && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                                      ✨ {item.variant.thickness}
                                    </span>
                                  )}
                                  {item.customChairsCount !== null && item.customChairsCount !== undefined && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                      🪑 Стульев: {item.customChairsCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>

                      {/* 5. Действия */}
                      <td className="align-top py-3 text-right space-y-2">
                        <button
                          onClick={() => openStatusModal(order, 'delivered')}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Доставлен</span>
                        </button>
                        <button
                          onClick={() => openStatusModal(order, order.status === 'delivery' ? 'awaiting_delivery' : 'delivery')}
                          className="w-full text-[11px] font-medium text-[var(--accent-primary)] hover:underline cursor-pointer block text-center"
                        >
                          {order.status === 'delivery' ? 'Переназначить статус' : 'Отправить в рейс 🚚'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ───── РЕЖИМ 2: КАРТОЧКИ ───── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map(order => {
            const shortId = order.id.slice(-5)
            const cleanAddr = normalizeAddress(order.deliveryAddress) || 'Адрес не указан'
            const statusInfo = STATUSES[order.status] || { label: order.status, badgeClass: 'bg-slate-500/10 text-slate-600' }

            return (
              <div key={order.id} className="erp-card overflow-hidden flex flex-col justify-between">
                {/* Шапка карточки */}
                <div className="p-3.5 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {order.number ? `№${order.number}` : `#${shortId}`}
                    </span>
                    <span className="text-[var(--border-strong)]">•</span>
                    <span className="text-[var(--text-tertiary)] font-sans text-xs">
                      {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${statusInfo.badgeClass}`}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Тело карточки */}
                <div className="p-4 space-y-3.5 flex-1 text-xs">
                  {/* Клиент */}
                  <div className="flex items-center justify-between border-b border-[var(--border-primary)]/50 pb-2">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{order.client.fullName}</span>
                    {order.client.primaryPhone && (
                      <a href={`tel:${order.client.primaryPhone}`} className="flex items-center gap-1 font-mono text-[var(--accent-primary)] hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{order.client.primaryPhone}</span>
                      </a>
                    )}
                  </div>

                  {/* Адрес */}
                  <div className="bg-[var(--bg-surface-secondary)] p-2.5 rounded-md border border-[var(--border-primary)] space-y-1">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] block">Адрес доставки</span>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <span className="font-medium text-[var(--text-primary)] leading-tight">{cleanAddr}</span>
                    </div>
                  </div>

                  {/* Груз */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] block">Состав груза ({order.items.length} поз.):</span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {order.items.map(item => {
                        const sizeVal = item.customTableSize || item.variant.size
                        return (
                          <div key={item.id} className="p-2 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[var(--text-primary)]">{item.variant.product.name}</span>
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--bg-surface)] border border-[var(--border-primary)] shrink-0">
                                {item.quantity} шт
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {sizeVal && (
                                <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-slate-500/10 text-slate-700 dark:text-slate-300">
                                  📏 {sizeVal} {item.customTableSize ? '(Инд.)' : ''}
                                </span>
                              )}
                              {item.variant.color && (
                                <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                  🎨 {item.variant.color}
                                </span>
                              )}
                              {item.variant.thickness && (
                                <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                                  ✨ {item.variant.thickness}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Подвал карточки */}
                <div className="p-3 bg-[var(--bg-table-header)] border-t border-[var(--border-primary)] flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                    <User className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    <span>{order.driver?.fullName || 'Не назначен'}</span>
                  </div>

                  <button
                    onClick={() => openStatusModal(order, 'delivered')}
                    className="flex items-center gap-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Доставлен</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 5. Модальное окно смены статуса ── */}
      {modalOpen && targetOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalOpen(false)
              setTargetOrder(null)
            }
          }}
        >
          <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg shadow-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                Изменение статуса заказа {targetOrder.number ? `№${targetOrder.number}` : `#${targetOrder.id.slice(-5)}`}
              </h3>
              <button
                onClick={() => { setModalOpen(false); setTargetOrder(null) }}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="p-4 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                  Новый статус выполнения
                </label>
                <select
                  value={targetStatus}
                  onChange={e => setTargetStatus(e.target.value)}
                  className="erp-input w-full font-medium"
                >
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                  Назначить водителя / экипаж
                </label>
                <select
                  value={targetDriverId}
                  onChange={e => setTargetDriverId(e.target.value)}
                  className="erp-input w-full font-medium"
                >
                  <option value="">-- Не назначен --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName} {d.phone ? `(${d.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              {targetStatus === 'delivered' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Дата и время фактической доставки *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={customDeliveredAt}
                    onChange={e => setCustomDeliveredAt(e.target.value)}
                    className="erp-input w-full font-medium"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1 font-normal">
                    По умолчанию установлены текущие дата и время. Укажите прошедшую дату, если заказ был доставлен ранее.
                  </p>
                </div>
              )}

              {targetStatus === 'cancelled' && (
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Причина отмены заказа *
                  </label>
                  <textarea
                    required
                    value={statusComment}
                    onChange={e => setStatusComment(e.target.value)}
                    placeholder="Укажите причину..."
                    className="erp-input w-full min-h-[60px]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setTargetOrder(null) }}
                  className="erp-button-secondary cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="erp-button-primary cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
