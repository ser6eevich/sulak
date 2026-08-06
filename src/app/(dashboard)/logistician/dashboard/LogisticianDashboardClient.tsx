'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderStatusInLogisticsAction } from './actions'
import { normalizeAddress } from '@/utils/address'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  Route,
  Search,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react'

const STATUSES: Record<string, { label: string; className: string }> = {
  awaiting_delivery: {
    label: 'Ожидает отправку',
    className: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  },
  delivery: {
    label: 'В пути',
    className: 'bg-[var(--accent-soft)] text-[var(--accent-text)]',
  },
  delivered: {
    label: 'Доставлен',
    className: 'bg-[var(--success-soft)] text-[var(--success)]',
  },
  cancelled: {
    label: 'Отменён',
    className: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  },
}

const ITEMS_PER_PAGE = 10

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

function pluralizeRussian(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default function LogisticianDashboardClient({ orders, drivers }: LogisticianDashboardClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('all')
  const [selectedStatusTab, setSelectedStatusTab] = useState('all')
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [targetOrder, setTargetOrder] = useState<Order | null>(null)
  const [targetStatus, setTargetStatus] = useState('')
  const [targetDriverId, setTargetDriverId] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [customDeliveredAt, setCustomDeliveredAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const countInTransit = orders.filter(order => order.status === 'delivery').length
  const countAwaiting = orders.filter(order => order.status === 'awaiting_delivery').length
  const countUnassigned = orders.filter(order => !order.driver).length
  const uniqueDriversCount = new Set(orders.map(order => order.driver?.id).filter(Boolean)).size
  const activeDrivers = drivers
    .map(driver => ({
      ...driver,
      ordersCount: orders.filter(order => order.driver?.id === driver.id).length,
    }))
    .filter(driver => driver.ordersCount > 0)

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()

    return orders.filter(order => {
      const orderNumber = (order.number ? `№${order.number}` : `#${order.id.slice(-5)}`).toLowerCase()
      const clientName = order.client.fullName.toLowerCase()
      const driverName = order.driver?.fullName.toLowerCase() || ''
      const phone = order.client.primaryPhone || ''
      const address = (order.deliveryAddress || '').toLowerCase()
      const matchesSearch = !query || (
        orderNumber.includes(query) ||
        clientName.includes(query) ||
        driverName.includes(query) ||
        phone.includes(query) ||
        address.includes(query)
      )
      const matchesDriver = selectedDriverFilter === 'all'
        ? true
        : selectedDriverFilter === 'unassigned'
          ? !order.driver
          : order.driver?.id === selectedDriverFilter
      const matchesStatus = selectedStatusTab === 'all' || order.status === selectedStatusTab

      return matchesSearch && matchesDriver && matchesStatus
    })
  }, [orders, search, selectedDriverFilter, selectedStatusTab])

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE))
  const pageStart = (page - 1) * ITEMS_PER_PAGE
  const visibleOrders = filteredOrders.slice(pageStart, pageStart + ITEMS_PER_PAGE)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalOpen) {
        setModalOpen(false)
        setTargetOrder(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  const handleCopyAddress = async (orderId: string, address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddressId(orderId)
    setTimeout(() => setCopiedAddressId(null), 2000)
  }

  const openStatusModal = (order: Order, newStatus = order.status) => {
    setTargetOrder(order)
    setTargetStatus(newStatus)
    setTargetDriverId(order.driver?.id || '')
    setStatusComment('')
    setErrorMessage('')
    setCustomDeliveredAt(new Date().toISOString().slice(0, 16))
    setModalOpen(true)
  }

  const closeStatusModal = () => {
    setModalOpen(false)
    setTargetOrder(null)
    setErrorMessage('')
  }

  const handleConfirmStatusChange = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!targetOrder || !targetStatus) return

    if (targetStatus === 'cancelled' && !statusComment.trim()) {
      setErrorMessage('Укажите причину отмены заказа.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const result = await updateOrderStatusInLogisticsAction(
        targetOrder.id,
        targetStatus,
        statusComment.trim() || undefined,
        targetDriverId || undefined,
        targetStatus === 'delivered' && customDeliveredAt
          ? new Date(customDeliveredAt).toISOString()
          : undefined
      )

      if (!result.success) {
        setErrorMessage(result.error || 'Не удалось обновить заказ.')
        return
      }

      closeStatusModal()
      router.refresh()
    } catch (error) {
      console.error(error)
      setErrorMessage('Произошла ошибка при смене статуса.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка логистики">
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">В пути</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{countInTransit}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Активные доставки</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Truck className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Ожидают отправки</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{countAwaiting}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Готовы к назначению</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-[var(--warning)]">
              <Package className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Экипажей на линии</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{uniqueDriversCount}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">С заказами в работе</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <Users className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Без водителя</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{countUnassigned}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Требуют назначения</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
        <div className="border-b border-[var(--border-primary)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-[var(--accent-primary)]" />
            <h2 className="text-xs font-semibold text-[var(--text-primary)]">Экипажи и назначения</h2>
          </div>
          <div className="erp-scrollbar-hidden mt-3 flex gap-1.5 overflow-x-auto" aria-label="Фильтр по водителям">
            <button
              type="button"
              onClick={() => {
                setSelectedDriverFilter('all')
                setPage(1)
              }}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[10px] font-semibold transition-colors ${
                selectedDriverFilter === 'all'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              Все заказы
              <span className="opacity-70">{orders.length}</span>
            </button>
            {activeDrivers.map(driver => (
              <button
                key={driver.id}
                type="button"
                onClick={() => {
                  setSelectedDriverFilter(driver.id)
                  setPage(1)
                }}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[10px] font-semibold transition-colors ${
                  selectedDriverFilter === driver.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                {driver.fullName}
                <span className="opacity-70">{driver.ordersCount}</span>
              </button>
            ))}
            {countUnassigned > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDriverFilter('unassigned')
                  setPage(1)
                }}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[10px] font-semibold transition-colors ${
                  selectedDriverFilter === 'unassigned'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Без водителя
                <span className="opacity-70">{countUnassigned}</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-[440px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="search"
                aria-label="Поиск по логистике"
                placeholder="Заказ, клиент, телефон, водитель или адрес"
                value={search}
                onChange={event => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="erp-input w-full !pl-9 font-normal"
              />
            </div>

            <div className="erp-scrollbar-hidden flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-1" aria-label="Фильтр по статусу">
              {[
                { key: 'all', label: 'Все', count: orders.length },
                { key: 'delivery', label: 'В пути', count: countInTransit },
                { key: 'awaiting_delivery', label: 'Ожидают', count: countAwaiting },
              ].map(status => (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => {
                    setSelectedStatusTab(status.key)
                    setPage(1)
                  }}
                  className={`h-7 shrink-0 whitespace-nowrap rounded-md px-2.5 text-[10px] font-semibold transition-colors ${
                    selectedStatusTab === status.key
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {status.label} · {status.count}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
        <div className="flex flex-col gap-2 border-b border-[var(--border-primary)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Маршрутный лист</h2>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Заказы в пути и готовые к отправке</p>
          </div>
          <span className="whitespace-nowrap text-[10px] font-semibold text-[var(--text-secondary)]">
            {filteredOrders.length} {pluralizeRussian(filteredOrders.length, 'заказ', 'заказа', 'заказов')}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
              <ClipboardList className="h-6 w-6" strokeWidth={1.7} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">Заказы не найдены</h3>
            <p className="mt-1 max-w-sm text-[10px] leading-5 text-[var(--text-tertiary)]">Измените запрос, статус или фильтр по водителю.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {visibleOrders.map(order => {
              const orderNumber = order.number ? `№${order.number}` : `#${order.id.slice(-5)}`
              const address = normalizeAddress(order.deliveryAddress) || 'Адрес не указан'
              const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
              const statusInfo = STATUSES[order.status] || {
                label: order.status,
                className: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]',
              }
              const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0)

              return (
                <article key={order.id}>
                  <div className="flex flex-col gap-2 bg-[var(--bg-table-header)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="whitespace-nowrap font-mono text-xs font-semibold text-[var(--text-primary)]">{orderNumber}</span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                      <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-[9px] font-semibold ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      <User className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                      <span className="truncate">{order.driver?.fullName || 'Водитель не назначен'}</span>
                    </span>
                  </div>

                  <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="min-w-0 space-y-3">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Получатель</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{order.client.fullName}</span>
                          {order.client.primaryPhone && (
                            <a href={`tel:${order.client.primaryPhone}`} className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-semibold text-[var(--accent-primary)] hover:underline">
                              <Phone className="h-3.5 w-3.5" />
                              {order.client.primaryPhone}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                          <p className="min-w-0 text-[11px] font-semibold leading-5 text-[var(--text-primary)]">{address}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border-primary)] pt-2">
                          <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[9px] font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)]">
                            Открыть карту
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyAddress(order.id, address)}
                            className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[9px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                          >
                            {copiedAddressId === order.id ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
                            {copiedAddressId === order.id ? 'Скопировано' : 'Скопировать адрес'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Состав груза</p>
                          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{order.items.length} поз. · {totalUnits} шт.</p>
                        </div>
                      </div>
                      <div className="mt-2 divide-y divide-[var(--border-primary)] overflow-hidden rounded-lg border border-[var(--border-primary)]">
                        {order.items.map(item => {
                          const size = item.customTableSize || item.variant.size
                          const specifications = [
                            size && `Размер: ${size}${item.customTableSize ? ' (инд.)' : ''}`,
                            item.variant.color && `Цвет: ${item.variant.color}`,
                            item.variant.thickness && `Узор: ${item.variant.thickness}`,
                            item.customChairsCount !== null && item.customChairsCount !== undefined && `Стульев: ${item.customChairsCount}`,
                          ].filter(Boolean).join(' · ')

                          return (
                            <div key={item.id} className="flex items-center justify-between gap-3 bg-[var(--bg-surface-secondary)] px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{item.variant.product.name}</p>
                                <p className="mt-1 truncate text-[9px] text-[var(--text-tertiary)]" title={specifications}>{specifications || 'Базовая комплектация'}</p>
                              </div>
                              <span className="shrink-0 whitespace-nowrap rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)] px-2 py-1 text-[9px] font-semibold text-[var(--text-secondary)]">{item.quantity} шт.</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-[var(--border-primary)] px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() => openStatusModal(order)}
                      className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 text-[10px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                    >
                      Управлять рейсом
                    </button>
                    <button
                      type="button"
                      onClick={() => openStatusModal(order, 'delivered')}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--success)] px-3 text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Отметить доставленным
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {filteredOrders.length > ITEMS_PER_PAGE && (
          <div className="flex flex-col gap-3 border-t border-[var(--border-primary)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Показано {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, filteredOrders.length)} из {filteredOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Предыдущая страница"
                disabled={page === 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-16 text-center text-[10px] font-semibold text-[var(--text-secondary)]">{page} / {pageCount}</span>
              <button
                type="button"
                aria-label="Следующая страница"
                disabled={page === pageCount}
                onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {modalOpen && targetOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-3 backdrop-blur-xs sm:p-6"
          onClick={event => {
            if (event.target === event.currentTarget) closeStatusModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logistics-dialog-title"
            className="flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xl sm:max-h-[calc(100dvh-48px)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Управление доставкой</p>
                <h2 id="logistics-dialog-title" className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                  Заказ {targetOrder.number ? `№${targetOrder.number}` : `#${targetOrder.id.slice(-5)}`}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Закрыть управление доставкой"
                onClick={closeStatusModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="logistics-status" className="mb-1.5 block text-[10px] font-semibold text-[var(--text-secondary)]">Новый статус</label>
                  <select id="logistics-status" value={targetStatus} onChange={event => setTargetStatus(event.target.value)} className="erp-input w-full font-medium">
                    {Object.entries(STATUSES).map(([key, status]) => <option key={key} value={key}>{status.label}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="logistics-driver" className="mb-1.5 block text-[10px] font-semibold text-[var(--text-secondary)]">Водитель или экипаж</label>
                  <select id="logistics-driver" value={targetDriverId} onChange={event => setTargetDriverId(event.target.value)} className="erp-input w-full font-medium">
                    <option value="">Не назначен</option>
                    {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.fullName}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}
                  </select>
                </div>

                {targetStatus === 'delivered' && (
                  <div>
                    <label htmlFor="logistics-delivered-at" className="mb-1.5 block text-[10px] font-semibold text-[var(--text-secondary)]">Фактическая дата и время доставки</label>
                    <input id="logistics-delivered-at" type="datetime-local" required value={customDeliveredAt} onChange={event => setCustomDeliveredAt(event.target.value)} className="erp-input w-full font-medium" />
                    <p className="mt-1.5 text-[9px] leading-4 text-[var(--text-tertiary)]">Можно указать прошедшее время, если доставка была завершена ранее.</p>
                  </div>
                )}

                {targetStatus === 'cancelled' && (
                  <div>
                    <label htmlFor="logistics-comment" className="mb-1.5 block text-[10px] font-semibold text-[var(--text-secondary)]">Причина отмены</label>
                    <textarea id="logistics-comment" required value={statusComment} onChange={event => setStatusComment(event.target.value)} placeholder="Укажите причину отмены" className="erp-input min-h-24 w-full resize-y" />
                  </div>
                )}

                {errorMessage && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2.5 text-[10px] font-semibold text-[var(--danger)]">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {errorMessage}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeStatusModal} className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-primary)] px-4 text-[10px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)]">Отмена</button>
                <button type="submit" disabled={loading} className="inline-flex h-9 min-w-36 items-center justify-center whitespace-nowrap rounded-lg bg-[var(--accent-primary)] px-4 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? 'Сохранение…' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
