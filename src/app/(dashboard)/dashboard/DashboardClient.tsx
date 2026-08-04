'use client'

import React, { useState, useMemo } from 'react'
import { 
  TrendingUp, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Clock,
  MapPin,
  Building2,
  ChevronDown,
  ChevronUp,
  Circle,
  BarChart2,
  Hash,
  Package,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
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
  latestOrders: any[]
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
function formatAction(action: string, entityType: string): string {
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

  const mskTopMax = mskProductStats[0]
    ? mskTopSort === 'orders'
      ? mskProductStats[0].orderCount
      : mskProductStats[0].totalUnits
    : 1

  return (
    <div className="space-y-5">

      {/* ── 1. Сводные показатели ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Выручка (доставленные)', value: `${stats.revenue.toLocaleString('ru-RU')} ₽`, icon: <TrendingUp className="h-4 w-4" /> },
          { label: 'Всего заказов',          value: stats.total,     icon: <ShoppingBag className="h-4 w-4" /> },
          { label: 'Доставлено',             value: stats.delivered, icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: 'Активных',               value: stats.active,    icon: <Clock className="h-4 w-4" /> },
          { label: 'Отменено',               value: stats.cancelled, icon: <XCircle className="h-4 w-4" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="erp-card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] truncate">{label}</p>
              <p className="text-lg font-semibold text-[var(--text-primary)] mt-0.5 truncate">{value}</p>
            </div>
            <div className="shrink-0 p-2 rounded-md bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]">
              {icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. Онлайн-участники + История действий ── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Онлайн-участники */}
        <div className="erp-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] flex items-center gap-2">
            <Circle className="h-2 w-2 fill-[var(--success)] text-[var(--success)] animate-pulse" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Сейчас онлайн
            </h3>
            <span className="ml-auto text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-surface-secondary)] px-1.5 py-0.5 rounded">
              {onlineUsers.length}
            </span>
          </div>

          {onlineUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-tertiary)]">
              Никого нет онлайн
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)] max-h-72 overflow-y-auto">
              {onlineUsers.map(u => (
                <div key={u.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="h-7 w-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[11px] font-semibold flex items-center justify-center">
                      {u.fullName.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--success)] border border-[var(--bg-surface)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{u.fullName}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{getRoleLabel(u.role)}</p>
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] shrink-0 font-mono">
                    {u.lastSeenAt ? timeAgo(u.lastSeenAt) : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* История действий */}
        <div className="erp-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)]">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              История действий
            </h3>
          </div>

          {auditLogs.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-tertiary)]">
              Действий пока нет
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)] max-h-72 overflow-y-auto">
              {auditLogs.map(log => (
                <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="shrink-0 h-5 w-5 rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)] text-[10px] font-semibold flex items-center justify-center mt-0.5">
                    {log.user?.fullName?.slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--text-primary)] leading-snug">
                      <span className="font-medium">{log.user?.fullName || 'Система'}</span>
                      {' '}
                      <span className="text-[var(--text-secondary)]">{formatAction(log.action, log.entityType)}</span>
                    </p>
                    {log.comment && (
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">{log.comment}</p>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] shrink-0 font-mono whitespace-nowrap">
                    {timeAgo(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Гео-аналитика: Москва и МО ── */}
      <div className="erp-card overflow-hidden">
        {/* Заголовок + переключатель периода */}
        <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 p-1.5 rounded bg-[var(--bg-surface-active)] text-[var(--text-secondary)]">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Москва и Московская область</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Автоматическое распределение по адресам</p>
            </div>
          </div>

          <div className="flex items-center self-start sm:self-center gap-px bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md p-0.5">
            {DATE_MODES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDateMode(key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  dateMode === key
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Контролы дат */}
        {(dateMode === 'single' || dateMode === 'range') && (
          <div className="px-4 py-3 bg-[var(--bg-surface-secondary)] border-b border-[var(--border-primary)] flex flex-wrap items-center gap-3 text-xs">
            {dateMode === 'single' && (
              <>
                <span className="text-[var(--text-tertiary)]">Дата:</span>
                <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="erp-input py-1 px-2 text-xs w-40" />
              </>
            )}
            {dateMode === 'range' && (
              <>
                <span className="text-[var(--text-tertiary)]">С:</span>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="erp-input py-1 px-2 text-xs w-40" />
                <span className="text-[var(--text-tertiary)]">По:</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="erp-input py-1 px-2 text-xs w-40" />
              </>
            )}
          </div>
        )}

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* МСК + МО */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Москва и МО</span>
                <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{geo.mskPct}%</span>
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <span className="text-2xl font-bold text-[var(--text-primary)]">{geo.mskCount}</span>
                  <span className="text-xs text-[var(--text-tertiary)] ml-1">заказов</span>
                </div>
                <div className="text-xs font-medium text-[var(--text-secondary)] pb-0.5">
                  {geo.mskRev.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-secondary)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500" style={{ width: `${geo.mskPct}%` }} />
              </div>
            </div>

            {/* Регионы */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Регионы РФ</span>
                <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{geo.regPct}%</span>
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <span className="text-2xl font-bold text-[var(--text-primary)]">{geo.regCount}</span>
                  <span className="text-xs text-[var(--text-tertiary)] ml-1">заказов</span>
                </div>
                <div className="text-xs font-medium text-[var(--text-secondary)] pb-0.5">
                  {geo.regRev.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-secondary)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--border-strong)] transition-all duration-500" style={{ width: `${geo.regPct}%` }} />
              </div>
            </div>
          </div>

          {/* Итого + список */}
          <div className="mt-5 pt-4 border-t border-[var(--border-primary)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">
              Итого за период: <strong className="text-[var(--text-secondary)] font-semibold">{geo.total} заказов</strong>
            </span>
            {geo.mskCount > 0 && (
              <button
                onClick={() => setShowOrderList(v => !v)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {showOrderList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showOrderList ? 'Свернуть' : `Список МСК/МО (${geo.mskCount})`}
              </button>
            )}
          </div>

          {showOrderList && geo.mskList.length > 0 && (
            <div className="mt-3 border border-[var(--border-primary)] rounded-md overflow-hidden">
              <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-primary)]">
                {geo.mskList.map(o => {
                  const num = o.number ? `№${o.number}` : `#${o.id.slice(-5)}`
                  const sumRub = (o.totalPrice - o.discount + o.deliveryPrice + o.assemblyPrice) / 100
                  const addr = o.deliveryAddress || o.client?.address || o.client?.city || ''
                  return (
                    <div key={o.id} className="px-3 py-2 flex items-center justify-between text-xs bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-mono font-semibold text-[var(--text-primary)]">{num}</span>
                        {addr && (
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{addr}</span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right pl-3">
                        <div className="font-semibold text-[var(--text-primary)]">{sumRub.toLocaleString('ru-RU')} ₽</div>
                        <div className="text-[10px] text-[var(--text-tertiary)] font-mono">
                          {new Date(o.createdAt).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. ТОП позиций по МСК/МО ── */}
      {mskProductStats.length > 0 && (
        <div className="erp-card overflow-hidden">
          {/* Заголовок */}
          <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="shrink-0 p-1.5 rounded bg-[var(--bg-surface-active)] text-[var(--text-secondary)]">
                <BarChart2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">ТОП позиций по МСК/МО</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {mskProductStats.length} уникальных {mskProductStats.length === 1 ? 'модель' : 'моделей'} в {geo.mskCount} {geo.mskCount === 1 ? 'заказе' : 'заказах'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {/* Сортировка */}
              <div className="flex items-center gap-px bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md p-0.5">
                {([
                  { key: 'orders' as MskTopSortKey, label: 'По заказам' },
                  { key: 'units'  as MskTopSortKey, label: 'По кол-ву' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMskTopSort(key)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      mskTopSort === key
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Свернуть/развернуть */}
              <button
                onClick={() => setMskTopExpanded(v => !v)}
                className="p-1.5 rounded border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-secondary)] transition-colors cursor-pointer"
                title={mskTopExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {mskTopExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {/* Экспорт в Google Sheets */}
              <button
                onClick={handleExportToSheets}
                disabled={sheetsExporting}
                title="Экспортировать топ МСК в Google Sheets"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded border border-[#1E8449]/40 bg-[#1E8449]/10 text-[#1E8449] hover:bg-[#1E8449]/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {sheetsExporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileSpreadsheet className="h-3.5 w-3.5" />}
                {sheetsExporting ? 'Экспорт…' : 'Google Sheets'}
              </button>
            </div>
          </div>

          {/* Уведомления об экспорте в Google Sheets */}
          {sheetsError && (
            <div className="mx-4 mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <span className="shrink-0">⚠️</span>
              <span>{sheetsError}</span>
              <button onClick={() => setSheetsError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600 cursor-pointer">✕</button>
            </div>
          )}
          {sheetsUrl && !sheetsError && (
            <div className="mx-4 mt-3 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
              <span>✅ Таблица обновлена!</span>
              <a
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 font-semibold underline hover:no-underline"
              >
                Открыть Google Sheets <ExternalLink className="h-3 w-3" />
              </a>
              <button onClick={() => setSheetsUrl(null)} className="shrink-0 text-green-400 hover:text-green-600 cursor-pointer">✕</button>
            </div>
          )}

          {mskTopExpanded && (
            <div className="overflow-x-auto">
              {/* Шапка таблицы */}
              <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(0,1fr)_140px_80px_80px] gap-x-4 px-4 py-2 bg-[var(--bg-table-header)] border-b border-[var(--border-primary)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                <span>Модель / SKU</span>
                <span className="hidden sm:block">Категория</span>
                <span className="text-right">Заказов</span>
                <span className="text-right">Единиц</span>
              </div>

              <div className="divide-y divide-[var(--border-primary)] max-h-[460px] overflow-y-auto">
                {mskProductStats.map((stat, idx) => {
                  const barValue = mskTopSort === 'orders' ? stat.orderCount : stat.totalUnits
                  const barPct = mskTopMax > 0 ? Math.round((barValue / mskTopMax) * 100) : 0

                  // Формируем читаемое описание варианта
                  const variantParts = [
                    stat.size     && `размер: ${stat.size}`,
                    stat.color    && `цвет: ${stat.color}`,
                    stat.material && `материал: ${stat.material}`,
                  ].filter(Boolean)

                  return (
                    <div
                      key={stat.key}
                      className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(0,1fr)_140px_80px_80px] gap-x-4 px-4 py-3 items-center hover:bg-[var(--bg-table-row-hover)] transition-colors"
                    >
                      {/* Название + SKU + прогресс-бар */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Номер в топе */}
                          <span className={`shrink-0 h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center ${
                            idx === 0 ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400' :
                            idx === 1 ? 'bg-slate-300/30 text-slate-500 dark:text-slate-400' :
                            idx === 2 ? 'bg-orange-300/20 text-orange-600 dark:text-orange-400' :
                            'bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{stat.productName}</p>
                            {variantParts.length > 0 && (
                              <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">{variantParts.join(' · ')}</p>
                            )}
                          </div>
                        </div>
                        {/* Прогресс-бар */}
                        <div className="mt-2 h-1 w-full rounded-full bg-[var(--bg-surface-secondary)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        {/* SKU под прогрессом — только мобильный */}
                        <p className="sm:hidden text-[10px] text-[var(--text-tertiary)] font-mono mt-1">{stat.sku} · {stat.categoryName}</p>
                      </div>

                      {/* Категория (десктоп) */}
                      <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                        <Package className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
                        <span className="text-[11px] text-[var(--text-secondary)] truncate">{stat.categoryName}</span>
                      </div>

                      {/* Заказов */}
                      <div className="text-right">
                        <span className={`text-sm font-bold ${
                          mskTopSort === 'orders' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                        }`}>
                          {stat.orderCount}
                        </span>
                      </div>

                      {/* Единиц */}
                      <div className="text-right">
                        <span className={`text-sm font-bold ${
                          mskTopSort === 'units' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                        }`}>
                          {stat.totalUnits}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Итого строка */}
              <div className="px-4 py-2.5 border-t border-[var(--border-primary)] bg-[var(--bg-table-header)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  <span>Итого позиций: <strong className="text-[var(--text-secondary)]">{mskProductStats.length}</strong></span>
                </div>
                <div className="flex items-center gap-4">
                  <span>Заказов: <strong className="text-[var(--text-secondary)]">{geo.mskCount}</strong></span>
                  <span>Единиц: <strong className="text-[var(--text-secondary)]">{mskProductStats.reduce((s, p) => s + p.totalUnits, 0)}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. Последние 5 заказов ── */}
      <div className="erp-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Последние заказы</h3>
        </div>
        <div className="divide-y divide-[var(--border-primary)]">
          {latestOrders.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-tertiary)]">Заказов пока нет</div>
          ) : (
            latestOrders.map(order => {
              const price = (order.totalPrice - order.discount + order.deliveryPrice + order.assemblyPrice) / 100
              const num = order.number ? `№${order.number}` : `#${order.id.slice(-6).toUpperCase()}`
              return (
                <div key={order.id} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-[var(--bg-table-row-hover)] transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text-primary)]">{num}</div>
                    <div className="text-[var(--text-tertiary)] text-[11px] truncate max-w-[200px] mt-0.5">{order.client?.fullName || '—'}</div>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <div className="font-semibold text-[var(--text-primary)]">{price.toLocaleString('ru-RU')} ₽</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
