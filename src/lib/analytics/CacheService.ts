/**
 * Простой сервис кэширования в памяти (In-Memory TTL Cache)
 * Используется для временного сохранения ответов amoCRM API (events, talks)
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>()

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  /**
   * Записать значение в кэш с временем жизни (ttlMs в миллисекундах)
   */
  set<T>(key: string, value: T, ttlMs: number = 300000): void { // по умолчанию 5 минут
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  /**
   * Очистить ключ или весь кэш
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

export const cacheService = new CacheService()
