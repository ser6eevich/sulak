import prisma from '@/lib/prisma'
import { cacheService } from './CacheService'

export interface AmoEvent {
  id: string
  type: string
  entity_id: number
  entity_type: string
  created_at: number
  created_by: number
  value_after?: any
  value_before?: any
}

export interface AmoTalk {
  id: number
  talk_id?: string
  contact_id?: number
  created_at: number
  updated_at: number
  entity_id?: number
  entity_type?: string
  origin?: string
}

export interface AmoEntitySimple {
  id: number
  created_at: number
}

export class AmoClient {
  private subdomain: string = ''
  private clientId: string = ''
  private clientSecret: string = ''
  private accessToken: string = ''
  private refreshToken: string = ''
  private expiresAt: number = 0

  /**
   * Инициализация клиента: загрузка настроек из базы данных
   */
  async init(): Promise<boolean> {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'amocrm_subdomain',
            'amocrm_client_id',
            'amocrm_client_secret',
            'amocrm_access_token',
            'amocrm_refresh_token',
            'amocrm_expires_at',
          ],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value

    this.subdomain = (map['amocrm_subdomain'] || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\.amocrm\.ru.*$/i, '')
      .replace(/\/.*$/, '')
      .trim()

    this.clientId = map['amocrm_client_id'] || ''
    this.clientSecret = map['amocrm_client_secret'] || ''
    this.accessToken = (map['amocrm_access_token'] || '').trim()
    this.refreshToken = (map['amocrm_refresh_token'] || '').trim()
    this.expiresAt = parseInt(map['amocrm_expires_at'] || '0', 10)

    if (!this.subdomain || !this.accessToken) {
      return false
    }

    if (this.refreshToken && this.clientId && this.clientSecret && Date.now() >= this.expiresAt - 300000) {
      await this.refreshTokens()
    }

