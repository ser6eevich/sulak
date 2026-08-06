'use client'

import { useEffect, useState, useTransition } from 'react'
import { getDailyReportAction } from './actions'
import type { DailyReportData } from '@/lib/analytics/DashboardService'
import {
  AlertCircle,
  CalendarDays,
  Check,
  Copy,
  FileText,
  MessageSquareText,
  MessagesSquare,
  PhoneCall,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
} from 'lucide-react'

export default function DailyReportClient() {
  const getTodayStr = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [report, setReport] = useState<DailyReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()

  const [missedCallsInput, setMissedCallsInput] = useState<number>(1)
  const [totalLeadsInput, setTotalLeadsInput] = useState<number | ''>('')

  const fetchReport = (dateStr: string, missed: number, totalLeads?: number) => {
    setLoading(true)
    setErrorMsg('')

    startTransition(async () => {
      const res = await getDailyReportAction(dateStr, {
        missedCalls: missed,
        totalLeads: totalLeads !== undefined && totalLeads !== null && String(totalLeads) !== '' ? Number(totalLeads) : undefined,
      })

      setLoading(false)

      if (res.error) {
        setErrorMsg(res.error)
      } else if (res.report) {
        setReport(res.report)
      }
    })
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchReport(selectedDate, missedCallsInput, totalLeadsInput === '' ? undefined : Number(totalLeadsInput))
    }, 0)
    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const handleApplyInputs = (e: React.FormEvent) => {
    e.preventDefault()
    fetchReport(selectedDate, missedCallsInput, totalLeadsInput === '' ? undefined : Number(totalLeadsInput))
  }

  const handleCopyText = async () => {
    if (!report?.formattedReportText) return

    try {
      await navigator.clipboard.writeText(report.formattedReportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = report.formattedReportText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const metrics = [
    {
      label: 'Всего лидов',
      value: report?.manualInputs?.totalLeads ?? 0,
      note: 'Обращений за день',
      icon: UsersRound,
      iconClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
    },
    {
      label: 'Новые сообщения',
      value: report?.messages?.newMessages ?? 0,
      note: 'Первичных диалогов',
      icon: MessageSquareText,
      iconClass: 'bg-[var(--accent-soft)] text-[var(--accent-primary)]',
    },
    {
      label: 'Повторные сообщения',
      value: report?.messages?.repeatMessages ?? 0,
      note: 'Повторных обращений',
      icon: MessagesSquare,
      iconClass: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]',
    },
    {
      label: 'Входящие звонки',
      value: report?.calls?.incomingCalls ?? 0,
      note: `Не дозвонились: ${report?.calls?.missedCalls ?? 0}`,
      icon: PhoneCall,
      iconClass: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    },
  ]

  return (
    <div className="min-w-0 space-y-4 pb-8">
      <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]">Отчётный день</h2>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Данные amoCRM и Сулак CRM</p>
          </div>
          <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-end">
            <label className="min-w-0 space-y-1.5 min-[480px]:w-[190px]">
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">Дата отчёта</span>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  aria-label="Дата отчёта"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="erp-input w-full cursor-pointer !pl-9 font-medium"
                />
              </span>
            </label>
            <button
              type="button"
              onClick={() => fetchReport(selectedDate, missedCallsInput, totalLeadsInput === '' ? undefined : Number(totalLeadsInput))}
              disabled={loading}
              className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Обновляем...' : 'Обновить данные'}
            </button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2.5 text-[11px] text-[var(--danger)]" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Показатели дневного отчёта" aria-busy={loading}>
        {metrics.map(metric => (
          <div key={metric.label} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{metric.label}</p>
                <p className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {loading ? '—' : metric.value.toLocaleString('ru-RU')}
                </p>
                <p className="mt-1 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">{metric.note}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.iconClass}`}>
                <metric.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid min-w-0 gap-4 min-[1200px]:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <header className="flex items-start justify-between gap-3 border-b border-[var(--border-primary)] p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
                    <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Продажи Сулак CRM</h2>
                    <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">За {report?.dateLabel || selectedDate}</p>
                  </div>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-2 border-b border-[var(--border-primary)]">
              <div className="border-r border-[var(--border-primary)] p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Заказы</p>
                <p className="mt-2 whitespace-nowrap text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {loading ? '—' : `${report?.sales?.totalOrdersCount ?? 0} шт.`}
                </p>
              </div>
              <div className="p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Выручка</p>
                <p className="mt-2 whitespace-nowrap text-xl font-semibold tracking-[-0.03em] text-[var(--success)]">
                  {loading ? '—' : `${(report?.sales?.totalRevenue ?? 0).toLocaleString('ru-RU')} ₽`}
                </p>
              </div>
            </div>

            <div className="p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">По менеджерам</p>
              <div className="mt-2 min-h-11 whitespace-pre-wrap rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-3 py-2.5 font-mono text-[10px] font-medium leading-relaxed text-[var(--text-secondary)]">
                {loading ? 'Собираем данные…' : report?.sales?.breakdownText || 'Нет заказов за выбранную дату'}
              </div>
            </div>
          </section>

          <form onSubmit={handleApplyInputs} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-[var(--warning)]">
                <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ручные корректировки</h2>
                <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Уточните показатели перед отправкой</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 min-[1200px]:grid-cols-1">
              <label className="space-y-1.5">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">Не дозвонились</span>
                <input
                  aria-label="Не дозвонились"
                  type="number"
                  min={0}
                  value={missedCallsInput}
                  onChange={(event) => setMissedCallsInput(Number(event.target.value))}
                  className="erp-input w-full font-medium"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">Всего лидов, если нужна корректировка</span>
                <input
                  aria-label="Всего лидов, если нужна корректировка"
                  type="number"
                  min={0}
                  value={totalLeadsInput}
                  onChange={(event) => setTotalLeadsInput(event.target.value === '' ? '' : Number(event.target.value))}
                  placeholder={report ? String(report.manualInputs?.totalLeads) : 'Автоматически'}
                  className="erp-input w-full font-medium"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="erp-button-secondary mt-3 inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Пересчитать отчёт
            </button>
          </form>
        </div>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
          <header className="flex flex-col gap-3 border-b border-[var(--border-primary)] p-4 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                <FileText className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h2 className="whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]">Готовый отчёт для чата</h2>
                <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Можно сразу скопировать и отправить</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyText}
              disabled={!report?.formattedReportText}
              className="erp-button-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Скопировано' : 'Скопировать отчёт'}
            </button>
          </header>

          <div className="flex flex-1 flex-col p-4">
            <label htmlFor="daily-report-text" className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              Текст сообщения
            </label>
            <textarea
              id="daily-report-text"
              readOnly
              rows={18}
              value={report?.formattedReportText || ''}
              placeholder={loading ? 'Формируем отчёт…' : 'Данные отчёта появятся здесь'}
              className="mt-2 min-h-[320px] w-full flex-1 resize-none rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4 font-mono text-[11px] leading-[1.7] text-[var(--text-primary)] outline-none"
            />
            <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]" aria-live="polite">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--success)]" />
                  <span className="text-[var(--success)]">Отчёт скопирован в буфер обмена</span>
                </>
              ) : (
                <>
                  <WalletCards className="h-3.5 w-3.5" />
                  <span>Суммы и показатели берутся из текущих данных CRM</span>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
