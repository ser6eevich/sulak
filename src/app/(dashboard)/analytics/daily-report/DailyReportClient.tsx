'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { getDailyReportAction } from './actions'
import { 
  Calendar, 
  Copy, 
  Check, 
  RefreshCw, 
  BarChart3, 
  MessageSquare, 
  Phone, 
  PhoneOff, 
  ShoppingBag, 
  Users, 
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react'

export default function DailyReportClient() {
  const getTodayStr = () => new Date().toISOString().split('T')[0]

  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Поля ввода для ручной корректировки менеджером
  const [missedCallsInput, setMissedCallsInput] = useState<number>(1)
  const [totalLeadsInput, setTotalLeadsInput] = useState<number | ''>('')

  // Функция загрузки данных
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
    fetchReport(selectedDate, missedCallsInput, totalLeadsInput === '' ? undefined : Number(totalLeadsInput))
  }, [selectedDate])

  const handleApplyInputs = (e: React.FormEvent) => {
    e.preventDefault()
    fetchReport(selectedDate, missedCallsInput, totalLeadsInput === '' ? undefined : Number(totalLeadsInput))
  }

  // Копирование готового отчета в буфер обмена
  const handleCopyText = async () => {
    if (!report?.formattedReportText) return

    try {
      await navigator.clipboard.writeText(report.formattedReportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Резервный метод копирования
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-primary)] shadow-sm">
        <div className="space-y-1">
          <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[var(--accent-primary)]" />
            Генератор Дневного Отчёта по Продажам
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Автоматический сбор данных из amoCRM и Сулак CRM за любой день с быстрой отправкой в рабочий чат.
          </p>
        </div>

        {/* Выбор даты */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="erp-input pl-9 text-xs font-semibold cursor-pointer"
            />
          </div>
          <button
            onClick={() => fetchReport(selectedDate, missedCallsInput, totalLeadsInput === '' ? undefined : Number(totalLeadsInput))}
            disabled={loading}
            title="Обновить данные"
            className="erp-button-secondary p-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Интерактивная настройка ручных полей менеджером */}
      <form onSubmit={handleApplyInputs} className="erp-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
          <FileText className="h-4 w-4 text-amber-500" />
          Ручные показатели отчёта
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <PhoneOff className="h-3.5 w-3.5 text-amber-500" />
              Не дозвонились (вводится менеджером):
            </label>
            <input
              type="number"
              min={0}
              value={missedCallsInput}
              onChange={(e) => setMissedCallsInput(Number(e.target.value))}
              placeholder="1"
              className="erp-input text-xs font-bold w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Всего лидов (опциональная корректировка):
            </label>
            <input
              type="number"
              min={0}
              value={totalLeadsInput}
              onChange={(e) => setTotalLeadsInput(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={report ? String(report.manualInputs?.totalLeads) : 'Автоматически'}
              className="erp-input text-xs font-bold w-full"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="erp-button-secondary text-xs cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Пересчитать отчёт
          </button>
        </div>
      </form>

      {/* Сетка метрик за день */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Всего лидов */}
        <div className="erp-card p-3.5 space-y-1">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider block">
            Всего лидов
          </span>
          <div className="text-xl font-extrabold text-[var(--accent-primary)]">
            {loading ? '...' : report?.manualInputs?.totalLeads ?? 0}
          </div>
        </div>

        {/* Новые сообщения */}
        <div className="erp-card p-3.5 space-y-1">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider block">
            Новые сообщения
          </span>
          <div className="text-xl font-extrabold text-[var(--text-primary)]">
            {loading ? '...' : report?.messages?.newMessages ?? 0}
          </div>
        </div>

        {/* Повторные сообщения */}
        <div className="erp-card p-3.5 space-y-1">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider block">
            Повторные сообщения
          </span>
          <div className="text-xl font-extrabold text-[var(--text-primary)]">
            {loading ? '...' : report?.messages?.repeatMessages ?? 0}
          </div>
        </div>

        {/* Звонки и не дозвонились */}
        <div className="erp-card p-3.5 space-y-1">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider block">
            Звонки / Не дозвонились
          </span>
          <div className="text-xl font-extrabold text-amber-500">
            {loading ? '...' : `${report?.calls?.incomingCalls ?? 0} / ${report?.calls?.missedCalls ?? 0}`}
          </div>
        </div>
      </div>

      {/* Результаты Продаж */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="erp-card p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-[var(--success)]" />
            Продажи Сулак CRM за {report?.dateLabel || selectedDate}
          </h3>

          <div className="space-y-1 text-xs pt-1">
            <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
              <span className="text-[var(--text-secondary)]">Количество заказов:</span>
              <span className="font-bold text-[var(--text-primary)]">{report?.sales?.totalOrdersCount ?? 0} шт</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
              <span className="text-[var(--text-secondary)]">Общая сумма:</span>
              <span className="font-extrabold text-[var(--success)]">
                {report?.sales?.totalRevenue ? report.sales.totalRevenue.toLocaleString('ru-RU') : 0} ₽
              </span>
            </div>
            <div className="pt-1.5 space-y-1">
              <span className="text-[11px] font-medium text-[var(--text-tertiary)] block">
                Разбивка по менеджерам:
              </span>
              <div className="font-mono text-xs p-2.5 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] font-semibold text-[var(--text-primary)]">
                {report?.sales?.breakdownText || 'Нет заказов'}
              </div>
            </div>
          </div>
        </div>

        {/* Итоговый готовый текст отчета для копирования */}
        <div className="erp-card p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Готовый отчёт для чата
              </h3>
              {copied && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20 animate-pulse">
                  <Check className="h-3 w-3" />
                  Скопировано!
                </span>
              )}
            </div>

            <textarea
              readOnly
              rows={11}
              value={report?.formattedReportText || ''}
              className="w-full font-mono text-xs p-3 rounded-xl bg-slate-950 text-slate-100 border border-slate-800 focus:outline-hidden leading-relaxed resize-none"
            />
          </div>

          {/* Большая кнопка копирования */}
          <button
            onClick={handleCopyText}
            disabled={!report?.formattedReportText}
            className="w-full erp-button-primary py-3 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Отчёт скопирован в буфер обмена!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Скопировать отчёт в буфер обмена</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
