'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  createClientAction, 
  updateClientAction, 
  archiveClientAction 
} from './actions'
import { 
  Plus, 
  Search, 
  X, 
  Eye, 
  Trash2, 
  Calendar,
  User,
  ShoppingBag,
  MapPin
} from 'lucide-react'

interface ClientOrderItem {
  id: string
  number?: string | null
  status: string
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
  createdAt: Date | string
}

interface ClientWithCreator {
  id: string
  fullName: string
  primaryPhone: string
  additionalPhone: string | null
  region: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  source: string | null
  avitoAccount: string | null
  comment: string | null
  createdAt: Date | string
  creator: {
    fullName: string
  } | null
  orders: ClientOrderItem[]
}

interface ClientTableProps {
  initialClients: ClientWithCreator[]
}

// Статусы выведены через CSS-токены (.erp-badge[data-status])
const STATUSES: Record<string, { label: string }> = {
  pending: { label: 'Ожидает подтверждения' },
  confirmed: { label: 'Подтвержден' },
  production: { label: 'На производстве' },
  warehouse: { label: 'На складе' },
  awaiting_delivery: { label: 'Ожидает доставку' },
  delivery: { label: 'Доставляется' },
  delivered: { label: 'Доставлен' },
  cancelled: { label: 'Отменен' },
}

