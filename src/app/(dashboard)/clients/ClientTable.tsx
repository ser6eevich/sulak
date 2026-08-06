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
  Trash2, 
  Calendar,
  User,
  ShoppingBag,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Phone,
  PackageOpen,
  Pencil,
  History,
  UserRound,
  MapPinned,
  MessageSquareText
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

const PAGE_SIZE = 9

export default function ClientTable({ initialClients }: ClientTableProps) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientWithCreator[]>(initialClients)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState<string | null>(null)

  // Состояния модалок
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

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
    setIsEditing(false)
    setHistoryModalOpen(false)
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

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const visibleClients = filteredClients.slice(pageStart, pageStart + PAGE_SIZE)
  const visibleFrom = filteredClients.length === 0 ? 0 : pageStart + 1
  const visibleTo = Math.min(pageStart + PAGE_SIZE, filteredClients.length)

  const resetFilters = () => {
    setSearch('')
    setRegionFilter('all')
    setSourceFilter('all')
    setPage(1)
  }

  // Список доступных источников
  const sources = ['Авито', 'Сайт', 'Instagram', 'Рекомендация', 'Другое']

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
      <section className="erp-card px-4 py-3.5">
        <div className="flex flex-col gap-3 md:min-h-8 md:flex-row md:items-center md:justify-between">
          <div className="shrink-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">География клиентов</h2>
            <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{uniqueRegions.length} регионов в текущей базе</p>
          </div>

          <div className="erp-scrollbar-hidden flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto">
            {topRegions.map(([reg, count]) => {
              const isActive = regionFilter === reg

              return (
                <button
                  key={reg}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setRegionFilter(isActive ? 'all' : reg)
                    setPage(1)
                  }}
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="max-w-[130px] truncate">{reg}</span>
                  <span className={`rounded-md px-1.5 py-0.5 tabular-nums ${isActive ? 'bg-white/15' : 'bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setRegionFilter('all')
              setPage(1)
            }}
            disabled={regionFilter === 'all'}
            aria-hidden={regionFilter === 'all'}
            tabIndex={regionFilter === 'all' ? -1 : 0}
            className={`inline-flex min-h-8 w-[86px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[10px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)] ${
              regionFilter === 'all' ? 'invisible pointer-events-none' : ''
            }`}
          >
            <X className="h-3 w-3" />
            Сбросить
          </button>
        </div>
      </section>

      <section className="erp-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border-primary)] px-4 py-3.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1 xl:max-w-[460px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" strokeWidth={1.8} />
              <input
                type="search"
                aria-label="Поиск клиентов"
                placeholder="ФИО, телефон, регион или адрес"
                value={search}
                onChange={event => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="erp-input h-10 w-full !rounded-xl !pl-10 !pr-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  aria-label="Очистить поиск"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              aria-label="Фильтр по региону"
              value={regionFilter}
              onChange={event => {
                setRegionFilter(event.target.value)
                setPage(1)
              }}
              className="erp-input h-10 w-full !rounded-xl md:w-52"
            >
              <option value="all">Все регионы ({clients.length})</option>
              {uniqueRegions.map(region => (
                <option key={region} value={region}>{region} ({regionCounts[region] || 0})</option>
              ))}
            </select>

            <select
              aria-label="Фильтр по источнику"
              value={sourceFilter}
              onChange={event => {
                setSourceFilter(event.target.value)
                setPage(1)
              }}
              className="erp-input h-10 w-full !rounded-xl md:w-44"
            >
              <option value="all">Все источники</option>
              {sources.map(source => <option key={source} value={source}>{source}</option>)}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!search && regionFilter === 'all' && sourceFilter === 'all'}
              aria-hidden={!search && regionFilter === 'all' && sourceFilter === 'all'}
              tabIndex={!search && regionFilter === 'all' && sourceFilter === 'all' ? -1 : 0}
              className={`erp-button-secondary inline-flex min-h-10 w-24 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap !rounded-xl ${
                !search && regionFilter === 'all' && sourceFilter === 'all' ? 'invisible pointer-events-none' : ''
              }`}
            >
              <X className="h-3.5 w-3.5" />
              Очистить
            </button>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="erp-button-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap !rounded-xl"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Добавить клиента
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-primary)] bg-[var(--bg-surface-hover)]/45 px-4 py-2 text-[10px] text-[var(--text-tertiary)]">
          <span>Найдено: <strong className="font-medium text-[var(--text-secondary)]">{filteredClients.length}</strong></span>
          <span>Показаны {visibleFrom}–{visibleTo}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                <th className="px-4 py-2.5">Клиент</th>
                <th className="px-4 py-2.5">Телефон</th>
                <th className="px-4 py-2.5">Регион и адрес</th>
                <th className="px-4 py-2.5 text-center">Заказы</th>
                <th className="px-4 py-2.5">Менеджер</th>
                <th className="px-4 py-2.5">Создан</th>
                <th className="px-4 py-2.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)] font-normal text-[var(--text-primary)]">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]">
                        <PackageOpen className="h-[18px] w-[18px]" strokeWidth={1.6} />
                      </div>
                      <p className="mt-3 text-xs font-medium text-[var(--text-primary)]">Клиенты не найдены</p>
                      <button type="button" onClick={resetFilters} className="mt-1 text-[10px] text-[var(--accent-primary)] hover:underline">Сбросить фильтры</button>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleClients.map(client => (
                  <tr
                    key={client.id}
                    tabIndex={0}
                    aria-label={`Открыть карточку клиента ${client.fullName}`}
                    onClick={() => openDetailsModal(client)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openDetailsModal(client)
                      }
                    }}
                    className="cursor-pointer transition-colors hover:bg-[var(--bg-table-row-hover)] focus-visible:bg-[var(--accent-soft)] focus-visible:outline-none"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                          <User className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate text-[11px] font-medium text-[var(--text-primary)]">{client.fullName}</p>
                          <span className="mt-0.5 inline-flex rounded-md bg-[var(--bg-surface-hover)] px-1.5 py-0.5 text-[9px] text-[var(--text-tertiary)]">
                            {client.source || 'Источник не указан'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-[var(--text-secondary)]">
                      <a href={`tel:${client.primaryPhone}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--accent-primary)]">
                        <Phone className="h-3 w-3" strokeWidth={1.8} />
                        {client.primaryPhone}
                      </a>
                      {client.additionalPhone && (
                        <div className="mt-1 pl-[18px] text-[9px] text-[var(--text-tertiary)]">{client.additionalPhone}</div>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-2.5">
                      {client.region ? (
                        <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent-text)]">
                          <MapPin className="h-2.5 w-2.5 text-[var(--accent-primary)]" />
                          {client.region}
                        </span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                      {client.address && (
                        <p className="line-clamp-1 max-w-[300px] text-[10px] font-normal text-[var(--text-secondary)]" title={client.address}>
                          {client.address}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-hover)] px-2 py-1 text-[10px] font-medium tabular-nums text-[var(--text-secondary)]">
                        {client.orders.length}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">
                      {client.creator?.fullName || 'Система'}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                      {new Date(client.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          handleArchive(client.id)
                        }}
                        disabled={loading === client.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                        title="В архив"
                        aria-label={`Архивировать клиента ${client.fullName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border-primary)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            Страница <strong className="font-medium text-[var(--text-secondary)]">{currentPage}</strong> из {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              aria-label="Предыдущая страница"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-14 text-center text-[10px] tabular-nums text-[var(--text-secondary)]">{visibleFrom}–{visibleTo}</span>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              aria-label="Следующая страница"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Модальное окно: Добавление клиента */}
      {addModalOpen && (
        <div className="erp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-client-title">
          <div className="erp-modal-content max-w-lg">
            <div className="erp-modal-header">
              <h3 id="add-client-title">Новый клиент</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Закрыть форму добавления клиента"
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

      {/* Карточка клиента: просмотр по умолчанию, редактирование — отдельное действие */}
      {detailsModalOpen && selectedClient && (
        <div className="erp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="client-details-title">
          <div className="erp-modal-content flex max-h-[90vh] max-w-5xl flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-primary)]">
                  {selectedClient.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'К'}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id="client-details-title" className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                      {selectedClient.fullName}
                    </h3>
                    {selectedClient.source && <span className="erp-badge">{selectedClient.source}</span>}
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                    Клиент с {new Date(selectedClient.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isEditing && (
                  <button type="button" onClick={() => setIsEditing(true)} aria-label="Редактировать данные клиента" className="erp-button-secondary inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Редактировать</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  aria-label="Закрыть карточку клиента"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isEditing ? (
                <form onSubmit={handleUpdate} className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Редактирование данных</p>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Изменения будут применены только после сохранения.</p>
                  </div>

                  {errorMsg && (
                    <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-3 text-center text-xs font-medium text-[var(--danger)]">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="erp-label">ФИО клиента *</label>
                      <input type="text" required value={formFullName} onChange={e => setFormFullName(e.target.value)} className="erp-input w-full" />
                    </div>
                    <div>
                      <label className="erp-label">Основной телефон *</label>
                      <input type="text" required value={formPrimaryPhone} onChange={e => handlePhoneChange(e, 'primary')} className="erp-input w-full" />
                    </div>
                    <div>
                      <label className="erp-label">Доп. телефон</label>
                      <input type="text" value={formAdditionalPhone} onChange={e => handlePhoneChange(e, 'additional')} className="erp-input w-full" />
                    </div>
                    <div>
                      <label className="erp-label">Регион</label>
                      <input type="text" value={formRegion} onChange={e => setFormRegion(e.target.value)} className="erp-input w-full" />
                    </div>
                    <div>
                      <label className="erp-label">Город</label>
                      <input type="text" value={formCity} onChange={e => setFormCity(e.target.value)} className="erp-input w-full" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="erp-label">Адрес доставки</label>
                      <input type="text" value={formAddress} onChange={e => setFormAddress(e.target.value)} className="erp-input w-full" />
                    </div>
                    <div>
                      <label className="erp-label">Индекс</label>
                      <input type="text" value={formPostalCode} onChange={e => setFormPostalCode(e.target.value)} className="erp-input w-full" />
                    </div>
                    <div>
                      <label className="erp-label">Источник рекламы</label>
                      <select value={formSource} onChange={e => setFormSource(e.target.value)} className="erp-input w-full">
                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="erp-label">Аккаунт Авито</label>
                      <input type="text" value={formAvitoAccount} onChange={e => setFormAvitoAccount(e.target.value)} className="erp-input w-full" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="erp-label">Внутренний комментарий</label>
                      <textarea value={formComment} onChange={e => setFormComment(e.target.value)} rows={3} className="erp-input w-full resize-none" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-[var(--border-primary)] pt-4">
                    <button type="button" onClick={() => openDetailsModal(selectedClient)} className="erp-button-secondary">Отмена</button>
                    <button type="submit" disabled={loading === 'update'} className="erp-button-primary disabled:opacity-50">
                      {loading === 'update' ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <div className="space-y-4">
                    <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-[var(--accent-primary)]" />
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Контактная информация</h4>
                      </div>
                      <dl className="divide-y divide-[var(--border-primary)]">
                        <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[120px_1fr]">
                          <dt className="text-[10px] text-[var(--text-tertiary)]">Основной телефон</dt>
                          <dd><a href={`tel:${selectedClient.primaryPhone}`} className="text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]">{selectedClient.primaryPhone}</a></dd>
                        </div>
                        {selectedClient.additionalPhone && (
                          <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr]">
                            <dt className="text-[10px] text-[var(--text-tertiary)]">Доп. телефон</dt>
                            <dd><a href={`tel:${selectedClient.additionalPhone}`} className="text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]">{selectedClient.additionalPhone}</a></dd>
                          </div>
                        )}
                        <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr]">
                          <dt className="text-[10px] text-[var(--text-tertiary)]">Источник</dt>
                          <dd className="text-xs font-medium text-[var(--text-primary)]">{selectedClient.source || 'Не указан'}</dd>
                        </div>
                        {selectedClient.avitoAccount && (
                          <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[120px_1fr]">
                            <dt className="text-[10px] text-[var(--text-tertiary)]">Аккаунт Авито</dt>
                            <dd className="break-words text-xs font-medium text-[var(--text-primary)]">{selectedClient.avitoAccount}</dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <MapPinned className="h-4 w-4 text-[var(--accent-primary)]" />
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Адрес и ответственность</h4>
                      </div>
                      <dl className="divide-y divide-[var(--border-primary)]">
                        <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[120px_1fr]">
                          <dt className="text-[10px] text-[var(--text-tertiary)]">Регион / город</dt>
                          <dd className="text-xs font-medium text-[var(--text-primary)]">{[selectedClient.region, selectedClient.city].filter(Boolean).join(', ') || 'Не указаны'}</dd>
                        </div>
                        <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr]">
                          <dt className="text-[10px] text-[var(--text-tertiary)]">Адрес</dt>
                          <dd className="text-xs font-medium leading-relaxed text-[var(--text-primary)]">{selectedClient.address || 'Не указан'}</dd>
                        </div>
                        <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr]">
                          <dt className="text-[10px] text-[var(--text-tertiary)]">Индекс</dt>
                          <dd className="text-xs font-medium text-[var(--text-primary)]">{selectedClient.postalCode || 'Не указан'}</dd>
                        </div>
                        <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[120px_1fr]">
                          <dt className="text-[10px] text-[var(--text-tertiary)]">Добавил</dt>
                          <dd className="text-xs font-medium text-[var(--text-primary)]">{selectedClient.creator?.fullName || 'Не указан'}</dd>
                        </div>
                      </dl>
                    </section>

                    {selectedClient.comment && (
                      <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-table-header)] p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <MessageSquareText className="h-4 w-4 text-[var(--text-tertiary)]" />
                          <h4 className="text-xs font-semibold text-[var(--text-primary)]">Внутренний комментарий</h4>
                        </div>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{selectedClient.comment}</p>
                      </section>
                    )}
                  </div>

                  <section className="self-start overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-[var(--accent-primary)]" />
                          <h4 className="text-xs font-semibold text-[var(--text-primary)]">История заказов</h4>
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Всего заказов: {selectedClient.orders.length}</p>
                      </div>
                      {selectedClient.orders.length > 3 && (
                        <button type="button" onClick={() => setHistoryModalOpen(true)} className="erp-button-secondary">
                          Вся история
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {selectedClient.orders.length === 0 ? (
                      <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-table-header)] text-[var(--text-tertiary)]">
                          <ShoppingBag className="h-4 w-4" />
                        </div>
                        <p className="mt-3 text-xs font-medium text-[var(--text-primary)]">Заказов пока нет</p>
                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">История появится после создания первого заказа.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--border-primary)]">
                        {selectedClient.orders.slice(0, 3).map(order => {
                          const orderTotalCents = order.totalPrice + order.deliveryPrice + order.assemblyPrice - order.discount
                          return (
                            <article key={order.id} className="p-4 transition-colors hover:bg-[var(--bg-surface-hover)]">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                                    {order.number ? `Заказ №${order.number}` : `Заказ #${order.id.slice(-6).toUpperCase()}`}
                                  </p>
                                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                                  </p>
                                </div>
                                <span className="erp-badge" data-status={order.status}>{STATUSES[order.status]?.label || order.status}</span>
                              </div>
                              <p className="mt-4 text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                                {(orderTotalCents / 100).toLocaleString('ru-RU')} ₽
                              </p>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Полная история открывается отдельным слоем поверх карточки клиента */}
      {historyModalOpen && selectedClient && (
        <div className="erp-modal-overlay z-[70]" role="dialog" aria-modal="true" aria-labelledby="client-history-title">
          <div className="erp-modal-content flex max-h-[82vh] max-w-3xl flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4">
              <div>
                <h3 id="client-history-title" className="text-sm font-semibold text-[var(--text-primary)]">История заказов</h3>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{selectedClient.fullName} · {selectedClient.orders.length} заказов</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                aria-label="Закрыть историю заказов"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto">
              <table className="erp-table min-w-[620px]">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Дата</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClient.orders.map(order => {
                    const orderTotalCents = order.totalPrice + order.deliveryPrice + order.assemblyPrice - order.discount
                    return (
                      <tr key={order.id}>
                        <td className="font-mono font-medium text-[var(--text-primary)]">{order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`}</td>
                        <td><span className="flex items-center gap-1.5 text-[var(--text-secondary)]"><Calendar className="h-3.5 w-3.5" />{new Date(order.createdAt).toLocaleDateString('ru-RU')}</span></td>
                        <td className="font-semibold tabular-nums text-[var(--text-primary)]">{(orderTotalCents / 100).toLocaleString('ru-RU')} ₽</td>
                        <td><span className="erp-badge" data-status={order.status}>{STATUSES[order.status]?.label || order.status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
