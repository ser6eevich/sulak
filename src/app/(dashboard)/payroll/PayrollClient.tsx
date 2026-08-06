'use client'

import { useState, useMemo, useEffect } from 'react'
import { getPayrollDataAction } from './actions'
import { generatePayrollPeriods } from '@/utils/payroll'
import {
  AlertCircle,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  MessageSquare,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  WalletCards,
  X
} from 'lucide-react'

interface ManagerReport {
  manager: {
    id: string
    fullName: string
    email: string
  }
  metrics: {
    totalOrdersCount: number
    currentRate: number
    currentDeliveredCount: number
    currentDeliveriesSum: number
    pastDeliveredCount: number
    pastDeliveriesSum: number
    feedbackBonusCount: number
    feedbackBonusSum: number
    totalPayout: number
    totalCreatedCount?: number
    cancelledCount?: number
  }
  details: {
    currentDelivered: {
      id: string
      number?: string | null
      createdAt: string | Date
      deliveredAt: string | Date
    }[]
    pastDelivered: {
      id: string
      number?: string | null
      createdAt: string | Date
      deliveredAt: string | Date
      historicalRate: number
      pastPeriodTotalOrders: number
    }[]
    feedbacks: {
      id: string
      number?: string | null
      feedbackType: string
      feedbackAuthor: string | null
      feedbackUrl: string | null
      bonus: number
    }[]
  }
}

type PayoutFilter = 'all' | 'with_payout' | 'without_payout'

