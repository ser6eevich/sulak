'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createDriverAction,
  completeDeliveryFromDriversAction,
  returnToWarehouseFromDriversAction,
} from './actions'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  KeyRound,
  MapPin,
  Package,
  Phone,
  Plus,
  Route,
  Search,
  Truck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

const ORDERS_PER_PAGE = 5

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
  variant: Variant
}

interface Order {
  id: string
  number?: string | null
  status: string
  createdAt: Date | string
  deliveryAddress: string | null
  comment: string | null
  client: {
    fullName: string
    primaryPhone: string
    additionalPhone: string | null
  }
  items: OrderItem[]
}

interface Driver {
  id: string
  fullName: string
  phone: string | null
  email: string
  direction: string | null
  orders: Order[]
}

interface DriversDashboardClientProps {
  drivers: Driver[]
  userRole: string
}

type DriverFilter = 'all' | 'active' | 'idle'
type OrderFilter = 'all' | 'delivery' | 'delivered'

function pluralizeRussian(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function orderLabel(order: Order) {
  return order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
}

export default function DriversDashboardClient({ drivers, userRole }: DriversDashboardClientProps) {
  const router = useRouter()
  const firstActiveDriver = drivers.find(driver => driver.orders.some(order => order.status === 'delivery'))
  const [selectedDriverId, setSelectedDriverId] = useState(firstActiveDriver?.id || drivers[0]?.id || '')
  const [search, setSearch] = useState('')
  const [driverFilter, setDriverFilter] = useState<DriverFilter>('all')
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')
  const [orderPage, setOrderPage] = useState(1)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [modalFullName, setModalFullName] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [modalDirection, setModalDirection] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [activeAction, setActiveAction] = useState<{ order: Order; type: 'delivered' | 'warehouse' } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const activeDriversCount = drivers.filter(driver => driver.orders.some(order => order.status === 'delivery')).length
  const activeDeliveriesCount = drivers.reduce(
    (sum, driver) => sum + driver.orders.filter(order => order.status === 'delivery').length,
    0
  )
  const deliveredCount = drivers.reduce(
    (sum, driver) => sum + driver.orders.filter(order => order.status === 'delivered').length,
    0
  )

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return drivers.filter(driver => {
      const activeOrders = driver.orders.filter(order => order.status === 'delivery').length
      const matchesFilter = driverFilter === 'all'
        || (driverFilter === 'active' && activeOrders > 0)
        || (driverFilter === 'idle' && activeOrders === 0)
      const matchesSearch = !query
        || driver.fullName.toLowerCase().includes(query)
        || (driver.phone || '').toLowerCase().includes(query)
        || (driver.direction || '').toLowerCase().includes(query)

      return matchesFilter && matchesSearch
    })
  }, [driverFilter, drivers, search])

  const effectiveSelectedDriverId = filteredDrivers.some(driver => driver.id === selectedDriverId)
    ? selectedDriverId
    : filteredDrivers[0]?.id || ''
  const selectedDriver = drivers.find(driver => driver.id === effectiveSelectedDriverId)
  const selectedOrders = useMemo(() => {
    if (!selectedDriver) return []
    if (orderFilter === 'all') return selectedDriver.orders
    return selectedDriver.orders.filter(order => order.status === orderFilter)
  }, [orderFilter, selectedDriver])
  const orderPageCount = Math.max(1, Math.ceil(selectedOrders.length / ORDERS_PER_PAGE))
  const orderPageStart = (orderPage - 1) * ORDERS_PER_PAGE
  const visibleOrders = selectedOrders.slice(orderPageStart, orderPageStart + ORDERS_PER_PAGE)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (activeAction) {
        setActiveAction(null)
        setActionError('')
      } else if (createModalOpen) {
        setCreateModalOpen(false)
        setCreateError('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeAction, createModalOpen])

  const closeCreateModal = () => {
    setCreateModalOpen(false)
    setCreateError('')
  }

  const closeActionModal = () => {
    setActiveAction(null)
    setActionComment('')
    setActionError('')
  }

  const handleCreateDriver = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!modalFullName.trim() || !modalPhone.trim()) return

    setCreateLoading(true)
    setCreateError('')
    const result = await createDriverAction(
      modalFullName,
      modalPhone,
      modalDirection,
      modalPassword
    )
    setCreateLoading(false)

    if (result.error) {
      setCreateError(result.error)
      return
    }

    closeCreateModal()
    router.refresh()
  }

  const handleConfirmAction = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeAction) return

    if (activeAction.type === 'warehouse' && !actionComment.trim()) {
      setActionError('Укажите причину возврата заказа на склад.')
      return
    }

    setActionLoading(true)
    setActionError('')
    const result = activeAction.type === 'delivered'
      ? await completeDeliveryFromDriversAction(activeAction.order.id, actionComment)
      : await returnToWarehouseFromDriversAction(activeAction.order.id, actionComment)
    setActionLoading(false)

    if (result.error) {
      setActionError(result.error)
      return
    }

    closeActionModal()
    router.refresh()
  }

  const openActionModal = (order: Order, type: 'delivered' | 'warehouse') => {
    setActiveAction({ order, type })
    setActionComment('')
    setActionError('')
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка по экипажам">
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Экипажей</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{drivers.length}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Активные профили</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <UsersRound className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">На линии</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{activeDriversCount}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">С заказами в пути</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-[var(--warning)]">
              <Truck className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Заказов в пути</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{activeDeliveriesCount}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Текущая нагрузка</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Route className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Доставлено</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{deliveredCount}</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">В истории экипажей</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
          <div className="border-b border-[var(--border-primary)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Состав экипажей</h2>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Контакты и текущая загрузка</p>
              </div>
              {['admin', 'owner'].includes(userRole) && (
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="erp-button-primary inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить
                </button>
              )}
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="search"
                aria-label="Поиск экипажа"
                placeholder="ФИО, телефон, направление"
                value={search}
                onChange={event => {
                  setSearch(event.target.value)
                  setOrderPage(1)
                }}
                className="erp-input w-full !pl-9 font-normal"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[var(--bg-surface-secondary)] p-1" aria-label="Фильтр экипажей">
              {([
                ['all', 'Все'],
                ['active', 'На линии'],
                ['idle', 'Свободны'],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setDriverFilter(value)
                    setOrderPage(1)
                  }}
                  className={`min-w-0 whitespace-nowrap rounded-md px-2 py-2 text-[10px] font-medium transition-colors ${
                    driverFilter === value
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[640px] space-y-1.5 overflow-y-auto p-2.5">
            {filteredDrivers.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CircleUserRound className="mx-auto h-6 w-6 text-[var(--text-tertiary)]" strokeWidth={1.6} />
                <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Экипажи не найдены</p>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Измените запрос или фильтр</p>
              </div>
            ) : filteredDrivers.map(driver => {
              const isSelected = driver.id === effectiveSelectedDriverId
              const activeOrders = driver.orders.filter(order => order.status === 'delivery').length

              return (
                <button
                  type="button"
                  key={driver.id}
                  onClick={() => {
                    setSelectedDriverId(driver.id)
                    setOrderPage(1)
                  }}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : 'border-transparent hover:border-[var(--border-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-semibold ${isSelected ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'}`}>
                        {driver.fullName}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-secondary)]">
                        {driver.phone || 'Телефон не указан'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${
                      activeOrders > 0
                        ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                        : 'bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]'
                    }`}>
                      {activeOrders > 0 ? `${activeOrders} в пути` : 'Свободен'}
                    </span>
                  </div>
                  <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{driver.direction || 'Направление не указано'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
          {selectedDriver ? (
            <>
              <header className="border-b border-[var(--border-primary)] p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                        <UserRound className="h-5 w-5" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{selectedDriver.fullName}</h2>
                        <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Карточка экипажа и маршрутный лист</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 text-xs text-[var(--text-secondary)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
                      {selectedDriver.phone && (
                        <a href={`tel:${selectedDriver.phone}`} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-[var(--accent-primary)]">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="font-mono">{selectedDriver.phone}</span>
                        </a>
                      )}
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{selectedDriver.direction || 'Направление не указано'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:w-auto">
                    <div className="min-w-[112px] rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">В пути</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {selectedDriver.orders.filter(order => order.status === 'delivery').length}
                      </p>
                    </div>
                    <div className="min-w-[112px] rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Всего рейсов</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{selectedDriver.orders.length}</p>
                    </div>
                  </div>
                </div>
              </header>

              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Маршрутный лист</h3>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Текущие доставки и завершённые рейсы</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--bg-surface-secondary)] p-1" aria-label="Фильтр рейсов">
                    {([
                      ['all', 'Все'],
                      ['delivery', 'В пути'],
                      ['delivered', 'Доставлены'],
                    ] as const).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => {
                          setOrderFilter(value)
                          setOrderPage(1)
                        }}
                        className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-medium transition-colors ${
                          orderFilter === value
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleOrders.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-5 py-14 text-center">
                    <Route className="mx-auto h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                    <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">В этом разделе рейсов нет</p>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Назначенные заказы появятся здесь автоматически</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {visibleOrders.map(order => {
                      const isDelivered = order.status === 'delivered'
                      const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)

                      return (
                        <article key={order.id} className="overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                          <div className="flex flex-col gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{orderLabel(order)}</span>
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                              </span>
                              <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                                isDelivered
                                  ? 'bg-[var(--success-soft)] text-[var(--success)]'
                                  : 'bg-[var(--warning-soft)] text-[var(--warning)]'
                              }`}>
                                {isDelivered ? 'Доставлен' : 'В пути'}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-[var(--text-secondary)]">
                              <Package className="h-3.5 w-3.5" />
                              {order.items.length} {pluralizeRussian(order.items.length, 'позиция', 'позиции', 'позиций')} · {totalItems} шт.
                            </span>
                          </div>

                          <div className="p-4">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                              <div className="min-w-0 space-y-3">
                                <div>
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Получатель</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]">{order.client.fullName}</p>
                                  <a href={`tel:${order.client.primaryPhone}`} className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]">
                                    <Phone className="h-3 w-3" />
                                    {order.client.primaryPhone}
                                  </a>
                                </div>
                                <div>
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Адрес доставки</p>
                                  <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-5 text-[var(--text-secondary)]">
                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                                    <span>{order.deliveryAddress || 'Адрес не указан'}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="min-w-0 rounded-lg bg-[var(--bg-surface-secondary)] p-3">
                                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Состав заказа</p>
                                <div className="mt-2 space-y-2">
                                  {order.items.map(item => (
                                    <div key={item.id} className="flex min-w-0 items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.variant.product.name}</p>
                                        <p className="mt-0.5 truncate font-mono text-[9px] text-[var(--text-tertiary)]">SKU {item.variant.sku}</p>
                                      </div>
                                      <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-[var(--text-secondary)]">{item.quantity} шт.</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {order.comment && (
                              <div className="mt-3 rounded-lg border border-[var(--border-primary)] px-3 py-2.5 text-[10px] leading-5 text-[var(--text-secondary)]">
                                <span className="font-semibold text-[var(--text-primary)]">Комментарий: </span>
                                {order.comment}
                              </div>
                            )}

                            {!isDelivered && (
                              <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border-primary)] pt-3 sm:flex-row sm:justify-end">
                                <button
                                  type="button"
                                  onClick={() => openActionModal(order, 'warehouse')}
                                  className="erp-button-secondary inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Вернуть на склад
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openActionModal(order, 'delivered')}
                                  className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Отметить доставленным
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}

                {selectedOrders.length > ORDERS_PER_PAGE && (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-primary)] pt-4">
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      Показано {orderPageStart + 1}–{Math.min(orderPageStart + ORDERS_PER_PAGE, selectedOrders.length)} из {selectedOrders.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Предыдущая страница"
                        disabled={orderPage === 1}
                        onClick={() => setOrderPage(page => Math.max(1, page - 1))}
                        className="erp-button-secondary inline-flex h-8 w-8 items-center justify-center !p-0 disabled:opacity-40"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-12 text-center text-[10px] font-medium text-[var(--text-secondary)]">{orderPage} / {orderPageCount}</span>
                      <button
                        type="button"
                        aria-label="Следующая страница"
                        disabled={orderPage === orderPageCount}
                        onClick={() => setOrderPage(page => Math.min(orderPageCount, page + 1))}
                        className="erp-button-secondary inline-flex h-8 w-8 items-center justify-center !p-0 disabled:opacity-40"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="px-6 py-20 text-center">
              <CircleUserRound className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" strokeWidth={1.5} />
              <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Выберите экипаж</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Справа появится карточка и маршрутный лист</p>
            </div>
          )}
        </div>
      </section>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-3 backdrop-blur-xs sm:p-6" role="presentation" onMouseDown={event => event.target === event.currentTarget && closeCreateModal()}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-driver-title" className="max-h-[calc(100vh-24px)] w-full max-w-xl overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <UserRound className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 id="create-driver-title" className="text-sm font-semibold text-[var(--text-primary)]">Новый экипаж</h2>
                  <p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">Создайте профиль водителя и укажите рабочее направление</p>
                </div>
              </div>
              <button type="button" aria-label="Закрыть окно" onClick={closeCreateModal} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleCreateDriver}>
              <div className="space-y-4 p-5">
                {createError && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2.5 text-[11px] text-[var(--danger)]" role="alert">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {createError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">ФИО водителя</span>
                    <span className="relative block">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                      <input required autoFocus type="text" placeholder="Билал Дадаев" value={modalFullName} onChange={event => setModalFullName(event.target.value)} className="erp-input w-full !pl-9 font-normal" />
                    </span>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">Номер телефона</span>
                    <span className="relative block">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                      <input required type="tel" placeholder="+7 (928) 000-00-00" value={modalPhone} onChange={event => setModalPhone(event.target.value)} className="erp-input w-full !pl-9 font-mono" />
                    </span>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">Направление рейсов</span>
                    <span className="relative block">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                      <input type="text" placeholder="Дагестан, Чечня" value={modalDirection} onChange={event => setModalDirection(event.target.value)} className="erp-input w-full !pl-9 font-normal" />
                    </span>
                  </label>
                </div>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">Временный пароль</span>
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input required minLength={10} type="password" placeholder="Минимум 10 символов, буквы и цифры" value={modalPassword} onChange={event => setModalPassword(event.target.value)} className="erp-input w-full !pl-9 font-mono" />
                  </span>
                  <span className="block text-[9px] leading-4 text-[var(--text-tertiary)]">Водитель сможет заменить пароль после первого входа</span>
                </label>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-5 py-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeCreateModal} className="erp-button-secondary whitespace-nowrap">Отмена</button>
                <button type="submit" disabled={createLoading} className="erp-button-primary whitespace-nowrap disabled:opacity-50">
                  {createLoading ? 'Создание...' : 'Создать экипаж'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-3 backdrop-blur-xs sm:p-6" role="presentation" onMouseDown={event => event.target === event.currentTarget && closeActionModal()}>
          <section role="dialog" aria-modal="true" aria-labelledby="driver-action-title" className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activeAction.type === 'delivered' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
                  {activeAction.type === 'delivered' ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
                </span>
                <div className="min-w-0">
                  <h2 id="driver-action-title" className="text-sm font-semibold text-[var(--text-primary)]">
                    {activeAction.type === 'delivered' ? 'Подтвердить доставку' : 'Вернуть заказ на склад'}
                  </h2>
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{orderLabel(activeAction.order)} · {activeAction.order.client.fullName}</p>
                </div>
              </div>
              <button type="button" aria-label="Закрыть окно" onClick={closeActionModal} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleConfirmAction}>
              <div className="space-y-4 p-5">
                <div className="rounded-lg bg-[var(--bg-surface-secondary)] p-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {activeAction.type === 'delivered'
                    ? 'Заказ будет отмечен как доставленный и перемещён в историю рейсов.'
                    : 'Заказ будет снят с экипажа и возвращён на склад для повторной обработки.'}
                </div>

                {actionError && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2.5 text-[11px] text-[var(--danger)]" role="alert">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {actionError}
                  </div>
                )}

                <label className="space-y-1.5">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {activeAction.type === 'warehouse' ? 'Причина возврата' : 'Комментарий'}
                    {activeAction.type === 'warehouse' && <span className="text-[var(--danger)]"> *</span>}
                  </span>
                  <textarea
                    required={activeAction.type === 'warehouse'}
                    rows={4}
                    placeholder={activeAction.type === 'warehouse' ? 'Опишите причину возврата' : 'Добавьте комментарий при необходимости'}
                    value={actionComment}
                    onChange={event => setActionComment(event.target.value)}
                    className="erp-input min-h-24 w-full resize-y py-2.5 font-normal"
                  />
                </label>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-5 py-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeActionModal} className="erp-button-secondary whitespace-nowrap">Отмена</button>
                <button type="submit" disabled={actionLoading} className={`whitespace-nowrap disabled:opacity-50 ${activeAction.type === 'delivered' ? 'erp-button-primary' : 'erp-button-secondary text-[var(--danger)] hover:bg-[var(--danger-soft)]'}`}>
                  {actionLoading ? 'Сохранение...' : activeAction.type === 'delivered' ? 'Подтвердить доставку' : 'Вернуть на склад'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
