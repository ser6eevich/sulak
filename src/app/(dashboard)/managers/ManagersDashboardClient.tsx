'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createManagerAction, updateManagerTelegramAction } from './actions'
import {
  AlertCircle,
  AtSign,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Mail,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

interface Order {
  id: string
  number?: string | null
  status: string
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
  createdAt: Date | string
  client: {
    fullName: string
    primaryPhone: string
  }
}

interface ManagerProfile {
  id: string
  fullName: string
  email: string
  phone: string | null
  telegramUsername?: string | null
  sellerOrders: Order[]
}

interface ManagersDashboardClientProps {
  initialManagers: ManagerProfile[]
  userRole: string
}

type OrderStatusFilter = 'all' | 'active' | 'delivered' | 'cancelled'

const ORDERS_PER_PAGE = 8

function getOrderPrice(order: Order) {
  return (order.totalPrice - order.discount + order.deliveryPrice + order.assemblyPrice) / 100
}

function getOrderStatus(status: string) {
  if (status === 'delivered') {
    return {
      label: 'Доставлен',
      className: 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]',
    }
  }

  if (status === 'cancelled') {
    return {
      label: 'Отменён',
      className: 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]',
    }
  }

  return {
    label: 'В работе',
    className: 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]',
  }
}

export default function ManagersDashboardClient({ initialManagers, userRole }: ManagersDashboardClientProps) {
  const [managers, setManagers] = useState<ManagerProfile[]>(initialManagers)
  const [selectedManagerId, setSelectedManagerId] = useState(initialManagers[0]?.id || '')
  const [managerSearch, setManagerSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatus, setOrderStatus] = useState<OrderStatusFilter>('all')
  const [orderPage, setOrderPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalFullName, setModalFullName] = useState('')
  const [modalEmail, setModalEmail] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [modalTelegram, setModalTelegram] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [isEditingTag, setIsEditingTag] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [savingTag, setSavingTag] = useState(false)
  const [tagError, setTagError] = useState('')

  const canManage = ['admin', 'owner'].includes(userRole)
  const selectedManager = managers.find(manager => manager.id === selectedManagerId)

  const teamOrders = useMemo(() => managers.flatMap(manager => manager.sellerOrders), [managers])
  const teamActiveOrders = teamOrders.filter(order => order.status !== 'cancelled')
  const teamDeliveredOrders = teamOrders.filter(order => order.status === 'delivered')
  const teamRevenue = teamActiveOrders.reduce((sum, order) => sum + getOrderPrice(order), 0)

  const filteredManagers = useMemo(() => {
    const query = managerSearch.trim().toLowerCase()
    if (!query) return managers

    return managers.filter(manager =>
      manager.fullName.toLowerCase().includes(query)
      || manager.email.toLowerCase().includes(query)
      || manager.phone?.toLowerCase().includes(query)
      || manager.telegramUsername?.toLowerCase().includes(query)
    )
  }, [managerSearch, managers])

  const activeOrders = selectedManager?.sellerOrders.filter(order => order.status !== 'cancelled') || []
  const deliveredOrders = selectedManager?.sellerOrders.filter(order => order.status === 'delivered') || []
  const totalRevenueAll = activeOrders.reduce((sum, order) => sum + getOrderPrice(order), 0)
  const deliveredRevenue = deliveredOrders.reduce((sum, order) => sum + getOrderPrice(order), 0)

  const filteredOrders = selectedManager ? selectedManager.sellerOrders.filter(order => {
    const query = orderSearch.trim().toLowerCase()
    const matchesSearch = !query
      || order.number?.toLowerCase().includes(query)
      || order.id.toLowerCase().includes(query)
      || order.client.fullName.toLowerCase().includes(query)
      || order.client.primaryPhone.toLowerCase().includes(query)
    const matchesStatus = orderStatus === 'all'
      || (orderStatus === 'active' && order.status !== 'delivered' && order.status !== 'cancelled')
      || order.status === orderStatus

    return matchesSearch && matchesStatus
  }) : []

  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))
  const visibleOrders = filteredOrders.slice((orderPage - 1) * ORDERS_PER_PAGE, orderPage * ORDERS_PER_PAGE)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalOpen) setModalOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  const selectManager = (manager: ManagerProfile) => {
    setSelectedManagerId(manager.id)
    setOrderPage(1)
    setIsEditingTag(false)
    setTagError('')
    setTagInput(manager.telegramUsername || '')
  }

  const closeCreateModal = () => {
    if (loading) return
    setModalOpen(false)
    setCreateError('')
  }

  const handleCreateManager = async (event: FormEvent) => {
    event.preventDefault()
    if (!modalFullName.trim() || !modalEmail.trim() || !modalPhone.trim() || !modalPassword) return

    setLoading(true)
    setCreateError('')
    const result = await createManagerAction(
      modalFullName,
      modalPhone,
      modalEmail,
      modalTelegram,
      modalPassword
    )
    setLoading(false)

    if (result.error) {
      setCreateError(result.error)
    } else if (result.success) {
      window.location.reload()
    }
  }

  const handleSaveTelegramTag = async () => {
    if (!selectedManagerId) return

    setSavingTag(true)
    setTagError('')
    const result = await updateManagerTelegramAction(selectedManagerId, tagInput)
    setSavingTag(false)

    if (result.error) {
      setTagError(result.error)
    } else if (result.success) {
      const trimmedTag = tagInput.trim()
      const formattedTag = trimmedTag ? (trimmedTag.startsWith('@') ? trimmedTag : `@${trimmedTag}`) : null
      setManagers(previous => previous.map(manager =>
        manager.id === selectedManagerId ? { ...manager, telegramUsername: formattedTag } : manager
      ))
      setIsEditingTag(false)
    }
  }

  const summaryMetrics = [
    {
      label: 'Менеджеры',
      value: managers.length.toLocaleString('ru-RU'),
      note: 'В команде продаж',
      icon: UsersRound,
      iconClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
    },
    {
      label: 'Все сделки',
      value: teamOrders.length.toLocaleString('ru-RU'),
      note: 'За всё время',
      icon: ShoppingBag,
      iconClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
    },
    {
      label: 'Доставлено',
      value: teamDeliveredOrders.length.toLocaleString('ru-RU'),
      note: 'Заказов вручено',
      icon: PackageCheck,
      iconClass: 'bg-[var(--success-soft)] text-[var(--success)]',
    },
    {
      label: 'Объём продаж',
      value: `${teamRevenue.toLocaleString('ru-RU')} ₽`,
      note: 'Без отменённых заказов',
      icon: CircleDollarSign,
      iconClass: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    },
  ]

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка по команде менеджеров">
        {summaryMetrics.map(metric => (
          <div key={metric.label} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{metric.label}</p>
                <p className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{metric.value}</p>
                <p className="mt-1 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">{metric.note}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.iconClass}`}>
                <metric.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-4 min-[1200px]:grid-cols-[310px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
          <header className="border-b border-[var(--border-primary)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]">Менеджеры</h2>
                  <span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-1 text-[9px] font-semibold text-[var(--text-secondary)]">{managers.length}</span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Профили и результаты</p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить
                </button>
              )}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="search"
                aria-label="Поиск менеджера"
                placeholder="Имя, почта или Telegram"
                value={managerSearch}
                onChange={event => setManagerSearch(event.target.value)}
                className="erp-input w-full !pl-9 font-normal"
              />
            </div>
          </header>

          <div className="divide-y divide-[var(--border-primary)]">
            {filteredManagers.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <UserRound className="mx-auto h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Менеджеры не найдены</p>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Измените поисковый запрос</p>
              </div>
            ) : (
              filteredManagers.map(manager => {
                const isSelected = manager.id === selectedManagerId
                const managerActiveOrders = manager.sellerOrders.filter(order => order.status !== 'cancelled')
                const managerRevenue = managerActiveOrders.reduce((sum, order) => sum + getOrderPrice(order), 0)

                return (
                  <button
                    type="button"
                    key={manager.id}
                    aria-pressed={isSelected}
                    onClick={() => selectManager(manager)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-soft)]'
                        : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]'
                    }`}>
                      <UserRound className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">{manager.fullName}</span>
                      <span className="mt-1 flex items-center gap-2 text-[9px] text-[var(--text-tertiary)]">
                        <span className="whitespace-nowrap">{manager.sellerOrders.length} сделок</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate font-medium text-[var(--text-secondary)]">{managerRevenue.toLocaleString('ru-RU')} ₽</span>
                      </span>
                    </span>
                    <ChevronRight className={`h-4 w-4 shrink-0 ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}`} />
                  </button>
                )
              })
            )}
          </div>
        </section>

        {selectedManager ? (
          <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <header className="border-b border-[var(--border-primary)] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                    <UserRound className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{selectedManager.fullName}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-tertiary)]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-mono">{selectedManager.email}</span>
                      </span>
                      {selectedManager.phone && (
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="font-mono">{selectedManager.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 lg:min-w-[320px]">
                  {isEditingTag ? (
                    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-3">
                      <label className="block text-[10px] font-medium text-[var(--text-secondary)]" htmlFor="manager-telegram-tag">
                        Telegram для уведомлений
                      </label>
                      <div className="mt-2 flex flex-col gap-2 min-[520px]:flex-row">
                        <input
                          id="manager-telegram-tag"
                          type="text"
                          placeholder="@username"
                          value={tagInput}
                          onChange={event => setTagInput(event.target.value)}
                          className="erp-input min-w-0 flex-1 font-mono"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveTelegramTag}
                            disabled={savingTag}
                            className="erp-button-primary inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                          >
                            {savingTag ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Сохранить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingTag(false)
                              setTagError('')
                            }}
                            className="erp-button-secondary whitespace-nowrap"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                      {tagError && <p className="mt-2 text-[10px] text-[var(--danger)]" role="alert">{tagError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Telegram</p>
                        <p className="mt-1 truncate font-mono text-xs font-medium text-[var(--text-primary)]">{selectedManager.telegramUsername || 'Не привязан'}</p>
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setTagInput(selectedManager.telegramUsername || '')
                            setTagError('')
                            setIsEditingTag(true)
                          }}
                          className="erp-button-secondary inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Изменить
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="grid grid-cols-2 border-b border-[var(--border-primary)] lg:grid-cols-4">
              {[
                ['Активные заказы', `${activeOrders.length} шт.`],
                ['Доставлено', `${deliveredOrders.length} шт.`],
                ['Объём продаж', `${totalRevenueAll.toLocaleString('ru-RU')} ₽`],
                ['Доставлено на сумму', `${deliveredRevenue.toLocaleString('ru-RU')} ₽`],
              ].map(([label, value], index) => (
                <div key={label} className={`p-4 ${index % 2 === 0 ? 'border-r' : ''} border-[var(--border-primary)] lg:border-r ${index === 3 ? 'lg:border-r-0' : ''}`}>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</p>
                  <p className={`mt-2 whitespace-nowrap text-base font-semibold tracking-[-0.02em] ${index === 3 ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="border-b border-[var(--border-primary)] p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">История сделок</h3>
                    <span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-1 text-[9px] font-semibold text-[var(--text-secondary)]">{filteredOrders.length}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Заказы, оформленные выбранным менеджером</p>
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 sm:w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input
                      type="search"
                      aria-label="Поиск по сделкам"
                      placeholder="Заказ, клиент или телефон"
                      value={orderSearch}
                      onChange={event => {
                        setOrderSearch(event.target.value)
                        setOrderPage(1)
                      }}
                      className="erp-input w-full !pl-9 font-normal"
                    />
                  </div>
                  <div className="erp-scrollbar-hidden flex overflow-x-auto rounded-lg bg-[var(--bg-surface-secondary)] p-1" aria-label="Фильтр статуса сделок">
                    {([
                      ['all', 'Все'],
                      ['active', 'В работе'],
                      ['delivered', 'Доставлены'],
                      ['cancelled', 'Отменены'],
                    ] as const).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => {
                          setOrderStatus(value)
                          setOrderPage(1)
                        }}
                        className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-medium transition-colors ${
                          orderStatus === value
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {visibleOrders.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <ShoppingBag className="mx-auto h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Сделки не найдены</p>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Измените поиск или фильтр статуса</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[670px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        <th className="px-4 py-3">Заказ</th>
                        <th className="px-3 py-3">Дата</th>
                        <th className="px-3 py-3">Клиент</th>
                        <th className="px-3 py-3">Телефон</th>
                        <th className="px-3 py-3 text-right">Сумма</th>
                        <th className="px-4 py-3 text-right">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {visibleOrders.map(order => {
                        const status = getOrderStatus(order.status)
                        const orderNumber = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`

                        return (
                          <tr key={order.id} className="transition-colors hover:bg-[var(--bg-table-row-hover)]">
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-[var(--text-primary)]">{orderNumber}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-[var(--text-tertiary)]">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</td>
                            <td className="max-w-[180px] truncate px-3 py-3 font-medium text-[var(--text-primary)]">{order.client.fullName}</td>
                            <td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-[var(--text-tertiary)]">{order.client.primaryPhone}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[var(--text-primary)]">{getOrderPrice(order).toLocaleString('ru-RU')} ₽</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-medium ${status.className}`}>{status.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-[var(--border-primary)] md:hidden">
                  {visibleOrders.map(order => {
                    const status = getOrderStatus(order.status)
                    const orderNumber = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`

                    return (
                      <article key={order.id} className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold text-[var(--text-primary)]">Заказ {orderNumber}</p>
                            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
                          </div>
                          <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-medium ${status.className}`}>{status.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Клиент</p>
                            <p className="mt-1 truncate text-xs font-medium text-[var(--text-primary)]">{order.client.fullName}</p>
                            <p className="mt-1 truncate font-mono text-[9px] text-[var(--text-tertiary)]">{order.client.primaryPhone}</p>
                          </div>
                          <div className="rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Сумма</p>
                            <p className="mt-1 whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]">{getOrderPrice(order).toLocaleString('ru-RU')} ₽</p>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </>
            )}

            {filteredOrders.length > ORDERS_PER_PAGE && (
              <footer className="flex items-center justify-between gap-3 border-t border-[var(--border-primary)] px-4 py-3">
                <p className="whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">
                  {((orderPage - 1) * ORDERS_PER_PAGE) + 1}–{Math.min(orderPage * ORDERS_PER_PAGE, filteredOrders.length)} из {filteredOrders.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Предыдущая страница сделок"
                    onClick={() => setOrderPage(page => Math.max(1, page - 1))}
                    disabled={orderPage === 1}
                    className="erp-button-secondary flex h-8 w-8 items-center justify-center !p-0 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="whitespace-nowrap text-[10px] font-medium text-[var(--text-secondary)]">{orderPage} / {orderPageCount}</span>
                  <button
                    type="button"
                    aria-label="Следующая страница сделок"
                    onClick={() => setOrderPage(page => Math.min(orderPageCount, page + 1))}
                    disabled={orderPage === orderPageCount}
                    className="erp-button-secondary flex h-8 w-8 items-center justify-center !p-0 disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </footer>
            )}
          </section>
        ) : (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-5 py-16 text-center shadow-xs">
            <UserRound className="mx-auto h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.5} />
            <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Выберите менеджера</p>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Профиль и сделки появятся здесь</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-3 backdrop-blur-xs sm:p-6"
          onClick={event => {
            if (event.target === event.currentTarget) closeCreateModal()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-manager-title"
            className="flex max-h-[calc(100vh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <UserRound className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h2 id="create-manager-title" className="truncate text-sm font-semibold text-[var(--text-primary)]">Новый менеджер</h2>
                  <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Профиль и данные для входа</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Закрыть создание менеджера"
                onClick={closeCreateModal}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleCreateManager} className="min-h-0 overflow-y-auto">
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">ФИО менеджера *</span>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Имя и фамилия"
                    value={modalFullName}
                    onChange={event => setModalFullName(event.target.value)}
                    className="erp-input w-full font-normal"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">Email или логин *</span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="manager@sulak.ru"
                    value={modalEmail}
                    onChange={event => setModalEmail(event.target.value)}
                    className="erp-input w-full font-mono"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">Телефон *</span>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+7 (928) 000-00-00"
                    value={modalPhone}
                    onChange={event => setModalPhone(event.target.value)}
                    className="erp-input w-full font-mono"
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">Telegram для автоуведомлений</span>
                  <span className="relative block">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      placeholder="username"
                      value={modalTelegram}
                      onChange={event => setModalTelegram(event.target.value)}
                      className="erp-input w-full !pl-9 font-mono"
                    />
                  </span>
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">Временный пароль *</span>
                  <input
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    placeholder="Минимум 10 символов, буквы и цифры"
                    value={modalPassword}
                    onChange={event => setModalPassword(event.target.value)}
                    className="erp-input w-full font-mono"
                  />
                  <p className="text-[9px] text-[var(--text-tertiary)]">Менеджер использует его при первом входе в CRM</p>
                </label>

                {createError && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2.5 text-[10px] text-[var(--danger)] sm:col-span-2" role="alert">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {createError}
                  </div>
                )}
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={closeCreateModal} disabled={loading} className="erp-button-secondary whitespace-nowrap disabled:opacity-40">Отмена</button>
                <button type="submit" disabled={loading} className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                  {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? 'Создаём...' : 'Создать менеджера'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
