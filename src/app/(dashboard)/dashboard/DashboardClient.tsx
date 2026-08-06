'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  TrendingUp, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { isMoscowOrMoAddress } from '@/utils/address'
import { getRoleLabel } from '@/utils/roles'

interface AnalyticsOrderItem {
  quantity: number
  variant: {
    sku: string
    size: string | null
    color: string | null
    material: string | null
    product: {
      name: string
      category: { name: string }
    }
  }
}

interface AnalyticsOrder {
  id: string
  number?: string | null
  createdAt: Date | string
  status: string
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
  deliveryAddress: string | null
  client?: {
    fullName?: string | null
    region?: string | null
    city?: string | null
    address?: string | null
  } | null
  items?: AnalyticsOrderItem[]
}

type MskTopSortKey = 'orders' | 'units'

interface MskProductStat {
  key: string
  productName: string
  sku: string
  categoryName: string
  size: string | null
  color: string | null
  material: string | null
  orderCount: number
  totalUnits: number
}

interface OnlineUser {
  id: string
  fullName: string
  role: string
  lastSeenAt: Date | string | null
}

interface AuditLogEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  comment: string | null
  createdAt: Date | string
  user: { fullName: string; role: string } | null
}

interface DashboardClientProps {
  stats: {
    revenue: number
    total: number
    delivered: number
    cancelled: number
    active: number
  }
  latestOrders: AnalyticsOrder[]
  allOrders?: AnalyticsOrder[]
  onlineUsers?: OnlineUser[]
  auditLogs?: AuditLogEntry[]
}

type DateMode = 'all' | 'today' | 'yesterday' | 'single' | 'range'

const DATE_MODES: { key: DateMode; label: string }[] = [
  { key: 'all',       label: 'За всё время' },
  { key: 'today',     label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'single',    label: 'День' },
  { key: 'range',     label: 'Период' },
]

// Человекочитаемое название действия из audit-лога
function formatAction(action: string): string {
  const map: Record<string, string> = {
    create_order: 'Создал заказ',
    update_order: 'Обновил заказ',
    update_status: 'Сменил статус заказа',
    delete_order: 'Удалил заказ',
    create_client: 'Добавил клиента',
    update_client: 'Обновил клиента',
    delete_client: 'Удалил клиента',
    create_product: 'Добавил товар',
    update_product: 'Обновил товар',
    delete_product: 'Удалил товар',
    update_role: 'Изменил роль',
    update_status_logistic: 'Сменил статус (логистика)',
    add_feedback: 'Добавил отзыв',
  }
  return map[action] || action
}

// Относительное время («2 мин назад»)
function timeAgo(date: Date | string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU')
}

