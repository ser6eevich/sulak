import prisma from '@/lib/prisma'

async function debugDate0308() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: 'amocrm_' } },
  })

  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  const subdomain = (map['amocrm_subdomain'] || '').trim()
  const accessToken = (map['amocrm_access_token'] || '').trim()

  // 03.08.2026
  const startOfDay = new Date(2026, 7, 3, 0, 0, 0, 0)
  const endOfDay = new Date(2026, 7, 3, 23, 59, 59, 999)
  const fromTs = Math.floor(startOfDay.getTime() / 1000)
  const toTs = Math.floor(endOfDay.getTime() / 1000)

  // Пагинация по событиям
  const allEvents: any[] = []
  let page = 1

  while (true) {
    const url = `https://${subdomain}.amocrm.ru/api/v4/events?limit=250&page=${page}&filter[created_at][from]=${fromTs}&filter[created_at][to]=${toTs}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) break
    const data = await res.json()
    const events: any[] = data?._embedded?.events || []
    if (events.length === 0) break

    allEvents.push(...events)
    if (events.length < 250) break
    page++
  }

  console.log(`\n📊 Всего событий за 03.08.2026: ${allEvents.length}`)

  // Загружаем сделки пачками по 20 штукам
  const leadIds = Array.from(new Set(allEvents.map((ev) => ev.entity_id).filter(Boolean)))
  const leadMap = new Map<number, any>()
  const chunkSize = 20

  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize)
    const leadsUrl = `https://${subdomain}.amocrm.ru/api/v4/leads?limit=250&` + chunk.map(id => `filter[id][]=${id}`).join('&')
    const leadsRes = await fetch(leadsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (leadsRes.ok && leadsRes.status !== 204) {
      const leadsData = await leadsRes.json()
      const leads: any[] = leadsData?._embedded?.leads || []
      leads.forEach(l => leadMap.set(l.id, l))
    }
  }

  console.log(`Загружено уникальных сделок: ${leadMap.size} из ${leadIds.length}`)

  let yesValueEvents = 0
  let createdTodayEvents = 0

  for (const ev of allEvents) {
    if (ev.type === 'custom_field_1042391_value_changed') {
      const val = Array.isArray(ev.value_after) ? ev.value_after[0] : ev.value_after
      const item = val?.custom_field_value || val
      const text = String(item?.text || '').toLowerCase()
      const isYes = text === 'да' || item?.enum_id === 701271 || item?.enum_id === 701315 || item?.enum_id === 701695

      if (isYes) {
        yesValueEvents++
        const lead = leadMap.get(ev.entity_id)
        // Если сделка создана СЕГОДНЯ (03.08)
        if (lead && lead.created_at >= fromTs && lead.created_at <= toTs) {
          createdTodayEvents++
        }
      }
    }
  }

  console.log('──────────────────────────────────────────────────')
  console.log(`- Всего полей "Есть обращение (новые)? Отчет" со значением "Да": ${yesValueEvents}`)
  console.log(`- Из них со значением "Да" И сделка создана 03.08: ${createdTodayEvents}`)
  console.log('──────────────────────────────────────────────────\n')
}

debugDate0308().then(() => process.exit(0))
