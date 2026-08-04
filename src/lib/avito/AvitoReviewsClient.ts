/**
 * AvitoReviewsClient.ts
 * OAuth2 client_credentials клиент для Авито Ratings API.
 * Документация: https://developers.avito.ru/api-catalog/ratings/documentation
 */

const AVITO_TOKEN_URL = 'https://api.avito.ru/token'
const AVITO_API_BASE = 'https://api.avito.ru'

export interface AvitoReview {
  id: number
  score?: number           // 1, 2, 3, 4, 5
  stage?: string
  text?: string
  createdAt: number        // Unix timestamp (seconds)
  item?: {
    id: number
    title: string
  }
  sender?: {
    name?: string
  }
  author?: {
    url?: string
    name?: string
    avatarUrl?: string
  }
  answer?: {
    text: string
    createdAt: number
  }
}

interface AvitoRatingsResponse {
  reviews?: AvitoReview[]
  entries?: AvitoReview[]
}

// Кэш токенов в памяти: ключ = clientId
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/**
 * Получить OAuth2 access token по client_credentials
 */
async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const cached = tokenCache.get(clientId)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const res = await fetch(AVITO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Авито OAuth2 error [${res.status}]: ${body}`)
  }

  const data = await res.json()
  const token = data.access_token as string
  const expiresIn = (data.expires_in as number) || 3600

  tokenCache.set(clientId, {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  })

  return token
}

/**
 * Получить список последних отзывов аккаунта через Авито API.
 * GET /ratings/v1/reviews?limit=20&offset=0
 */
export async function fetchAvitoReviews(
  clientId: string,
  clientSecret: string,
  limit = 20
): Promise<AvitoReview[]> {
  const token = await getAccessToken(clientId, clientSecret)

  const url = `${AVITO_API_BASE}/ratings/v1/reviews?limit=${limit}&offset=0`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Авито Ratings API error [${res.status}]: ${body}`)
  }

  const data: AvitoRatingsResponse = await res.json()
  return data.reviews || data.entries || []
}

/**
 * Сформировать ссылку на отзыв
 */
export function buildReviewUrl(authorUrl?: string): string {
  return authorUrl || 'https://www.avito.ru'
}

/**
 * Перевести тип/оценку отзыва в эмодзи/текст
 */
export function reviewTypeLabel(score?: number): string {
  if (!score) return '💬 Отзыв'
  if (score >= 4) return '⭐ Положительный'
  if (score <= 2) return '👎 Отрицательный'
  return '💬 Нейтральный'
}
