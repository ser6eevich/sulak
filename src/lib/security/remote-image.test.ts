import { describe, expect, it } from 'vitest'
import { assertTrustedYandexUrl } from './remote-image'

describe('assertTrustedYandexUrl', () => {
  it('accepts HTTPS links on Yandex-owned domains', () => {
    expect(assertTrustedYandexUrl('https://downloader.disk.yandex.ru/file.jpg').hostname)
      .toBe('downloader.disk.yandex.ru')
  })

  it('rejects arbitrary hosts, HTTP and credential-bearing URLs', () => {
    expect(() => assertTrustedYandexUrl('https://example.com/file.jpg')).toThrow()
    expect(() => assertTrustedYandexUrl('http://downloader.disk.yandex.ru/file.jpg')).toThrow()
    expect(() => assertTrustedYandexUrl('https://user:pass@disk.yandex.ru/file.jpg')).toThrow()
  })
})
