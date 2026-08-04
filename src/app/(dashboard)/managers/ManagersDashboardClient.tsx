'use client'

import { useState } from 'react'
import { createManagerAction, updateManagerTelegramAction } from './actions'
import { 
  Users, 
  Plus, 
  X, 
  Phone, 
  Mail, 
  TrendingUp, 
  ShoppingBag, 
  Calendar,
  ChevronRight,
  UserCheck,
  AtSign,
  Edit3,
  Check,
  RefreshCw
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

export default function ManagersDashboardClient({ initialManagers, userRole }: ManagersDashboardClientProps) {
  const [managers, setManagers] = useState<ManagerProfile[]>(initialManagers)
  const [selectedManagerId, setSelectedManagerId] = useState<string>(initialManagers[0]?.id || '')
  
  // Модалка создания менеджера
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFullName, setModalFullName] = useState('')
  const [modalEmail, setModalEmail] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [modalTelegram, setModalTelegram] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Редактирование тега Телеграм
  const [isEditingTag, setIsEditingTag] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [savingTag, setSavingTag] = useState(false)

  const selectedManager = managers.find(m => m.id === selectedManagerId)

  // Расчет общих метрик для выбранного менеджера
  const activeOrders = selectedManager?.sellerOrders.filter(o => o.status !== 'cancelled') || []
  const deliveredOrders = selectedManager?.sellerOrders.filter(o => o.status === 'delivered') || []
  
  const totalRevenueAll = activeOrders.reduce(
    (sum, o) => sum + (o.totalPrice - o.discount + o.deliveryPrice + o.assemblyPrice), 
    0
  ) / 100

  const deliveredRevenue = deliveredOrders.reduce(
    (sum, o) => sum + (o.totalPrice - o.discount + o.deliveryPrice + o.assemblyPrice), 
    0
  ) / 100

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalFullName || !modalEmail) return

    setLoading(true)
    const result = await createManagerAction(
      modalFullName,
      modalPhone,
      modalEmail,
      modalTelegram
    )
    setLoading(false)

    if (result.error) {
      alert(result.error)
    } else if (result.success) {
      window.location.reload()
    }
  }

  const handleSaveTelegramTag = async () => {
    if (!selectedManagerId) return

    setSavingTag(true)
    const result = await updateManagerTelegramAction(selectedManagerId, tagInput)
    setSavingTag(false)

    if (result.error) {
      alert(result.error)
    } else if (result.success) {
      const formattedTag = tagInput.trim() ? (tagInput.trim().startsWith('@') ? tagInput.trim() : `@${tagInput.trim()}`) : null
      setManagers(prev => prev.map(m => m.id === selectedManagerId ? { ...m, telegramUsername: formattedTag } : m))
      setIsEditingTag(false)
    }
  }

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-3 items-start min-w-0 max-w-full overflow-hidden">
      {/* Левая колонка: Список менеджеров */}
      <div className="md:col-span-1 space-y-4 min-w-0 max-w-full">
        <div className="erp-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[var(--accent-primary)]" />
              Список менеджеров
            </h2>
            {['admin', 'owner'].includes(userRole) && (
              <button
                onClick={() => setModalOpen(true)}
                className="erp-button-primary inline-flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {managers.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--text-tertiary)] font-normal">
                Менеджеры пока не добавлены
              </div>
            ) : (
              managers.map(manager => {
                const isSelected = manager.id === selectedManagerId
                const totalOrders = manager.sellerOrders.length
                const totalRevenue = manager.sellerOrders
                  .filter(o => o.status !== 'cancelled')
                  .reduce((sum, o) => sum + (o.totalPrice - o.discount + o.deliveryPrice + o.assemblyPrice), 0) / 100

                return (
                  <div
                    key={manager.id}
                    onClick={() => {
                      setSelectedManagerId(manager.id)
                      setIsEditingTag(false)
                      setTagInput(manager.telegramUsername || '')
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-2 border-[var(--accent-primary)] bg-[var(--accent-soft)] shadow-sm'
                        : 'border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="font-semibold text-xs text-[var(--text-primary)] truncate flex items-center gap-1.5">
                        {manager.fullName}
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[var(--accent-primary)] text-white">
                            <Check className="h-2.5 w-2.5" /> ВЫБРАН
                          </span>
                        )}
                        {manager.telegramUsername && (
                          <span className="text-[10px] text-[var(--accent-text)] font-mono">
                            {manager.telegramUsername}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-normal">
                        <span>Сделок: {totalOrders}</span>
                        {totalRevenue > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-[var(--accent-primary)] font-semibold">
                              {totalRevenue.toLocaleString('ru-RU')} ₽
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}`} />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Правая колонка: Продажи и детали выплат */}
      <div className="md:col-span-2 space-y-4 min-w-0 max-w-full overflow-hidden">
        {selectedManager ? (
          <div className="erp-card p-4 space-y-5">
            {/* Карточка-хедер менеджера */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-primary)]">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <UserCheck className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                  {selectedManager.fullName}
                </h3>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                  {selectedManager.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5 text-[var(--text-tertiary)]" /> {selectedManager.phone}
                    </span>
                  )}
                  {selectedManager.email && (
                    <span className="flex items-center gap-1 font-mono">
                      <Mail className="h-3.5 w-3.5 text-[var(--text-tertiary)]" /> {selectedManager.email}
                    </span>
                  )}
                </div>

                {/* Поле редактирования Telegram тега */}
                <div className="pt-1 flex items-center gap-2 text-xs">
                  <span className="font-medium text-[var(--text-tertiary)] flex items-center gap-1">
                    <AtSign className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Telegram tag:
                  </span>

                  {isEditingTag ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="@username"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        className="erp-input py-1 px-2 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSaveTelegramTag}
                        disabled={savingTag}
                        className="erp-button-primary py-1 px-2.5 text-[10px] cursor-pointer disabled:opacity-50"
                      >
                        {savingTag ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingTag(false)}
                        className="erp-button-secondary py-1 px-2 text-[10px] cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--accent-text)]">
                        {selectedManager.telegramUsername || 'Не привязан'}
                      </span>
                      {['admin', 'owner'].includes(userRole) && (
                        <button
                          type="button"
                          onClick={() => {
                            setTagInput(selectedManager.telegramUsername || '')
                            setIsEditingTag(true)
                          }}
                          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                          title="Редактировать Telegram tag"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Статистика продаж выбранного менеджера */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-[var(--bg-surface-secondary)] p-3.5 rounded-md border border-[var(--border-primary)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Общий объем продаж (все заказы)</p>
                  <h4 className="text-lg font-semibold text-[var(--text-primary)] mt-0.5">
                    {totalRevenueAll.toLocaleString('ru-RU')} ₽
                  </h4>
                  <p className="text-[10px] text-[var(--text-tertiary)] font-normal mt-0.5">Всего создано: {activeOrders.length} заказов</p>
                </div>
                <div className="h-8 w-8 rounded bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-[var(--bg-surface-secondary)] p-3.5 rounded-md border border-[var(--border-primary)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Фактически доставлено</p>
                  <h4 className="text-lg font-semibold text-[var(--success)] mt-0.5">
                    {deliveredRevenue.toLocaleString('ru-RU')} ₽
                  </h4>
                  <p className="text-[10px] text-[var(--text-tertiary)] font-normal mt-0.5">Вручено клиентам: {deliveredOrders.length} заказов</p>
                </div>
                <div className="h-8 w-8 rounded bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center font-medium">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Список последних сделок */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                История оформленных сделок ({selectedManager.sellerOrders.length})
              </h4>

              {selectedManager.sellerOrders.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-tertiary)] text-xs border border-[var(--border-primary)] rounded-md bg-[var(--bg-surface-secondary)]">
                  У этого менеджера пока нет привязанных заказов
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                          <th className="p-2.5 pl-4">ID заказа</th>
                          <th className="p-2.5">Дата</th>
                          <th className="p-2.5">Клиент</th>
                          <th className="p-2.5">Сумма</th>
                          <th className="p-2.5 text-right pr-4">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
                        {selectedManager.sellerOrders.map(order => {
                          const shortId = order.id.slice(-6).toUpperCase()
                          const price = (order.totalPrice - order.discount + order.deliveryPrice + order.assemblyPrice) / 100
                          return (
                            <tr key={order.id} className="hover:bg-[var(--bg-table-row-hover)] transition-colors">
                              <td className="p-2.5 pl-4 font-mono font-medium text-[var(--text-primary)]">
                                {order.number ? `№${order.number}` : `#${shortId}`}
                              </td>
                              <td className="p-2.5 text-[var(--text-tertiary)] font-normal">
                                {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                              </td>
                              <td className="p-2.5 font-medium text-[var(--text-primary)]">
                                {order.client.fullName}
                              </td>
                              <td className="p-2.5 font-semibold text-[var(--text-primary)]">
                                {price.toLocaleString('ru-RU')} ₽
                              </td>
                              <td className="p-2.5 text-right pr-4">
                                <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium border ${
                                  order.status === 'delivered'
                                    ? 'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/20'
                                    : order.status === 'cancelled'
                                      ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/20'
                                      : 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/20'
                                }`}>
                                  {order.status === 'delivered' ? 'Доставлен' : order.status === 'cancelled' ? 'Отменен' : 'В работе'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="erp-card p-12 text-center text-[var(--text-tertiary)] text-xs font-normal">
            Выберите менеджера из списка слева для детального анализа
          </div>
        )}
      </div>

      {/* Модальное окно добавления нового менеджера */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] rounded-lg shadow-md w-full max-w-md overflow-hidden border border-[var(--border-primary)]">
            <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] px-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Создание карточки менеджера</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer text-lg">&times;</button>
            </div>
            
            <form onSubmit={handleCreateManager} className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">ФИО Менеджера *</label>
                <input
                  type="text"
                  required
                  placeholder="Зоя Сидорова"
                  value={modalFullName}
                  onChange={e => setModalFullName(e.target.value)}
                  className="erp-input w-full font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Email или Логин авторизации *</label>
                <input
                  type="text"
                  required
                  placeholder="zoya@sulak.ru или zoya"
                  value={modalEmail}
                  onChange={e => setModalEmail(e.target.value)}
                  className="erp-input w-full font-mono"
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
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Telegram @username (для автоуведомлений)</label>
                <input
                  type="text"
                  placeholder="@zoya_sulak"
                  value={modalTelegram}
                  onChange={e => setModalTelegram(e.target.value)}
                  className="erp-input w-full font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Пароль (по умолчанию 12345)</label>
                <input
                  type="password"
                  placeholder="12345"
                  value={modalPassword}
                  onChange={e => setModalPassword(e.target.value)}
                  className="erp-input w-full font-mono"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="erp-button-secondary flex-1 cursor-pointer">Отмена</button>
                <button type="submit" disabled={loading} className="erp-button-primary flex-1 cursor-pointer disabled:opacity-50">
                  {loading ? 'Создание...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