export default function PayrollClient() {
  const periods = useMemo(() => generatePayrollPeriods(), [])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [reports, setReports] = useState<ManagerReport[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [statementReport, setStatementReport] = useState<ManagerReport | null>(null)
  const [search, setSearch] = useState('')
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>('all')
  const [errorMessage, setErrorMessage] = useState('')

  const handlePrintStatement = (report: ManagerReport) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000')
    if (!printWindow) return

    const periodLabel = periods[selectedPeriodIdx]?.label || ''

    const currentDeliveredRows = report.details.currentDelivered.map(o => `
      <tr>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; font-family: monospace; font-weight: 600;">Заказ №${o.number ?? o.id.slice(-6).toUpperCase()}</td>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; color: #475569;">${new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; color: #475569;">${new Date(o.deliveredAt).toLocaleDateString('ru-RU')}</td>
        <td style="padding: 6px; text-align: right; font-weight: 500;">${report.metrics.currentRate} ₽</td>
      </tr>
    `).join('')

    const pastDeliveredRows = report.details.pastDelivered.map(o => `
      <tr>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; font-family: monospace; font-weight: 600;">Заказ №${o.number ?? o.id.slice(-6).toUpperCase()}</td>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; color: #475569;">${new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; color: #475569;">${new Date(o.deliveredAt).toLocaleDateString('ru-RU')}</td>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; text-align: center;">${o.pastPeriodTotalOrders} шт</td>
        <td style="padding: 6px; border-right: 1px solid #cbd5e1; text-align: center;">${o.historicalRate} ₽</td>
        <td style="padding: 6px; text-align: right; font-weight: 500;">${o.historicalRate} ₽</td>
      </tr>
    `).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Расчётная ведомость - ${report.manager.fullName}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-size: 11px;
              line-height: 1.4;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .title {
              font-size: 15px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 4px;
            }
            .info-box {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              background: #f8fafc;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #334155;
              margin-top: 16px;
              margin-bottom: 6px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            th {
              background: #f1f5f9;
              color: #334155;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9px;
              padding: 6px;
              border: 1px solid #cbd5e1;
            }
            td {
              padding: 6px;
              border: 1px solid #e2e8f0;
            }
            .total-row {
              background: #f1f5f9;
              font-weight: 700;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div style="font-weight: 800; font-size: 18px;">СУЛАК CRM</div>
              <div class="title">Расчётная ведомость по начислению зарплаты</div>
              <div style="color: #475569; font-size: 11px; margin-top: 4px;">
                Отчётный период: <strong>${periodLabel}</strong>
              </div>
            </div>
            <div style="text-align: right; color: #64748b; font-family: monospace;">
              <div>Дата формирования:</div>
              <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${new Date().toLocaleDateString('ru-RU')}</div>
            </div>
          </div>

          <div class="info-box">
            <div>
              <div style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase;">Сотрудник / Менеджер</div>
              <div style="font-weight: 700; font-size: 13px;">${report.manager.fullName}</div>
              <div style="color: #64748b; font-family: monospace; font-size: 10px;">${report.manager.email}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase;">Расчётная ставка периода</div>
              <div style="font-weight: 700; font-size: 13px;">${report.metrics.currentRate} ₽ / за доставку</div>
              <div style="color: #64748b; font-size: 10px;">Оформил подзаказов: ${report.metrics.totalCreatedCount ?? report.metrics.totalOrdersCount} шт</div>
            </div>
          </div>

          <div class="section-title">1. Сводный расчёт выплат за период</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Категория начисления</th>
                <th style="text-align: center;">Объём (шт)</th>
                <th style="text-align: center;">Ставка</th>
                <th style="text-align: right;">Итого начислено</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 500;">Доставки текущего периода</td>
                <td style="text-align: center;">${report.metrics.currentDeliveredCount} шт</td>
                <td style="text-align: center;">${report.metrics.currentRate} ₽</td>
                <td style="text-align: right; font-weight: 600;">${report.metrics.currentDeliveriesSum.toLocaleString('ru-RU')} ₽</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Доставки из прошлых месяцев (Надбавка)</td>
                <td style="text-align: center;">${report.metrics.pastDeliveredCount} шт</td>
                <td style="text-align: center; color: #64748b;">По ист. ставкам</td>
                <td style="text-align: right; font-weight: 600;">${report.metrics.pastDeliveriesSum.toLocaleString('ru-RU')} ₽</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Премии за отзывы клиентов (с фото / текст)</td>
                <td style="text-align: center;">${report.metrics.feedbackBonusCount} шт</td>
                <td style="text-align: center; color: #64748b;">300 / 500 ₽</td>
                <td style="text-align: right; font-weight: 600; color: #047857;">+${report.metrics.feedbackBonusSum.toLocaleString('ru-RU')} ₽</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="text-transform: uppercase;">ИТОГО К ВЫПЛАТЕ:</td>
                <td style="text-align: right; color: #1d4ed8;">${report.metrics.totalPayout.toLocaleString('ru-RU')} ₽</td>
              </tr>
            </tbody>
          </table>

          ${report.details.currentDelivered.length > 0 ? `
            <div class="section-title">2. Детализация текущих доставок (${report.details.currentDelivered.length} шт)</div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">№ Заказа</th>
                  <th style="text-align: left;">Дата создания</th>
                  <th style="text-align: left;">Дата вручения</th>
                  <th style="text-align: right;">Начислено</th>
                </tr>
              </thead>
              <tbody>
                ${currentDeliveredRows}
              </tbody>
            </table>
          ` : ''}

          ${report.details.pastDelivered.length > 0 ? `
            <div class="section-title">3. Детализация доставок из прошлых месяцев (${report.details.pastDelivered.length} шт)</div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">№ Заказа</th>
                  <th style="text-align: left;">Дата создания</th>
                  <th style="text-align: left;">Дата вручения</th>
                  <th style="text-align: center;">Ист. объем</th>
                  <th style="text-align: center;">Ист. ставка</th>
                  <th style="text-align: right;">Начислено</th>
                </tr>
              </thead>
              <tbody>
                ${pastDeliveredRows}
              </tbody>
            </table>
          ` : ''}
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  useEffect(() => {
    let isMounted = true
    
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (!isMounted) return
      setLoading(true)

      const active = periods[selectedPeriodIdx]
      if (!active) {
        setLoading(false)
        return
      }

      const result = await getPayrollDataAction(active.startDate, active.endDate)
      if (!isMounted) return
      setLoading(false)

      if (result.error) {
        setErrorMessage(result.error)
      } else if (result.report) {
        setErrorMessage('')
        setReports(result.report as ManagerReport[])
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [selectedPeriodIdx, refreshTrigger, periods])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && statementReport) {
        setStatementReport(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [statementReport])

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const toggleExpand = (managerId: string) => {
    setExpandedManagerId(prev => prev === managerId ? null : managerId)
  }

  const totalPayoutAll = reports.reduce((sum, report) => sum + report.metrics.totalPayout, 0)
  const totalCreatedAll = reports.reduce(
    (sum, report) => sum + (report.metrics.totalCreatedCount ?? report.metrics.totalOrdersCount),
    0
  )
  const totalDeliveredAll = reports.reduce(
    (sum, report) => sum + report.metrics.currentDeliveredCount + report.metrics.pastDeliveredCount,
    0
  )
  const totalFeedbacksAll = reports.reduce((sum, report) => sum + report.metrics.feedbackBonusCount, 0)
  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()

    return reports.filter(report => {
      const matchesSearch = !query
        || report.manager.fullName.toLowerCase().includes(query)
        || report.manager.email.toLowerCase().includes(query)
      const matchesPayout = payoutFilter === 'all'
        || (payoutFilter === 'with_payout' && report.metrics.totalPayout > 0)
        || (payoutFilter === 'without_payout' && report.metrics.totalPayout === 0)

      return matchesSearch && matchesPayout
    })
  }, [payoutFilter, reports, search])

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]">Расчётный период</h2>
            <p className="mt-1 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">Параметры ведомости</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 space-y-1.5 sm:min-w-[300px]">
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">Отчётный период</span>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <select
                  aria-label="Отчётный период"
                  value={selectedPeriodIdx}
                  onChange={event => {
                    setSelectedPeriodIdx(Number(event.target.value))
                    setExpandedManagerId(null)
                  }}
                  className="erp-input w-full cursor-pointer !pl-9 font-medium"
                >
                  {periods.map((period, index) => (
                    <option key={index} value={index}>{period.label}</option>
                  ))}
                </select>
              </span>
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Пересчитываем...' : 'Пересчитать'}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2.5 text-[11px] text-[var(--danger)]" role="alert">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {errorMessage}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка расчёта зарплаты">
        {[
          {
            label: 'Фонд выплат',
            value: `${totalPayoutAll.toLocaleString('ru-RU')} ₽`,
            note: 'Начислено за период',
            icon: WalletCards,
            iconClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
          },
          {
            label: 'Оформлено',
            value: totalCreatedAll.toLocaleString('ru-RU'),
            note: 'Подзаказов создано',
            icon: ShoppingCart,
            iconClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
          },
          {
            label: 'Доставлено',
            value: totalDeliveredAll.toLocaleString('ru-RU'),
            note: 'Учтено в начислениях',
            icon: PackageCheck,
            iconClass: 'bg-[var(--success-soft)] text-[var(--success)]',
          },
          {
            label: 'Отзывы',
            value: totalFeedbacksAll.toLocaleString('ru-RU'),
            note: 'Премиальных отзывов',
            icon: MessageSquare,
            iconClass: 'bg-[var(--warning-soft)] text-[var(--warning)]',
          },
        ].map(metric => (
          <div key={metric.label} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{metric.label}</p>
                <p className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{metric.value}</p>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{metric.note}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.iconClass}`}>
                <metric.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
        <header className="border-b border-[var(--border-primary)] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ведомости менеджеров</h2>
                <span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-1 text-[9px] font-semibold text-[var(--text-secondary)]">{reports.length}</span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Начисления, ставки и детализация по сотрудникам</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  type="search"
                  aria-label="Поиск менеджера"
                  placeholder="Имя или почта"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="erp-input w-full !pl-9 font-normal"
                />
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--bg-surface-secondary)] p-1" aria-label="Фильтр начислений">
                {([
                  ['all', 'Все'],
                  ['with_payout', 'С выплатой'],
                  ['without_payout', 'Без выплаты'],
                ] as const).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setPayoutFilter(value)}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-medium transition-colors ${
                      payoutFilter === value
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
        </header>

        <div className="divide-y divide-[var(--border-primary)]">
        {loading ? (
          <div className="px-5 py-16 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[var(--accent-primary)]" />
            <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Рассчитываем ведомости</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <UserRound className="mx-auto h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.5} />
            <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">Ведомости не найдены</p>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Измените период, поиск или фильтр</p>
          </div>
        ) : (
          filteredReports.map(report => {
            const isExpanded = expandedManagerId === report.manager.id
            return (
              <article
                key={report.manager.id} 
                className="min-w-0 overflow-hidden"
              >
                <div className="grid min-w-0 gap-4 p-4 xl:grid-cols-[minmax(170px,1.2fr)_repeat(4,minmax(82px,0.55fr))_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <UserRound className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-semibold text-[var(--text-primary)]">{report.manager.fullName}</h3>
                      <p className="mt-1 truncate font-mono text-[9px] text-[var(--text-tertiary)]">{report.manager.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:contents">
                    <div className="rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5 xl:bg-transparent xl:p-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Оформлено</p>
                      <p className="mt-1 whitespace-nowrap text-xs font-semibold text-[var(--text-primary)]">{report.metrics.totalCreatedCount ?? report.metrics.totalOrdersCount} шт.</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5 xl:bg-transparent xl:p-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Доставлено</p>
                      <p className="mt-1 whitespace-nowrap text-xs font-semibold text-[var(--success)]">{report.metrics.currentDeliveredCount + report.metrics.pastDeliveredCount} шт.</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5 xl:bg-transparent xl:p-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Ставка</p>
                      <p className="mt-1 whitespace-nowrap text-xs font-semibold text-[var(--text-primary)]">{report.metrics.currentRate.toLocaleString('ru-RU')} ₽</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-secondary)] px-3 py-2.5 xl:bg-transparent xl:p-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">К выплате</p>
                      <p className="mt-1 whitespace-nowrap text-sm font-semibold text-[var(--accent-primary)]">{report.metrics.totalPayout.toLocaleString('ru-RU')} ₽</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                    <button
                      type="button"
                      onClick={() => setStatementReport(report)}
                      className="erp-button-secondary inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Выписка
                    </button>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Скрыть' : 'Показать'} детализацию для ${report.manager.fullName}`}
                      onClick={() => toggleExpand(report.manager.id)}
                      className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? 'Скрыть' : 'Детали'}
                    </button>
                  </div>
                </div>

                {/* Разворачивающийся подробный отчет */}
                {isExpanded && (
                  <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] space-y-4">
                    {/* Метрики отчета */}
                    <div className="grid gap-3 sm:grid-cols-4 text-xs font-normal">
                      <div className="bg-[var(--bg-surface)] p-3 rounded-md border border-[var(--border-primary)]">
                        <span className="text-[9px] text-[var(--text-tertiary)] block font-medium uppercase tracking-wider mb-0.5">Оформлено и доставлено</span>
                        <span className="text-[var(--text-primary)] font-semibold">{report.metrics.currentDeliveredCount} шт</span>
                        <span className="text-[var(--text-tertiary)] text-[10px] block mt-0.5">({report.metrics.currentDeliveriesSum.toLocaleString('ru-RU')} ₽)</span>
                      </div>
                      <div className="bg-[var(--bg-surface)] p-3 rounded-md border border-[var(--border-primary)]">
                        <span className="text-[9px] text-[var(--text-tertiary)] block font-medium uppercase tracking-wider mb-0.5">Доставлено из прошлых периодов</span>
                        <span className="text-[var(--text-primary)] font-semibold">{report.metrics.pastDeliveredCount} шт</span>
                        <span className="text-[var(--text-tertiary)] text-[10px] block mt-0.5">({report.metrics.pastDeliveriesSum.toLocaleString('ru-RU')} ₽)</span>
                      </div>
                      <div className="bg-[var(--bg-surface)] p-3 rounded-md border border-[var(--border-primary)]">
                        <span className="text-[9px] text-[var(--text-tertiary)] block font-medium uppercase tracking-wider mb-0.5">Бонусы за отзывы</span>
                        <span className="text-[var(--success)] font-semibold">+{report.metrics.feedbackBonusSum.toLocaleString('ru-RU')} ₽</span>
                        <span className="text-[var(--text-tertiary)] text-[10px] block mt-0.5">({report.metrics.feedbackBonusCount} шт)</span>
                      </div>
                      <div className="bg-[var(--bg-surface)] p-3 rounded-md border border-[var(--border-primary)]">
                        <span className="text-[9px] text-[var(--text-tertiary)] block font-medium uppercase tracking-wider mb-0.5">Итоговая сумма</span>
                        <span className="text-[var(--accent-primary)] font-semibold text-sm">{report.metrics.totalPayout.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    </div>

                    {/* Таблица 1: Оформленные и доставленные в текущем периоде */}
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-[var(--text-primary)] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                        <ShoppingBag className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        Текущие доставки (по ставке {report.metrics.currentRate} ₽)
                      </h4>
                      <div className="overflow-x-auto rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                              <th className="p-2.5 pl-4">ID заказа</th>
                              <th className="p-2.5">Дата создания</th>
                              <th className="p-2.5">Дата вручения</th>
                              <th className="p-2.5 text-right pr-4">Сумма ставки</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
                            {report.details.currentDelivered.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-3 text-center text-[var(--text-tertiary)] font-normal">Нет доставок в этом периоде</td>
                              </tr>
                            ) : (
                              report.details.currentDelivered.map(o => (
                                <tr key={o.id} className="hover:bg-[var(--bg-table-row-hover)] transition-colors">
                                  <td className="p-2.5 pl-4 font-mono font-medium text-[var(--text-primary)]">Заказ №{o.number ?? o.id.slice(-6).toUpperCase()}</td>
                                  <td className="p-2.5 text-[var(--text-tertiary)]">{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
                                  <td className="p-2.5 text-[var(--text-tertiary)]">{new Date(o.deliveredAt).toLocaleDateString('ru-RU')}</td>
                                  <td className="p-2.5 text-right pr-4 font-semibold text-[var(--accent-primary)]">{report.metrics.currentRate} ₽</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Таблица 2: Доставленные прошлых периодов */}
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-[var(--text-primary)] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                        <Award className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        Надбавки за прошлые периоды
                      </h4>
                      <div className="overflow-x-auto rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                              <th className="p-2.5 pl-4">ID заказа</th>
                              <th className="p-2.5">Дата создания</th>
                              <th className="p-2.5">Дата вручения</th>
                              <th className="p-2.5 text-center">Продажи в том периоде</th>
                              <th className="p-2.5 text-right pr-4">Историческая ставка</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
                            {report.details.pastDelivered.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-3 text-center text-[var(--text-tertiary)] font-normal">Нет надбавок в этом периоде</td>
                              </tr>
                            ) : (
                              report.details.pastDelivered.map(o => (
                                <tr key={o.id} className="hover:bg-[var(--bg-table-row-hover)] transition-colors">
                                  <td className="p-2.5 pl-4 font-mono font-medium text-[var(--text-primary)]">Заказ №{o.number ?? o.id.slice(-6).toUpperCase()}</td>
                                  <td className="p-2.5 text-[var(--text-tertiary)]">{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
                                  <td className="p-2.5 text-[var(--text-tertiary)]">{new Date(o.deliveredAt).toLocaleDateString('ru-RU')}</td>
                                  <td className="p-2.5 text-center text-[var(--text-secondary)] font-medium">{o.pastPeriodTotalOrders} шт</td>
                                  <td className="p-2.5 text-right pr-4 font-semibold text-[var(--accent-primary)]">{o.historicalRate} ₽</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Таблица 3: Отзывы клиентов */}
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-[var(--text-primary)] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                        <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        Зарегистрированные отзывы клиентов
                      </h4>
                      <div className="overflow-x-auto rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                              <th className="p-2.5 pl-4">ID заказа</th>
                              <th className="p-2.5">Тип отзыва</th>
                              <th className="p-2.5">Автор</th>
                              <th className="p-2.5">Ссылка на Авито</th>
                              <th className="p-2.5 text-right pr-4">Сумма бонуса</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
                            {report.details.feedbacks.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-3 text-center text-[var(--text-tertiary)] font-normal">Нет зарегистрированных отзывов</td>
                              </tr>
                            ) : (
                              report.details.feedbacks.map(f => (
                                <tr key={f.id} className="hover:bg-[var(--bg-table-row-hover)] transition-colors">
                                  <td className="p-2.5 pl-4 font-mono font-medium text-[var(--text-primary)]">Заказ №{f.number ?? f.id.slice(-6).toUpperCase()}</td>
                                  <td className="p-2.5">
                                    {f.feedbackType === 'with_photo' ? (
                                      <span className="text-[var(--success)] font-medium bg-[var(--success-soft)] px-2 py-0.5 rounded text-[10px]">С фото (+500 ₽)</span>
                                    ) : (
                                      <span className="text-[var(--text-secondary)] bg-[var(--bg-surface-secondary)] px-2 py-0.5 rounded text-[10px] border border-[var(--border-primary)]">Без фото (+300 ₽)</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-[var(--text-secondary)] font-normal">{f.feedbackAuthor || '-'}</td>
                                  <td className="p-2.5">
                                    {f.feedbackUrl ? (
                                      <a 
                                        href={f.feedbackUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 font-medium text-xs"
                                      >
                                        Открыть отзыв <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : '-'}
                                  </td>
                                  <td className="p-2.5 text-right pr-4 font-semibold text-[var(--accent-primary)]">+{f.bonus} ₽</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })
        )}
        </div>
      </section>

      {/* Модальное окно: Официальная расчетная ведомость / Выписка по ЗП */}
      {statementReport && (
        <div
          id="payslip-modal-wrapper"
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-3 backdrop-blur-xs sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatementReport(null)
          }}
        >
          <section
            id="payslip-print-document"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payslip-dialog-title"
            className="relative flex max-h-[calc(100vh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl print:max-h-none print:w-full print:max-w-none print:rounded-none print:border-0 print:shadow-none"
          >
            {/* Панель управления печати (скрыта при печати) */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5 print:hidden sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                <h3 id="payslip-dialog-title" className="truncate text-xs font-semibold text-slate-800">
                  Расчётная ведомость: {statementReport.manager.fullName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintStatement(statementReport)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[var(--accent-primary)] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--accent-primary-hover)]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Распечатать / PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
                <button
                  type="button"
                  aria-label="Закрыть ведомость"
                  onClick={() => setStatementReport(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Контент расчётного листа (A4 стиль) */}
            <div 
              id="payslip-print-content"
              className="space-y-5 overflow-y-auto bg-white p-4 leading-relaxed text-slate-900 print:overflow-visible print:p-0 sm:p-8"
            >
              {/* Шапка документа */}
              <div className="flex flex-col gap-4 border-b border-slate-300 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-lg text-slate-900 tracking-tight">СУЛАК CRM</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">Официальная выписка</span>
                  </div>
                  <h2 className="mt-2 text-sm font-extrabold uppercase tracking-wide text-slate-900 sm:text-base">
                    РАСЧЁТНАЯ ВЕДОМОСТЬ ПО НАЧИСЛЕНИЮ ЗАРПЛАТЫ
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Отчётный период: <strong className="text-slate-900">{periods[selectedPeriodIdx]?.label}</strong>
                  </p>
                </div>
                <div className="text-left font-mono text-xs text-slate-500 sm:text-right">
                  <div>Дата формирования:</div>
                  <div className="font-bold text-slate-800">{new Date().toLocaleDateString('ru-RU')}</div>
                </div>
              </div>

              {/* Реквизиты сотрудника */}
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Сотрудник / Менеджер</span>
                  <span className="font-bold text-sm text-slate-900">{statementReport.manager.fullName}</span>
                  <span className="block text-slate-500 font-mono text-[11px] mt-0.5">{statementReport.manager.email}</span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Расчётная ставка периода</span>
                  <span className="font-bold text-sm text-slate-900">{statementReport.metrics.currentRate} ₽ / за доставку</span>
                  <span className="block text-slate-500 text-[11px] mt-0.5">Оформил подзаказов: {statementReport.metrics.totalCreatedCount ?? statementReport.metrics.totalOrdersCount} шт</span>
                </div>
              </div>

              {/* Сводная таблица начислений */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Сводный расчёт выплат за период</h4>
                <div className="overflow-x-auto rounded border border-slate-300">
                <table className="min-w-[580px] w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300 text-[10px] uppercase">
                      <th className="p-2.5 border-r border-slate-300">Категория начисления</th>
                      <th className="p-2.5 border-r border-slate-300 text-center">Объём (шт)</th>
                      <th className="p-2.5 border-r border-slate-300 text-center">Ставка</th>
                      <th className="p-2.5 text-right pr-4">Итого начислено</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 border-r border-slate-200 font-medium">Доставки текущего периода</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{statementReport.metrics.currentDeliveredCount} шт</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{statementReport.metrics.currentRate} ₽</td>
                      <td className="p-2.5 text-right pr-4 font-semibold text-slate-900">{statementReport.metrics.currentDeliveriesSum.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border-r border-slate-200 font-medium">Доставки из прошлых месяцев (Надбавка)</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{statementReport.metrics.pastDeliveredCount} шт</td>
                      <td className="p-2.5 border-r border-slate-200 text-center text-slate-500">По ист. ставкам</td>
                      <td className="p-2.5 text-right pr-4 font-semibold text-slate-900">{statementReport.metrics.pastDeliveriesSum.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border-r border-slate-200 font-medium">Премии за отзывы клиентов (с фото / текст)</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{statementReport.metrics.feedbackBonusCount} шт</td>
                      <td className="p-2.5 border-r border-slate-200 text-center text-slate-500">300 / 500 ₽</td>
                      <td className="p-2.5 text-right pr-4 font-semibold text-emerald-700">+{statementReport.metrics.feedbackBonusSum.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-slate-900">
                      <td colSpan={3} className="p-3 border-r border-slate-300 uppercase text-[11px]">ИТОГО К ВЫПЛАТЕ:</td>
                      <td className="p-3 text-right pr-4 text-sm text-blue-700">{statementReport.metrics.totalPayout.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>

              {/* Детализация 1: Текущие доставки */}
              {statementReport.details.currentDelivered.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">2. Детализация текущих доставок ({statementReport.details.currentDelivered.length} шт)</h4>
                  <table className="w-full text-left text-[11px] border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[9px] uppercase">
                        <th className="p-2 border-r border-slate-200">№ Заказа</th>
                        <th className="p-2 border-r border-slate-200">Дата создания</th>
                        <th className="p-2 border-r border-slate-200">Дата вручения</th>
                        <th className="p-2 text-right">Начислено</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementReport.details.currentDelivered.map(o => (
                        <tr key={o.id}>
                          <td className="p-2 border-r border-slate-100 font-mono font-semibold">Заказ №{o.number ?? o.id.slice(-6).toUpperCase()}</td>
                          <td className="p-2 border-r border-slate-100 text-slate-600">{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
                          <td className="p-2 border-r border-slate-100 text-slate-600">{new Date(o.deliveredAt).toLocaleDateString('ru-RU')}</td>
                          <td className="p-2 text-right font-medium">{statementReport.metrics.currentRate} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Детализация 2: Прошлые доставки */}
              {statementReport.details.pastDelivered.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">3. Детализация доставок из прошлых месяцев ({statementReport.details.pastDelivered.length} шт)</h4>
                  <table className="w-full text-left text-[11px] border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[9px] uppercase">
                        <th className="p-2 border-r border-slate-200">№ Заказа</th>
                        <th className="p-2 border-r border-slate-200">Дата создания</th>
                        <th className="p-2 border-r border-slate-200">Дата вручения</th>
                        <th className="p-2 border-r border-slate-200 text-center">Ист. объем</th>
                        <th className="p-2 border-r border-slate-200 text-center">Ист. ставка</th>
                        <th className="p-2 text-right">Начислено</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementReport.details.pastDelivered.map(o => (
                        <tr key={o.id}>
                          <td className="p-2 border-r border-slate-100 font-mono font-semibold">Заказ №{o.number ?? o.id.slice(-6).toUpperCase()}</td>
                          <td className="p-2 border-r border-slate-100 text-slate-600">{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
                          <td className="p-2 border-r border-slate-100 text-slate-600">{new Date(o.deliveredAt).toLocaleDateString('ru-RU')}</td>
                          <td className="p-2 border-r border-slate-100 text-center font-medium">{o.pastPeriodTotalOrders} шт</td>
                          <td className="p-2 border-r border-slate-100 text-center font-medium">{o.historicalRate} ₽</td>
                          <td className="p-2 text-right font-medium">{o.historicalRate} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
