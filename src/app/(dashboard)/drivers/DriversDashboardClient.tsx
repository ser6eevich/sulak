'use client'

import { useState } from 'react'
import { 
  createDriverAction, 
  completeDeliveryFromDriversAction, 
  returnToWarehouseFromDriversAction 
} from './actions'
import { 
  Search, 
  User, 
  Phone, 
  Plus, 
  X, 
  Truck, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  MapPin,
  ChevronRight,
  UserCheck,
  Check
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

export default function DriversDashboardClient({ drivers: initialDrivers, userRole }: DriversDashboardClientProps) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDrivers[0]?.id || '')
  const [search, setSearch] = useState('')

  // Создание нового водителя
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [modalFullName, setModalFullName] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [modalDirection, setModalDirection] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Попвер действий для конкретного заказа
  const [activeAction, setActiveAction] = useState<{ orderId: string; type: 'delivered' | 'warehouse' } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const selectedDriver = drivers.find(d => d.id === selectedDriverId)

  const filteredDrivers = drivers.filter(d => {
    const s = search.toLowerCase()
    return d.fullName.toLowerCase().includes(s) || (d.phone && d.phone.includes(s)) || (d.direction && d.direction.toLowerCase().includes(s))
  })

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalFullName || !modalPhone) return

    setCreateLoading(true)
    const result = await createDriverAction(
      modalFullName,
      modalPhone,
      modalDirection
    )
    setCreateLoading(false)

    if (result.error) {
      alert(result.error)
    } else if (result.success) {
      window.location.reload()
    }
  }

  const handleConfirmAction = async (orderId: string) => {
    if (!activeAction) return

    setActionLoading(true)
    let result
    if (activeAction.type === 'delivered') {
      result = await completeDeliveryFromDriversAction(orderId, actionComment)
    } else {
      result = await returnToWarehouseFromDriversAction(orderId, actionComment)
    }
    setActionLoading(false)

    if (result.error) {
      alert(result.error)
    } else {
      setActiveAction(null)
      setActionComment('')
      window.location.reload()
    }
  }

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-3 items-start min-w-0 max-w-full overflow-hidden">
      {/* Левая панель: Список водителей */}
      <div className="md:col-span-1 space-y-4 min-w-0 max-w-full">
        <div className="erp-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-[var(--accent-primary)]" />
              Экипажи водителей
            </h2>
            {['admin', 'owner'].includes(userRole) && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="erp-button-primary inline-flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить
              </button>
            )}
          </div>

          {/* Поиск водителей */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Поиск по ФИО, телефону..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="erp-input w-full !pl-9 font-normal"
            />
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--text-tertiary)] font-normal">
                Водители не найдены
              </div>
            ) : (
              filteredDrivers.map(driver => {
                const isSelected = driver.id === selectedDriverId
                const activeDeliveries = driver.orders.filter(o => o.status === 'delivery').length

                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer relative overflow-hidden flex items-center justify-between ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] shadow-sm'
                        : 'border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {/* Боковая вертикальная полоска для выбранного водителя */}
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent-primary)]" />
                    )}

                    <div className="space-y-1 min-w-0 pl-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-xs font-semibold truncate ${isSelected ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'}`}>
                          {driver.fullName}
                        </h4>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--accent-primary)] text-white shadow-xs">
                            <Check className="h-3 w-3 stroke-[3]" /> Выбран
                          </span>
                        )}
                      </div>

                      {driver.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-mono">
                          <Phone className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
                          <span>{driver.phone}</span>
                        </div>
                      )}
                      {driver.direction && (
                        <div className="flex items-center gap-1 text-[11px] text-[var(--accent-text)] font-medium">
                          <MapPin className="h-3 w-3 shrink-0 text-[var(--accent-primary)]" />
                          <span>Направление: {driver.direction}</span>
                        </div>
                      )}
                      <div className="text-[10px] font-medium text-[var(--text-tertiary)] flex items-center gap-1.5 pt-0.5">
                        <Truck className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span className={activeDeliveries > 0 ? 'font-semibold text-[var(--warning)]' : ''}>
                          {activeDeliveries} активных доставок
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-[var(--accent-primary)] translate-x-0.5' : 'text-[var(--text-tertiary)]'}`} />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Правая панель: Доставки выбранного водителя */}
      <div className="md:col-span-2 space-y-4 min-w-0 max-w-full overflow-hidden">
        {selectedDriver ? (
          <div className="erp-card p-4 space-y-5">
            {/* Хедер карточки водителя */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-primary)]">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <UserCheck className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                  {selectedDriver.fullName}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                  {selectedDriver.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5" /> {selectedDriver.phone}
                    </span>
                  )}
                  {selectedDriver.direction && (
                    <span className="flex items-center gap-1 text-[var(--accent-text)] font-normal">
                      <MapPin className="h-3.5 w-3.5" /> Направление: {selectedDriver.direction}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-[var(--bg-surface-secondary)] px-3.5 py-2 rounded-md border border-[var(--border-primary)] flex items-center gap-3">
                <div>
                  <span className="text-[9px] text-[var(--text-tertiary)] block font-medium uppercase tracking-wider">Всего в рейсе</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {selectedDriver.orders.length} заказов
                  </span>
                </div>
              </div>
            </div>

            {/* Маршрутный лист */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                Маршрутный лист и история выездов
              </h4>

              {selectedDriver.orders.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-tertiary)] text-xs border border-[var(--border-primary)] rounded-md bg-[var(--bg-surface-secondary)]">
                  У этого водителя нет активных и завершенных доставок
                </div>
              ) : (
                selectedDriver.orders.map(order => {
                  const shortId = order.id.slice(-6).toUpperCase()
                  const isActionActive = activeAction?.orderId === order.id
                  const isDelivered = order.status === 'delivered'

                  return (
                    <div 
                      key={order.id} 
                      className={`border rounded-md overflow-hidden flex flex-col transition-all ${
                        isDelivered 
                          ? 'border-[var(--success)]/30 bg-[var(--success-soft)]/20' 
                          : 'border-[var(--border-primary)] bg-[var(--bg-surface)]'
                      }`}
                    >
                      {/* Шапка карточки заказа */}
                      <div className="bg-[var(--bg-table-header)] px-3.5 py-2.5 border-b border-[var(--border-primary)] flex items-center justify-between text-xs">
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
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium border ${
                          isDelivered 
                            ? 'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/20' 
                            : 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/20'
                        }`}>
                          {isDelivered ? 'Доставлен' : 'В пути'}
                        </span>
                      </div>

                      {/* Детали заказа */}
                      <div className="p-4 space-y-3 text-xs">
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div>
                            <span className="text-[var(--text-tertiary)] font-medium block text-[9px] uppercase tracking-wider">Получатель</span>
                            <span className="font-medium text-[var(--text-primary)]">{order.client.fullName}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)] font-medium block text-[9px] uppercase tracking-wider">Телефоны</span>
                            <span className="font-mono text-[var(--text-secondary)]">{order.client.primaryPhone}</span>
                            {order.client.additionalPhone && (
                              <span className="font-mono text-[var(--text-tertiary)] block text-[10px] mt-0.5">{order.client.additionalPhone}</span>
                            )}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-[var(--text-tertiary)] font-medium block text-[9px] uppercase tracking-wider">Адрес доставки</span>
                            <span className="font-medium text-[var(--text-primary)] flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
                              {order.deliveryAddress || 'Адрес не указан'}
                            </span>
                          </div>
                          {order.comment && (
                            <div className="sm:col-span-2 bg-[var(--bg-surface-secondary)] p-2.5 rounded-md border border-[var(--border-primary)] text-[11px] text-[var(--text-secondary)]">
                              <span className="font-medium text-[var(--text-tertiary)] block text-[9px] uppercase tracking-wider mb-0.5">Комментарий менеджера</span>
                              {order.comment}
                            </div>
                          )}
                        </div>

                        {/* Изделия к доставке */}
                        <div className="border-t border-[var(--border-primary)] pt-2.5 space-y-1.5">
                          <span className="text-[var(--text-tertiary)] font-medium block text-[9px] uppercase tracking-wider">Изделия в заказе</span>
                          <div className="space-y-1">
                            {order.items.map(item => (
                              <div key={item.id} className="flex justify-between items-center text-xs">
                                <span className="font-normal text-[var(--text-primary)]">{item.variant.product.name} (SKU: {item.variant.sku})</span>
                                <span className="font-semibold text-[var(--accent-primary)]">{item.quantity} шт</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Кнопки завершения/возврата */}
                        {!isDelivered && (
                          <div className="pt-2 border-t border-[var(--border-primary)]">
                            {isActionActive ? (
                              <div className="space-y-2.5 bg-[var(--bg-surface-secondary)] p-3 rounded-md border border-[var(--border-primary)]">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                                    {activeAction.type === 'delivered' ? 'Подтверждение доставки' : 'Возврат заказа на склад'}
                                  </span>
                                  <button onClick={() => setActiveAction(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Комментарий водителя (необязательно)..."
                                  value={actionComment}
                                  onChange={e => setActionComment(e.target.value)}
                                  className="erp-input w-full font-normal"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleConfirmAction(order.id)}
                                    disabled={actionLoading}
                                    className="erp-button-primary flex-1 cursor-pointer disabled:opacity-50 text-xs"
                                  >
                                    {actionLoading ? 'Сохранение...' : 'Подтвердить'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setActiveAction({ orderId: order.id, type: 'delivered' })}
                                  className="erp-button-primary inline-flex items-center gap-1.5 cursor-pointer text-xs"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Доставлен
                                </button>
                                <button
                                  onClick={() => setActiveAction({ orderId: order.id, type: 'warehouse' })}
                                  className="erp-button-secondary inline-flex items-center gap-1.5 cursor-pointer text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" /> Вернуть на склад
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="erp-card p-12 text-center text-[var(--text-tertiary)] font-normal text-xs">
            Выберите водителя слева для просмотра маршрутного листа
          </div>
        )}
      </div>

      {/* Модальное окно добавления нового водителя */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] rounded-lg shadow-md w-full max-w-md overflow-hidden border border-[var(--border-primary)]">
            <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] px-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Новая карточка водителя</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreateDriver} className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">ФИО Водителя *</label>
                <input
                  type="text"
                  required
                  placeholder="Билал Дадаев"
                  value={modalFullName}
                  onChange={e => setModalFullName(e.target.value)}
                  className="erp-input w-full font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Номер телефона</label>
                <input
                  type="text"
                  placeholder="+7 (928) 000-00-00"
                  value={modalPhone}
                  onChange={e => setModalPhone(e.target.value)}
                  className="erp-input w-full font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Направление рейсов</label>
                <input
                  type="text"
                  placeholder="Дагестан / Чечня / Ингушетия"
                  value={modalDirection}
                  onChange={e => setModalDirection(e.target.value)}
                  className="erp-input w-full font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Пароль авторизации (по умолчанию 12345)</label>
                <input
                  type="password"
                  placeholder="12345"
                  value={modalPassword}
                  onChange={e => setModalPassword(e.target.value)}
                  className="erp-input w-full font-mono"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="erp-button-secondary flex-1 cursor-pointer">Отмена</button>
                <button type="submit" disabled={createLoading} className="erp-button-primary flex-1 cursor-pointer disabled:opacity-50">
                  {createLoading ? 'Сохранение...' : 'Создать водителя'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