export default function DashboardClient({ 
  stats, 
  latestOrders,
  allOrders = [],
  onlineUsers = [],
  auditLogs = [],
}: DashboardClientProps) {
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [showOrderList, setShowOrderList] = useState<boolean>(false)
  const [mskTopSort, setMskTopSort] = useState<MskTopSortKey>('orders')
  const [mskTopExpanded, setMskTopExpanded] = useState<boolean>(true)
  const [sheetsExporting, setSheetsExporting] = useState(false)
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null)
  const [sheetsError, setSheetsError] = useState<string | null>(null)

  const handleExportToSheets = async () => {
    setSheetsExporting(true)
    setSheetsError(null)
    setSheetsUrl(null)
    try {
      const body: Record<string, string> = {}
      if (dateMode === 'range' && fromDate) body.dateFrom = fromDate
      if (dateMode === 'range' && toDate)   body.dateTo   = toDate
      const res = await fetch('/api/export/msk-top-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSheetsError(data.error || 'Ошибка экспорта')
      } else {
        setSheetsUrl(data.url)
        window.open(data.url, '_blank', 'noopener')
      }
    } catch {
      setSheetsError('Не удалось подключиться к серверу')
    } finally {
      setSheetsExporting(false)
    }
  }

  // Фильтрация заказов по периоду
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      const d = new Date(order.createdAt)
      const dStr = d.toISOString().slice(0, 10)

      if (dateMode === 'today') return dStr === new Date().toISOString().slice(0, 10)
      if (dateMode === 'yesterday') {
        const y = new Date(); y.setDate(y.getDate() - 1)
        return dStr === y.toISOString().slice(0, 10)
      }
      if (dateMode === 'single') return !singleDate || dStr === singleDate
      if (dateMode === 'range') {
        const t = d.getTime()
        if (fromDate && t < new Date(fromDate).setHours(0,0,0,0)) return false
        if (toDate  && t > new Date(toDate).setHours(23,59,59,999)) return false
        return true
      }
      return true
    })
  }, [allOrders, dateMode, singleDate, fromDate, toDate])

  // Гео-расчёт МСК/МО
  const geo = useMemo(() => {
    let mskCount = 0, mskRev = 0, regCount = 0, regRev = 0
    const mskList: AnalyticsOrder[] = []

    filteredOrders.forEach(o => {
      const isMsk = isMoscowOrMoAddress({
        region: o.client?.region, city: o.client?.city,
        address: o.client?.address, deliveryAddress: o.deliveryAddress,
      })
      const price = (o.totalPrice - o.discount + o.deliveryPrice + o.assemblyPrice) / 100
      if (isMsk) { mskCount++; mskRev += price; mskList.push(o) }
      else        { regCount++; regRev += price }
    })

    const total = filteredOrders.length
    const mskPct = total > 0 ? Math.round((mskCount / total) * 100) : 0
    return { mskCount, mskRev, mskPct, regCount, regRev, regPct: total > 0 ? 100 - mskPct : 0, total, mskList }
  }, [filteredOrders])

  // Агрегация топ-позиций по МСК/МО заказам
  const mskProductStats = useMemo<MskProductStat[]>(() => {
    const map = new Map<string, MskProductStat>()

    geo.mskList.forEach(order => {
      const items = order.items || []
      const seenInOrder = new Set<string>()

      items.forEach(item => {
        const v = item.variant
        // Уникальный ключ: SKU варианта
        const key = v.sku

        // Считаем заказы — не дважды для одного заказа
        const alreadyCountedInOrder = seenInOrder.has(key)
        seenInOrder.add(key)

        if (!map.has(key)) {
          map.set(key, {
            key,
            productName: v.product.name,
            sku: v.sku,
            categoryName: v.product.category.name,
            size: v.size,
            color: v.color,
            material: v.material,
            orderCount: 0,
            totalUnits: 0,
          })
        }

        const stat = map.get(key)!
        if (!alreadyCountedInOrder) stat.orderCount += 1
        stat.totalUnits += item.quantity
      })
    })

    const arr = Array.from(map.values())
    arr.sort((a, b) =>
      mskTopSort === 'orders'
        ? b.orderCount - a.orderCount || b.totalUnits - a.totalUnits
        : b.totalUnits - a.totalUnits || b.orderCount - a.orderCount
    )
    return arr
  }, [geo.mskList, mskTopSort])

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Выручка (доставленные)', value: `${stats.revenue.toLocaleString('ru-RU')} ₽`, icon: TrendingUp, tone: 'text-[var(--accent-primary)] bg-[var(--accent-soft)]' },
          { label: 'Всего заказов', value: stats.total, icon: ShoppingBag, tone: 'text-[var(--accent-primary)] bg-[var(--accent-soft)]' },
          { label: 'Доставлено', value: stats.delivered, icon: CheckCircle2, tone: 'text-[var(--success)] bg-[var(--success-soft)]' },
          { label: 'Активных', value: stats.active, icon: Clock, tone: 'text-[var(--accent-primary)] bg-[var(--accent-soft)]' },
          { label: 'Отменено', value: stats.cancelled, icon: XCircle, tone: 'text-[var(--danger)] bg-[var(--danger-soft)]' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="erp-card flex min-h-[94px] items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="line-clamp-2 text-[9px] font-medium uppercase leading-[1.35] tracking-[0.08em] text-[var(--text-tertiary)]">{label}</p>
              <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] text-[var(--text-primary)]">{value}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
          </article>
        ))}
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-12">
        <article className="erp-card overflow-hidden xl:col-span-5">
          <header className="space-y-4 border-b border-[var(--border-secondary)] px-5 py-5">
            <div>
              <h2 className="!text-[16px] !leading-5 font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Региональное распределение</h2>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Автоматическое распределение по адресам</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DATE_MODES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateMode(key)}
                  aria-pressed={dateMode === key}
                  className={`rounded-lg border px-3 py-2 text-[11px] font-medium whitespace-nowrap ${
                    dateMode === key
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          {(dateMode === 'single' || dateMode === 'range') && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-secondary)] bg-[var(--bg-table-header)] px-5 py-3 text-xs">
              {dateMode === 'single' ? (
                <input type="date" value={singleDate} onChange={event => setSingleDate(event.target.value)} className="erp-input w-40 py-2 text-xs" aria-label="Дата" />
              ) : (
                <>
                  <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="erp-input w-40 py-2 text-xs" aria-label="Дата начала" />
                  <span className="text-[var(--text-tertiary)]">—</span>
                  <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="erp-input w-40 py-2 text-xs" aria-label="Дата окончания" />
                </>
              )}
            </div>
          )}

          <div className="p-5">
            <div className="mb-6 flex h-3 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]" aria-label={`Москва и МО ${geo.mskPct}%, регионы ${geo.regPct}%`}>
              <div className="h-full bg-[var(--accent-primary)] transition-[width] duration-200" style={{ width: `${geo.mskPct}%` }} />
              <div className="h-full bg-[var(--data-teal)] transition-[width] duration-200" style={{ width: `${geo.regPct}%` }} />
            </div>

            <div className="divide-y divide-[var(--border-secondary)]">
              <div className="grid grid-cols-[1fr_auto] gap-5 py-4 first:pt-0">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Москва и МО</p>
                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{geo.mskCount} заказов</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--accent-primary)]">{geo.mskPct}%</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">{geo.mskRev.toLocaleString('ru-RU')} ₽</p>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--data-teal)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Регионы РФ</p>
                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{geo.regCount} заказов</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--data-teal)]">{geo.regPct}%</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">{geo.regRev.toLocaleString('ru-RU')} ₽</p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[var(--border-secondary)] pt-4">
              <span className="text-[11px] text-[var(--text-tertiary)]">Итого: <strong className="font-medium text-[var(--text-primary)]">{geo.total} заказов</strong></span>
              {geo.mskCount > 0 && (
                <button onClick={() => setShowOrderList(value => !value)} className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]">
                  {showOrderList ? 'Свернуть список' : `Список МСК/МО (${geo.mskCount})`}
                  {showOrderList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>

            {showOrderList && geo.mskList.length > 0 && (
              <div className="mt-4 max-h-52 overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-table-header)]">
                <div className="divide-y divide-[var(--border-secondary)]">
                  {geo.mskList.map(order => {
                    const number = order.number ? `№${order.number}` : `#${order.id.slice(-5)}`
                    const total = (order.totalPrice - order.discount + order.deliveryPrice + order.assemblyPrice) / 100
                    const address = order.deliveryAddress || order.client?.address || order.client?.city || ''
                    return (
                      <div key={order.id} className="flex items-center justify-between gap-3 px-3.5 py-3 text-xs hover:bg-[var(--bg-surface-hover)]">
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)]">{number}</p>
                          {address && <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[var(--text-tertiary)]"><MapPin className="h-3 w-3 shrink-0" />{address}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-medium text-[var(--text-primary)]">{total.toLocaleString('ru-RU')} ₽</p>
                          <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="erp-card overflow-hidden xl:col-span-7">
          <header className="flex flex-col gap-3 border-b border-[var(--border-secondary)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="shrink-0 sm:max-w-[210px]">
              <h2 className="!text-[16px] !leading-5 font-semibold tracking-[-0.02em] text-[var(--text-primary)]">ТОП позиций по МСК/МО</h2>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{mskProductStats.length} уникальных моделей в {geo.mskCount} заказах</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              <div className="flex rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-0.5">
                {([
                  { key: 'orders' as MskTopSortKey, label: 'По заказам' },
                  { key: 'units' as MskTopSortKey, label: 'По кол-ву' },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => setMskTopSort(key)} aria-pressed={mskTopSort === key} className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium ${mskTopSort === key ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => setMskTopExpanded(value => !value)} className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-2.5 text-[10px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
                {mskTopExpanded ? 'Свернуть' : 'Развернуть'}
                {mskTopExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button onClick={handleExportToSheets} disabled={sheetsExporting} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-2.5 text-[10px] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                {sheetsExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-[#16875d]" />}
                {sheetsExporting ? 'Экспорт…' : 'Google Sheets'}
              </button>
            </div>
          </header>

          {sheetsError && (
            <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /><span>{sheetsError}</span>
              <button onClick={() => setSheetsError(null)} className="ml-auto" aria-label="Закрыть сообщение"><XCircle className="h-4 w-4" /></button>
            </div>
          )}
          {sheetsUrl && !sheetsError && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" /><span>Таблица обновлена</span>
              <a href={sheetsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 font-medium">Открыть <ExternalLink className="h-3.5 w-3.5" /></a>
              <button onClick={() => setSheetsUrl(null)} aria-label="Закрыть сообщение"><XCircle className="h-4 w-4" /></button>
            </div>
          )}

          {mskTopExpanded ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[620px] grid-cols-[34px_minmax(0,1fr)_132px_68px_68px] gap-x-3 border-b border-[var(--border-secondary)] bg-[var(--bg-table-header)] px-5 py-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <span>#</span><span>Модель / SKU</span><span>Категория</span><span className="text-right">Заказов</span><span className="text-right">Единиц</span>
              </div>
              <div className="min-w-[620px] divide-y divide-[var(--border-secondary)]">
                {mskProductStats.slice(0, 5).map((stat, index) => {
                  const details = [stat.size, stat.color, stat.material].filter(Boolean).join(' · ')
                  return (
                    <div key={stat.key} className="grid grid-cols-[34px_minmax(0,1fr)_132px_68px_68px] items-center gap-x-3 px-5 py-2 hover:bg-[var(--bg-table-row-hover)]">
                      <span className="text-xs font-medium text-[var(--text-tertiary)]">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">{stat.productName}</p>
                        <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{details || stat.sku}</p>
                      </div>
                      <span className="truncate text-[11px] text-[var(--text-secondary)]">{stat.categoryName}</span>
                      <span className="text-right text-xs font-medium text-[var(--text-primary)]">{stat.orderCount}</span>
                      <span className="text-right text-xs font-medium text-[var(--text-primary)]">{stat.totalUnits}</span>
                    </div>
                  )
                })}
                {mskProductStats.length === 0 && <div className="px-5 py-16 text-center text-xs text-[var(--text-tertiary)]">Нет данных за выбранный период</div>}
              </div>
              {mskProductStats.length > 5 && (
                <div className="border-t border-[var(--border-secondary)] px-5 py-2.5">
                  <button className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-primary)]" onClick={() => setShowOrderList(true)}>
                    Показать все {mskProductStats.length}<ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-16 text-center text-xs text-[var(--text-tertiary)]">Таблица свернута</div>
          )}
        </article>
      </section>

      <section className="grid items-stretch gap-4 xl:grid-cols-12">
        <article className="erp-card min-h-[300px] overflow-hidden xl:col-span-3">
          <header className="flex items-center justify-between border-b border-[var(--border-secondary)] px-5 py-4">
            <h2 className="!text-[16px] !leading-5 font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Сейчас онлайн</h2>
            <span className="rounded-full bg-[var(--bg-surface-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">{onlineUsers.length}</span>
          </header>
          {onlineUsers.length === 0 ? (
            <div className="px-5 py-14 text-center text-xs text-[var(--text-tertiary)]">Никого нет онлайн</div>
          ) : (
            <div className="divide-y divide-[var(--border-secondary)]">
              {onlineUsers.slice(0, 6).map(user => (
                <div key={user.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-semibold text-white">{user.fullName.slice(0, 1).toUpperCase()}</div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--success)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">{user.fullName}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{getRoleLabel(user.role)}</p>
                  </div>
                  <span className="shrink-0 text-[9px] text-[var(--text-tertiary)]">{user.lastSeenAt ? timeAgo(user.lastSeenAt) : ''}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="erp-card min-h-[300px] overflow-hidden xl:col-span-5">
          <header className="border-b border-[var(--border-secondary)] px-5 py-4">
            <h2 className="!text-[16px] !leading-5 font-semibold tracking-[-0.02em] text-[var(--text-primary)]">История действий</h2>
          </header>
          {auditLogs.length === 0 ? (
            <div className="px-5 py-14 text-center text-xs text-[var(--text-tertiary)]">Действий пока нет</div>
          ) : (
            <div className="divide-y divide-[var(--border-secondary)]">
              {auditLogs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-secondary)] text-[10px] font-semibold text-[var(--text-secondary)]">{log.user?.fullName?.slice(0, 1).toUpperCase() || '?'}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[var(--text-primary)]"><span className="font-medium">{log.user?.fullName || 'Система'}</span> <span className="text-[var(--text-secondary)]">{formatAction(log.action)}</span></p>
                    {log.comment && <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{log.comment}</p>}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[9px] text-[var(--text-tertiary)]">{timeAgo(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="erp-card min-h-[300px] overflow-hidden xl:col-span-4">
          <header className="flex items-center justify-between border-b border-[var(--border-secondary)] px-5 py-4">
            <h2 className="!text-[16px] !leading-5 font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Последние заказы</h2>
            <Link href="/orders" className="text-[11px] font-medium text-[var(--accent-primary)]">Показать все</Link>
          </header>
          {latestOrders.length === 0 ? (
            <div className="px-5 py-14 text-center text-xs text-[var(--text-tertiary)]">Заказов пока нет</div>
          ) : (
            <div className="divide-y divide-[var(--border-secondary)]">
              {latestOrders.map(order => {
                const price = (order.totalPrice - order.discount + order.deliveryPrice + order.assemblyPrice) / 100
                const number = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
                return (
                  <div key={order.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2 text-xs hover:bg-[var(--bg-table-row-hover)]">
                    <span className="font-medium text-[var(--text-secondary)]">{number}</span>
                    <span className="truncate text-[var(--text-primary)]">{order.client?.fullName || '—'}</span>
                    <div className="text-right">
                      <p className="whitespace-nowrap font-medium text-[var(--text-primary)]">{price.toLocaleString('ru-RU')} ₽</p>
                      <p className="mt-1 text-[9px] text-[var(--text-tertiary)]">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="border-t border-[var(--border-secondary)] px-5 py-3">
            <Link href="/orders" className="flex items-center justify-between text-[11px] font-medium text-[var(--accent-primary)]">Перейти к реестру заказов <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </article>
      </section>
    </div>
  )
}
