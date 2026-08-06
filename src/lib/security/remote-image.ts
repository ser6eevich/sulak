import 'server-only'

const YANDEX_HOST_SUFFIXES = ['yandex.net', 'yandex.ru', 'yandexcloud.net']

function isAllowedYandexHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return YANDEX_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)
  )
}

export function assertTrustedYandexUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !isAllowedYandexHost(url.hostname)
  ) {
    throw new Error('Яндекс.Диск вернул недопустимый адрес файла')
  }
  return url
}

export async function fetchTrustedYandexImage(
  rawUrl: string,
  maxBytes: number
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = assertTrustedYandexUrl(rawUrl)
  const response = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) throw new Error('Не удалось скачать изображение с Яндекс.Диска')

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!contentType.startsWith('image/')) throw new Error('Выбранный файл не является изображением')

  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > maxBytes) throw new Error('Изображение превышает допустимый размер')
  if (!response.body) throw new Error('Яндекс.Диск вернул пустой файл')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('Изображение превышает допустимый размер')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { bytes, contentType }
}