export default function ClientTable({ initialClients }: ClientTableProps) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientWithCreator[]>(initialClients)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [loading, setLoading] = useState<string | null>(null)

  // Состояния модалок
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'orders'>('info')

  // Выбранный клиент для просмотра/редактирования
  const [selectedClient, setSelectedClient] = useState<ClientWithCreator | null>(null)

  // Поля формы (создание/редактирование)
  const [formFullName, setFormFullName] = useState('')
  const [formPrimaryPhone, setFormPrimaryPhone] = useState('')
  const [formAdditionalPhone, setFormAdditionalPhone] = useState('')
  const [formRegion, setFormRegion] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPostalCode, setFormPostalCode] = useState('')
  const [formSource, setFormSource] = useState('Авито')
  const [formAvitoAccount, setFormAvitoAccount] = useState('')
  const [formComment, setFormComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Функция авто-форматирования телефона
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '')
    if (digits.length === 0) return ''
    
    const startIdx = (digits.startsWith('7') || digits.startsWith('8')) ? 1 : 0
    const mainDigits = digits.slice(startIdx)
    
    let formatted = '+7'
    if (mainDigits.length > 0) {
      formatted += ` (${mainDigits.slice(0, 3)}`
    }
    if (mainDigits.length > 3) {
      formatted += `) ${mainDigits.slice(3, 6)}`
    }
    if (mainDigits.length > 6) {
      formatted += `-${mainDigits.slice(6, 8)}`
    }
    if (mainDigits.length > 8) {
      formatted += `-${mainDigits.slice(8, 10)}`
    }
    return formatted
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'primary' | 'additional') => {
    const formatted = formatPhone(e.target.value)
    if (type === 'primary') {
      setFormPrimaryPhone(formatted)
    } else {
      setFormAdditionalPhone(formatted)
    }
  }

  // Сброс полей формы
  const resetForm = () => {
    setFormFullName('')
    setFormPrimaryPhone('')
    setFormAdditionalPhone('')
    setFormRegion('')
    setFormCity('')
    setFormAddress('')
    setFormPostalCode('')
    setFormSource('Авито')
    setFormAvitoAccount('')
    setFormComment('')
    setErrorMsg('')
  }

  const openAddModal = () => {
    resetForm()
    setAddModalOpen(true)
  }

  const openDetailsModal = (client: ClientWithCreator) => {
    setSelectedClient(client)
    setFormFullName(client.fullName)
    setFormPrimaryPhone(client.primaryPhone)
    setFormAdditionalPhone(client.additionalPhone || '')
    setFormRegion(client.region || '')
    setFormCity(client.city || '')
    setFormAddress(client.address || '')
    setFormPostalCode(client.postalCode || '')
    setFormSource(client.source || 'Авито')
    setFormAvitoAccount(client.avitoAccount || '')
    setFormComment(client.comment || '')
    setErrorMsg('')
    setActiveTab('info')
    setDetailsModalOpen(true)
  }

  // Создать клиента
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading('create')

    const result = await createClientAction({
      fullName: formFullName,
      primaryPhone: formPrimaryPhone,
      additionalPhone: formAdditionalPhone || null,
      region: formRegion || null,
      city: formCity || null,
      address: formAddress || null,
      postalCode: formPostalCode || null,
      source: formSource || null,
      avitoAccount: formAvitoAccount || null,
      comment: formComment || null,
    })

    setLoading(null)

    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setAddModalOpen(false)
      router.refresh()
    }
  }

  // Обновить клиента
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    setErrorMsg('')
    setLoading('update')

    const result = await updateClientAction(selectedClient.id, {
      fullName: formFullName,
      primaryPhone: formPrimaryPhone,
      additionalPhone: formAdditionalPhone || null,
      region: formRegion || null,
      city: formCity || null,
      address: formAddress || null,
      postalCode: formPostalCode || null,
      source: formSource || null,
      avitoAccount: formAvitoAccount || null,
      comment: formComment || null,
    })

    setLoading(null)

    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setDetailsModalOpen(false)
      router.refresh()
    }
  }

  // Архивировать клиента
  const handleArchive = async (clientId: string) => {
    if (!confirm('Вы уверены, что хотите перенести этого клиента в архив?')) return
    setLoading(clientId)

    const result = await archiveClientAction(clientId)
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      setClients(prev => prev.filter(c => c.id !== clientId))
    }
  }

  const [regionFilter, setRegionFilter] = useState('all')

  // Уникальные регионы
  const uniqueRegions = Array.from(
    new Set(clients.map(c => c.region).filter(Boolean) as string[])
  ).sort()

  // Статистика клиентов по регионам
  const regionCounts = clients.reduce((acc, c) => {
    const reg = c.region || 'Не указан'
    acc[reg] = (acc[reg] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Фильтрация клиентов
  const filteredClients = clients.filter(c => {
    const query = search.toLowerCase()
    const matchesSearch = 
      c.fullName.toLowerCase().includes(query) ||
      c.primaryPhone.includes(search) ||
      (c.city && c.city.toLowerCase().includes(query)) ||
      (c.region && c.region.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query))
    
    const matchesSource = sourceFilter === 'all' || c.source === sourceFilter
    const matchesRegion = regionFilter === 'all' || c.region === regionFilter

    return matchesSearch && matchesSource && matchesRegion
  })

  // Список доступных источников
  const sources = ['Авито', 'Сайт', 'Instagram', 'Рекомендация', 'Другое']

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
      {/* 1. Блок статистики по регионам */}
      <div className="erp-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            География клиентов по регионам ({uniqueRegions.length} регионов)
          </h3>
          {regionFilter !== 'all' && (
            <button
              onClick={() => setRegionFilter('all')}
              className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              Сбросить фильтр региона
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {topRegions.map(([reg, count]) => {
            const isActive = regionFilter === reg
            return (
              <button
                key={reg}
                onClick={() => setRegionFilter(isActive ? 'all' : reg)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-normal transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent-primary)] text-white font-medium'
                    : 'bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <span>{reg}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[var(--border-primary)] text-[var(--text-secondary)]'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Панель фильтров и поиска */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between erp-card p-4">
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Поиск по ФИО, телефону, региону, адресу..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="erp-input w-full !pl-9"
            />
          </div>

          {/* Фильтр по регионам */}
          <div className="w-full sm:w-52">
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="erp-input w-full font-medium"
            >
              <option value="all">Все регионы ({clients.length})</option>
              {uniqueRegions.map(r => (
                <option key={r} value={r}>
                  {r} ({regionCounts[r] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Фильтр по источнику */}
          <div className="w-full sm:w-44">
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="erp-input w-full font-normal"
            >
              <option value="all">Все источники</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Кнопка создания */}
        <button
          onClick={openAddModal}
          className="erp-button-primary inline-flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Добавить клиента
        </button>
      </div>

      {/* 3. Список клиентов */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Телефон</th>
                <th className="px-4 py-3">Регион и адрес</th>
                <th className="px-4 py-3">Источник</th>
                <th className="px-4 py-3">Менеджер</th>
                <th className="px-4 py-3">Дата создания</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-tertiary)] font-normal">
                    Клиенты не найдены
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-[var(--bg-table-row-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {client.fullName}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                      {client.primaryPhone}
                      {client.additionalPhone && (
                        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{client.additionalPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {client.region ? (
                        <span className="inline-flex items-center gap-1 font-normal text-[var(--text-primary)] bg-[var(--bg-surface-secondary)] px-2 py-0.5 rounded text-[10px] mb-1 border border-[var(--border-primary)]">
                          <MapPin className="h-2.5 w-2.5 text-[var(--accent-primary)]" />
                          {client.region}
                        </span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                      {client.address && (
                        <p className="text-[11px] text-[var(--text-secondary)] font-normal line-clamp-2" title={client.address}>
                          {client.address}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded bg-[var(--bg-surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border-primary)]">
                        {client.source || 'Не указан'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)]">
                      {client.creator?.fullName || 'Система'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-tertiary)]">
                      {new Date(client.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => openDetailsModal(client)}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                        title="Просмотр клиента"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(client.id)}
                        disabled={loading === client.id}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer disabled:opacity-50"
                        title="В архив"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно: Добавление клиента */}
      {addModalOpen && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content max-w-lg">
            <div className="erp-modal-header">
              <h3>Новый клиент</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 text-xs bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] font-medium rounded-md text-center">
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="erp-label">ФИО клиента *</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={e => setFormFullName(e.target.value)}
                    className="erp-input w-full"
                  />
                </div>

                <div>
                  <label className="erp-label">Основной телефон *</label>
                  <input
                    type="text"
                    required
                    placeholder="+7 (999) 123-45-67"
                    value={formPrimaryPhone}
                    onChange={e => handlePhoneChange(e, 'primary')}
                    className="erp-input w-full"
                  />
                </div>

                <div>
                  <label className="erp-label">Доп. телефон</label>
                  <input
                    type="text"
                    placeholder="+7 (999) 123-45-67"
                    value={formAdditionalPhone}
                    onChange={e => handlePhoneChange(e, 'additional')}
                    className="erp-input w-full"
                  />
                </div>

                <div>
                  <label className="erp-label">Регион</label>
                  <input
                    type="text"
                    value={formRegion}
                    onChange={e => setFormRegion(e.target.value)}
                    className="erp-input w-full"
                  />
                </div>

                <div>
                  <label className="erp-label">Город</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    className="erp-input w-full"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="erp-label">Адрес доставки</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    className="erp-input w-full"
                  />
                </div>

                <div>
                  <label className="erp-label">Индекс</label>
                  <input
                    type="text"
                    value={formPostalCode}
                    onChange={e => setFormPostalCode(e.target.value)}
                    className="erp-input w-full"
                  />
                </div>

                <div>
                  <label className="erp-label">Источник рекламы</label>
                  <select
                    value={formSource}
                    onChange={e => setFormSource(e.target.value)}
                    className="erp-input w-full"
                  >
                    {sources.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="erp-label">Аккаунт Авито (если применимо)</label>
                  <input
                    type="text"
                    value={formAvitoAccount}
                    onChange={e => setFormAvitoAccount(e.target.value)}
                    className="erp-input w-full"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="erp-label">Внутренний комментарий</label>
                  <textarea
                    value={formComment}
                    onChange={e => setFormComment(e.target.value)}
                    rows={3}
                    className="erp-input w-full resize-none"
                  />
                </div>
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="erp-button-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'create'}
                  className="erp-button-primary disabled:opacity-50"
                >
                  {loading === 'create' ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Детали и Редактирование клиента */}
      {detailsModalOpen && selectedClient && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content max-w-4xl max-h-[85vh] flex flex-col">
            <div className="erp-modal-header">
              <h3>Карточка клиента: {selectedClient.fullName}</h3>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Табы */}
            <div className="flex border-b border-border-main bg-slate-50/50 px-6">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 px-4 transition-colors cursor-pointer ${
                  activeTab === 'info' 
                    ? 'border-brand text-brand' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Информация
                </span>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 px-4 transition-colors cursor-pointer ${
                  activeTab === 'orders' 
                    ? 'border-brand text-brand' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  История заказов ({selectedClient.orders.length})
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'info' ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  {errorMsg && (
                    <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-600 font-bold rounded-lg text-center">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="erp-label">ФИО клиента *</label>
                      <input
                        type="text"
                        required
                        value={formFullName}
                        onChange={e => setFormFullName(e.target.value)}
                        className="erp-input w-full"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Основной телефон *</label>
                      <input
                        type="text"
                        required
                        value={formPrimaryPhone}
                        onChange={e => handlePhoneChange(e, 'primary')}
                        className="erp-input w-full"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Доп. телефон</label>
                      <input
                        type="text"
                        value={formAdditionalPhone}
                        onChange={e => handlePhoneChange(e, 'additional')}
                        className="erp-input w-full"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Регион</label>
                      <input
                        type="text"
                        value={formRegion}
                        onChange={e => setFormRegion(e.target.value)}
                        className="erp-input w-full"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Город</label>
                      <input
                        type="text"
                        value={formCity}
                        onChange={e => setFormCity(e.target.value)}
                        className="erp-input w-full"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="erp-label">Адрес доставки</label>
                      <input
                        type="text"
                        value={formAddress}
                        onChange={e => setFormAddress(e.target.value)}
                        className="erp-input w-full"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Индекс</label>
                      <input
                        type="text"
                        value={formPostalCode}
                        onChange={e => setFormPostalCode(e.target.value)}
                        className="erp-input w-full"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Источник рекламы</label>
                      <select
                        value={formSource}
                        onChange={e => setFormSource(e.target.value)}
                        className="erp-input w-full"
                      >
                        {sources.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="erp-label">Аккаунт Авито</label>
                      <input
                        type="text"
                        value={formAvitoAccount}
                        onChange={e => setFormAvitoAccount(e.target.value)}
                        className="erp-input w-full"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="erp-label">Внутренний комментарий</label>
                      <textarea
                        value={formComment}
                        onChange={e => setFormComment(e.target.value)}
                        rows={3}
                        className="erp-input w-full resize-none"
                      />
                    </div>
                  </div>

                  <div className="erp-modal-footer">
                    <button
                      type="button"
                      onClick={() => setDetailsModalOpen(false)}
                      className="erp-button-secondary"
                    >
                      Закрыть
                    </button>
                    <button
                      type="submit"
                      disabled={loading === 'update'}
                      className="erp-button-primary disabled:opacity-50"
                    >
                      {loading === 'update' ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {selectedClient.orders.length === 0 ? (
                    <div className="erp-empty-state">
                      <ShoppingBag />
                      <p>У этого клиента еще нет зарегистрированных заказов</p>
                    </div>
                  ) : (
                    <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th className="p-3 pl-4">Заказ ID</th>
                            <th className="p-3">Дата создания</th>
                            <th className="p-3">Сумма заказа</th>
                            <th className="p-3 pr-4">Статус выполнения</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClient.orders.map(order => {
                            const orderTotalCents = order.totalPrice + order.deliveryPrice + order.assemblyPrice - order.discount
                            return (
                              <tr key={order.id}>
                                <td className="p-3 pl-4 font-mono font-medium text-[var(--text-primary)]">
                                  {order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`}
                                </td>
                                <td className="p-3 text-[var(--text-tertiary)]">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                                  </span>
                                </td>
                                <td className="p-3 font-semibold text-[var(--text-primary)]">
                                  {(orderTotalCents / 100).toLocaleString('ru-RU')} ₽
                                </td>
                                <td className="p-3 pr-4">
                                  <span className="erp-badge" data-status={order.status}>
                                    {STATUSES[order.status]?.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
