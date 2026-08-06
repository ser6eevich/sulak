import { requireAccess } from '@/lib/auth/dal'
import { fetchTrustedYandexImage } from '@/lib/security/remote-image'
import { getYandexDiskSettings } from '@/lib/yandex-disk/settings'

export async function GET(request: Request) {
  try {
    await requireAccess('orders', ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'])
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath || filePath.length > 1024) {
      return new Response('Некорректный путь к файлу', { status: 400 })
    }

    const { publicUrl, oauthToken } = await getYandexDiskSettings()

    let downloadTargetUrl = ''
    const headers: Record<string, string> = {}

    let metaApiUrl = ''
    if (publicUrl) {
      metaApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(filePath)}&preview_size=M`
    } else {
      metaApiUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(filePath)}&preview_size=M`
      if (oauthToken) headers.Authorization = `OAuth ${oauthToken}`
    }

    const metaRes = await fetch(metaApiUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!metaRes.ok) return new Response('Файл не найден на Яндекс.Диске', { status: metaRes.status })

    const metaData = (await metaRes.json()) as { preview?: string; file?: string }
    downloadTargetUrl = metaData.preview || metaData.file || ''

    if (!downloadTargetUrl) {
      return new Response('No image preview URL available', { status: 404 })
    }

    // 2. Скачиваем байты превью на бэкенде
    const { bytes, contentType } = await fetchTrustedYandexImage(downloadTargetUrl, 5 * 1024 * 1024)

    // 3. Отдаем байты прямо с нашего сервера в браузер с кэшированием 1 день
    return new Response(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err: unknown) {
    console.error('Ошибка в preview-proxy:', err)
    const message = err instanceof Error ? err.message : 'Ошибка загрузки превью'
    const status = message === 'Не авторизован' ? 401 : message === 'Недостаточно прав' ? 403 : 500
    return new Response(message, { status })
  }
}
