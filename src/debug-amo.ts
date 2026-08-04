import prisma from '@/lib/prisma'

async function debugExactAllPages() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: 'amocrm_' } },
  })

  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  const subdomain = (map['amocrm_subdomain'] || '').trim()
  const accessToken = (map['amocrm_access_token'] || '').trim()

  const startOfDay = new Date(2026, 6, 31, 0, 0, 0, 0)
  const endOfDay = new Date(2026, 6, 31, 23, 59, 59, 999)
  const fromTs = Math.floor(startOfDay.getTime() / 1000)
  const toTs = Math.floor(endOfDay.getTime() / 1000)

  // 1. Пагинация по ВСЕМ страницам событий за день
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

  console.log(`\n📊 Всего событий загружено со всех страниц (${page} стр.): ${allEvents.length}`)

  // 2. Загружаем все сделки
  const leadIds = Array.from(new Set(allEvents.map((ev) => ev.entity_id).filter(Boolean)))
  
  const leadMap = new Map<number, any>()
  const chunkSize = 50
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize)
    const leadsUrl = `https://${subdomain}.amocrm.ru/api/v4/leads?limit=250&` + chunk.map(id => `filter[id][]=${id}`).join('&')
    const leadsRes = await fetch(leadsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (leadsRes.ok) {
      const leadsData = await leadsRes.json()
      const leads: any[] = leadsData?._embedded?.leads || []
      leads.forEach(l => leadMap.set(l.id, l))
    }
  }

  let newMsgs = 0
  let repeatMsgs = 0
  let incomingCalls = 0

  function isValueSetToYes(ev: any): boolean {
    if (!ev.value_after || !Array.isArray(ev.value_after) || ev.value_after.length === 0) return false
    const val = ev.value_after[0]?.custom_field_value
    return val?.text === 'Да' || val?.enum_id === 701271 || val?.enum_id === 701315 || val?.enum_id === 701695
  }

  for (const ev of allEvents) {
    const isYes = isValueSetToYes(ev)
    if (!isYes) continue

    const lead = leadMap.get(ev.entity_id)
    const isCreatedToday = lead && lead.created_at >= fromTs && lead.created_at <= toTs

    if (ev.type === 'custom_field_1042391_value_changed') {
      if (isCreatedToday) newMsgs++
    } else if (ev.type === 'custom_field_1042419_value_changed') {
      repeatMsgs++
    } else if (ev.type === 'custom_field_1041695_value_changed') {
      if (isCreatedToday) incomingCalls++
    }
  }

  console.log('──────────────────────────────────────────────────')
  console.log(`- Новые сообщения (ID 1042391 + Созданы 31.07 + Да): ${newMsgs}`)
  console.log(`- Повторные сообщения (ID 1042419 + Да): ${repeatMsgs}`)
  console.log(`- Входящие звонки (ID 1041695 + Созданы 31.07 + Да): ${incomingCalls}`)
  console.log(`- Всего лидов (новые + звонки): ${newMsgs + incomingCalls}`)
  console.log('──────────────────────────────────────────────────\n')
}

debugExactAllPages().then(() => process.exit(0))
