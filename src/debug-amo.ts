import { amoEventsEngine } from './lib/analytics/AmoEventsEngine'
import { dashboardService } from './lib/analytics/DashboardService'

async function runDiagnostic() {
  const dates = ['2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03']

  console.log('====================================================================================================')
  console.log('📊 РЕЖИМ ДИАГНОСТИКИ: ТАБЛИЦА СОБЫТИЙ СМЕНЫ ПОЛЕЙ НА «ДА» (Europe/Moscow)')
  console.log('====================================================================================================\n')

  for (const d of dates) {
    const rows = await amoEventsEngine.getDiagnosticRows(d)
    const report = await dashboardService.getDashboardStats(d)

    console.log(`\n📅 ДАТА: ${d}`)
    console.log(`- Всего событий изменения полей на «Да»: ${rows.length}`)
    console.log(`- Итоговый отчёт:\n${report.formattedReportText}\n`)

    if (rows.length > 0) {
      console.log('Детализация событий (для вручную сверки с лентой amoCRM):')
      console.table(
        rows.map((r) => ({
          'Дата (MSK)': r.createdAtFormatted,
          'Event ID': r.eventId,
          'Field ID': r.fieldId,
          'Type': r.eventType.replace('_value_changed', ''),
          'Lead ID': r.leadId,
          'Value Before': r.valueBefore,
          'Value After': r.valueAfter,
          'Enum ID': r.enumId || '-',
        }))
      )
    }
    console.log('\n----------------------------------------------------------------------------------------------------\n')
  }
}

runDiagnostic().then(() => process.exit(0))
