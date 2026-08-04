'use client'

import { useState, useMemo, useEffect } from 'react'
import { getPayrollDataAction } from './actions'
import { generatePayrollPeriods } from '@/utils/payroll'
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
  ShoppingBag,
  Award,
  ExternalLink,
  Printer,
  FileText,
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


export default function PayrollClient() {
  const periods = useMemo(() => generatePayrollPeriods(), [])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [reports, setReports] = useState<ManagerReport[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [statementReport, setStatementReport] = useState<ManagerReport | null>(null)

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
        alert(result.error)
      } else if (result.report) {
        setReports(result.report as ManagerReport[])
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [selectedPeriodIdx, refreshTrigger, periods])

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const toggleExpand = (managerId: string) => {
    setExpandedManagerId(prev => prev === managerId ? null : managerId)
  }

  const totalPayoutAll = reports.reduce((sum, r) => sum + r.metrics.totalPayout, 0)
  const totalOrdersAll = reports.reduce((sum, r) => sum + r.metrics.totalOrdersCount, 0)
  const totalFeedbacksAll = reports.reduce((sum, r) => sum + r.metrics.feedbackBonusCount, 0)

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
      {/* Выбор периода */}
      <div className="erp-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="font-medium text-[var(--text-primary)]">Отчетный период:</span>
          <select
            value={selectedPeriodIdx}
            onChange={e => {
              setSelectedPeriodIdx(Number(e.target.value))
              setExpandedManagerId(null)
            }}
            className="erp-input font-medium cursor-pointer"
          >
            {periods.map((p, idx) => (
              <option key={idx} value={idx}>{p.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="erp-button-primary cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      {/* Сводные метрики */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Общий фонд выплат</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
              {totalPayoutAll.toLocaleString('ru-RU')} ₽
            </h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <DollarSign className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Оформлено продаж</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
              {totalOrdersAll} шт
            </h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Собрано отзывов</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
              {totalFeedbacksAll} шт
            </h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Ведомости по менеджерам */}
      <div className="space-y-4">
        {loading ? (
          <div className="erp-card p-12 text-center text-[var(--text-tertiary)] text-xs font-normal">
            Расчет ведомостей...
          </div>
        ) : reports.length === 0 ? (
          <div className="erp-card p-12 text-center text-[var(--text-tertiary)] text-xs font-normal">
            Нет данных по зарплате менеджеров за выбранный период
          </div>
        ) : (
          reports.map(report => {
            const isExpanded = expandedManagerId === report.manager.id
            return (
              <div 
                key={report.manager.id} 
                className="erp-card overflow-hidden"
              >
                {/* Карточка-заголовок */}
                <div 
                  onClick={() => toggleExpand(report.manager.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-table-row-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-semibold text-xs">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)]">{report.manager.fullName}</h4>
                      <p className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">Менеджер по продажам</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[var(--text-secondary)] font-normal">
                    <div className="text-center sm:text-right">
                      <span className="text-[9px] font-medium text-[var(--text-tertiary)] block uppercase tracking-wider">Всего заказов</span>
                      <span className="text-[var(--text-primary)] font-semibold">{(report.metrics.totalCreatedCount !== undefined) ? report.metrics.totalCreatedCount : report.metrics.totalOrdersCount} шт</span>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-[9px] font-medium text-[var(--text-tertiary)] block uppercase tracking-wider">Доставлено</span>
                      <span className="text-[var(--success)] font-semibold">{report.metrics.currentDeliveredCount} шт</span>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-[9px] font-medium text-[var(--text-tertiary)] block uppercase tracking-wider">Отменено</span>
                      <span className="text-[var(--danger)] font-semibold">{report.metrics.cancelledCount ?? 0} шт</span>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-[9px] font-medium text-[var(--text-tertiary)] block uppercase tracking-wider">Текущая ставка</span>
                      <span className="text-[var(--text-primary)] font-semibold">{report.metrics.currentRate} ₽</span>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-[9px] font-medium text-[var(--text-tertiary)] block uppercase tracking-wider">К выплате</span>
                      <span className="text-[var(--accent-primary)] font-semibold text-sm">{report.metrics.totalPayout.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setStatementReport(report)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        title="Сформировать официальную выписку по ЗП для сотрудника"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Выписка</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(report.manager.id)}
                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
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
              </div>
            )
          })
        )}
      </div>

      {/* Модальное окно: Официальная расчетная ведомость / Выписка по ЗП */}
      {statementReport && (
        <div 
          id="payslip-modal-wrapper"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatementReport(null)
          }}
        >
          <div 
            id="payslip-print-document"
            className="relative w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:max-w-none print:rounded-none"
          >
            {/* Панель управления печати (скрыта при печати) */}
            <div className="flex h-13 items-center justify-between border-b border-slate-200 bg-slate-100 px-5 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Расчётная ведомость: {statementReport.manager.fullName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintStatement(statementReport)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Распечатать / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementReport(null)}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Контент расчётного листа (A4 стиль) */}
            <div 
              id="payslip-print-content"
              className="p-8 space-y-6 overflow-y-auto print:overflow-visible print:p-0 text-slate-900 bg-white leading-relaxed"
            >
              {/* Шапка документа */}
              <div className="flex items-start justify-between border-b border-slate-300 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-slate-900 tracking-tight">СУЛАК CRM</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">Официальная выписка</span>
                  </div>
                  <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-2">
                    РАСЧЁТНАЯ ВЕДОМОСТЬ ПО НАЧИСЛЕНИЮ ЗАРПЛАТЫ
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Отчётный период: <strong className="text-slate-900">{periods[selectedPeriodIdx]?.label}</strong>
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 font-mono">
                  <div>Дата формирования:</div>
                  <div className="font-bold text-slate-800">{new Date().toLocaleDateString('ru-RU')}</div>
                </div>
              </div>

              {/* Реквизиты сотрудника */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Сотрудник / Менеджер</span>
                  <span className="font-bold text-sm text-slate-900">{statementReport.manager.fullName}</span>
                  <span className="block text-slate-500 font-mono text-[11px] mt-0.5">{statementReport.manager.email}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Расчётная ставка периода</span>
                  <span className="font-bold text-sm text-slate-900">{statementReport.metrics.currentRate} ₽ / за доставку</span>
                  <span className="block text-slate-500 text-[11px] mt-0.5">Оформил подзаказов: {statementReport.metrics.totalCreatedCount ?? statementReport.metrics.totalOrdersCount} шт</span>
                </div>
              </div>

              {/* Сводная таблица начислений */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Сводный расчёт выплат за период</h4>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
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
          </div>
        </div>
      )}
    </div>
  )
}