    return true
  }

  /**
   * Обновление OAuth2 токена доступа через refresh_token
   */
  private async refreshTokens(): Promise<boolean> {
    if (!this.subdomain || !this.refreshToken || !this.clientId || !this.clientSecret) {
      return false
    }

    try {
      const url = `https://${this.subdomain}.amocrm.ru/oauth2/access_token`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          redirect_uri: `https://${this.subdomain}.amocrm.ru`,
        }),
      })

      if (!res.ok) {
        console.error('Ошибка обновления токена amoCRM:', await res.text())
        return false
      }

      const data = await res.json()
      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token || this.refreshToken
      this.expiresAt = Date.now() + (data.expires_in || 86400) * 1000

      await prisma.$transaction([
        prisma.systemSetting.upsert({
          where: { key: 'amocrm_access_token' },
          update: { value: this.accessToken },
          create: { key: 'amocrm_access_token', value: this.accessToken },
        }),
        prisma.systemSetting.upsert({
          where: { key: 'amocrm_refresh_token' },
          update: { value: this.refreshToken },
          create: { key: 'amocrm_refresh_token', value: this.refreshToken },
        }),
        prisma.systemSetting.upsert({
          where: { key: 'amocrm_expires_at' },
          update: { value: this.expiresAt.toString() },
          create: { key: 'amocrm_expires_at', value: this.expiresAt.toString() },
        }),
      ])

      return true
    } catch (err) {
      console.error('Исключение при обновлении токена amoCRM:', err)
      return false
    }
  }

  /**
   * Запрос к API amoCRM с заголовком Authorization
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const isReady = await this.init()
    if (!isReady) return null

    const url = `https://${this.subdomain}.amocrm.ru${endpoint}`
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    try {
      const res = await fetch(url, { ...options, headers })
      if (res.status === 204) return null
      if (!res.ok) {
        console.error(`amoCRM API Error ${res.status} [${endpoint}]:`, await res.text())
        return null
      }

      return (await res.json()) as T
    } catch (err) {
      console.error(`Fetch exception [${endpoint}]:`, err)
      return null
    }
  }

  /**
   * Проверка тестового подключения к аккаунту amoCRM
   */
  async testConnection(): Promise<{ ok: boolean; accountName?: string; error?: string }> {
    const isReady = await this.init()
    if (!isReady) {
      return { ok: false, error: 'Настройки amoCRM не заполнено (проверьте поддомен и токен доступа)' }
    }

    try {
      const data = await this.request<{ name?: string; id?: number }>('/api/v4/account')
      if (data && data.name) {
        return { ok: true, accountName: data.name }
      }
      return { ok: false, error: 'amoCRM API не вернул название аккаунта. Проверьте правильность токена.' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Ошибка при подключении к amoCRM' }
    }
  }

  /**
   * 1. События (GET /api/v4/events) со ВСЕМИ страницами пагинации
   */
  async getEvents(
    fromTimestamp: number,
    toTimestamp: number,
    eventTypes: string[] = []
  ): Promise<AmoEvent[]> {
    const cacheKey = `events_${fromTimestamp}_${toTimestamp}_${eventTypes.join(',')}`
    const cached = cacheService.get<AmoEvent[]>(cacheKey)
    if (cached) return cached

    const allEvents: AmoEvent[] = []
    let page = 1
    const limit = 250

    while (true) {
      let endpoint = `/api/v4/events?limit=${limit}&page=${page}&filter[created_at][from]=${fromTimestamp}&filter[created_at][to]=${toTimestamp}`

      if (eventTypes.length > 0) {
        eventTypes.forEach((t) => {
          endpoint += `&filter[type][]=${encodeURIComponent(t)}`
        })
      }

      const data = await this.request<{ _embedded?: { events?: AmoEvent[] } }>(endpoint)
      const events = data?._embedded?.events || []

      if (events.length === 0) break

      allEvents.push(...events)

      if (events.length < limit) break
      page++

      if (page > 30) break
    }

    cacheService.set(cacheKey, allEvents, 300000)
    return allEvents
  }

  /**
   * 2. Получение информации о беседах по их ID (порциями по 20 штук)
   */
  async getTalksByIds(ids: number[]): Promise<AmoTalk[]> {
    if (!ids || ids.length === 0) return []
    const uniqueIds = Array.from(new Set(ids))
    const cacheKey = `talks_ids_${uniqueIds.sort().join('_')}`
    const cached = cacheService.get<AmoTalk[]>(cacheKey)
    if (cached) return cached

    const allTalks: AmoTalk[] = []
    const chunkSize = 20

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize)
      let endpoint = `/api/v4/talks?limit=250`
      chunk.forEach((id) => {
        endpoint += `&filter[id][]=${id}`
      })

      const data = await this.request<{ _embedded?: { talks?: AmoTalk[] } }>(endpoint)
      const talks = data?._embedded?.talks || []
      allTalks.push(...talks)
    }

    cacheService.set(cacheKey, allTalks, 300000)
    return allTalks
  }

  /**
   * 3. Получение сделок по их ID (порциями по 20 штук во избежание ошибки HTTP URL Too Long)
   */
  async getLeadsByIds(ids: number[]): Promise<AmoEntitySimple[]> {
    if (!ids || ids.length === 0) return []
    const uniqueIds = Array.from(new Set(ids))
    const cacheKey = `leads_ids_${uniqueIds.sort().join('_')}`
    const cached = cacheService.get<AmoEntitySimple[]>(cacheKey)
    if (cached) return cached

    const allLeads: AmoEntitySimple[] = []
    const chunkSize = 20

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize)
      let endpoint = `/api/v4/leads?limit=250`
      chunk.forEach((id) => {
        endpoint += `&filter[id][]=${id}`
      })

      const data = await this.request<{ _embedded?: { leads?: AmoEntitySimple[] } }>(endpoint)
      const leads = data?._embedded?.leads || []
      allLeads.push(...leads)
    }

    cacheService.set(cacheKey, allLeads, 300000)
    return allLeads
  }

  /**
   * 4. Получение контактов по их ID (порциями по 20 штук)
   */
  async getContactsByIds(ids: number[]): Promise<AmoEntitySimple[]> {
    if (!ids || ids.length === 0) return []
    const uniqueIds = Array.from(new Set(ids))
    const cacheKey = `contacts_ids_${uniqueIds.sort().join('_')}`
    const cached = cacheService.get<AmoEntitySimple[]>(cacheKey)
    if (cached) return cached

    const allContacts: AmoEntitySimple[] = []
    const chunkSize = 20

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize)
      let endpoint = `/api/v4/contacts?limit=250`
      chunk.forEach((id) => {
        endpoint += `&filter[id][]=${id}`
      })

      const data = await this.request<{ _embedded?: { contacts?: AmoEntitySimple[] } }>(endpoint)
      const contacts = data?._embedded?.contacts || []
      allContacts.push(...contacts)
    }

    cacheService.set(cacheKey, allContacts, 300000)
    return allContacts
  }

  /**
   * 5. Беседы (GET /api/v4/talks)
   */
  async getTalks(): Promise<AmoTalk[]> {
    const cacheKey = 'talks_recent'
    const cached = cacheService.get<AmoTalk[]>(cacheKey)
    if (cached) return cached

    const allTalks: AmoTalk[] = []
    let page = 1
    const limit = 250

    while (true) {
      const endpoint = `/api/v4/talks?limit=250&page=${page}`
      const data = await this.request<{ _embedded?: { talks?: AmoTalk[] } }>(endpoint)
      const talks = data?._embedded?.talks || []

      if (talks.length === 0) break

      allTalks.push(...talks)

      if (talks.length < limit) break
      page++

      if (page > 10) break
    }

    cacheService.set(cacheKey, allTalks, 300000)
    return allTalks
  }

  /**
   * 6. Звонки по created_at (GET /api/v4/calls)
   */
  async getCalls(fromTimestamp: number, toTimestamp: number): Promise<any[]> {
    const cacheKey = `calls_${fromTimestamp}_${toTimestamp}`
    const cached = cacheService.get<any[]>(cacheKey)
    if (cached) return cached

    const endpoint = `/api/v4/calls?filter[created_at][from]=${fromTimestamp}&filter[created_at][to]=${toTimestamp}&limit=250`
    const data = await this.request<{ _embedded?: { calls?: any[] } }>(endpoint)
    const calls = data?._embedded?.calls || []

    cacheService.set(cacheKey, calls, 300000)
    return calls
  }

  /**
   * 7. Звонки по updated_at (GET /api/v4/calls)
   */
  async getCallsByUpdatedAt(fromTimestamp: number, toTimestamp: number): Promise<any[]> {
    const cacheKey = `calls_upd_${fromTimestamp}_${toTimestamp}`
    const cached = cacheService.get<any[]>(cacheKey)
    if (cached) return cached

    const endpoint = `/api/v4/calls?filter[updated_at][from]=${fromTimestamp}&filter[updated_at][to]=${toTimestamp}&limit=250`
    const data = await this.request<{ _embedded?: { calls?: any[] } }>(endpoint)
    const calls = data?._embedded?.calls || []

    cacheService.set(cacheKey, calls, 300000)
    return calls
  }
}

export const amoClient = new AmoClient()
