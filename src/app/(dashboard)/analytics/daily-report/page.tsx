import DailyReportClient from './DailyReportClient'

export const dynamic = 'force-dynamic'

export default function DailyReportPage() {
  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          Дневной отчёт
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Сводка обращений и продаж за выбранный день с готовым текстом для рабочего чата
        </p>
      </div>

      <DailyReportClient />
    </div>
  )
}
