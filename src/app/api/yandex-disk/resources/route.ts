import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/auth/dal'
import { getYandexDiskSettings } from '@/lib/yandex-disk/settings'

interface YandexResourceItem {
  name: string
  type: 'dir' | 'file'
  path: string
  size?: number
  mime_type?: string
}

export async function GET(request: Request) {
  try {
    await requireAccess('orders', ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'])
    const { searchParams } = new URL(request.url)
    const reqPath = searchParams.get('path') || '/'
    if (reqPath.length > 1024) {
      return NextResponse.json({ error: 'Некорректный путь' }, { status: 400 })
    }

    const { publicUrl, oauthToken } = await getYandexDiskSettings()

    if (!publicUrl && !oauthToken) {
      return NextResponse.json({
        error: 'Яндекс.Диск не настроен. Укажите публичную ссылку или OAuth токен в Настройках.',
        configured: false,
      }, { status: 400 })
    }

    let yandexApiUrl = ''
    const headers: Record<string, string> = {}

    if (publicUrl) {
      // Работа с публичной папкой Яндекс.Диска
      const cleanPublicUrl = publicUrl.trim()
      yandexApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(cleanPublicUrl)}&path=${encodeURIComponent(reqPath)}&limit=100&preview_size=M`
    } else {
      // Работа по OAuth токену
      yandexApiUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(reqPath)}&limit=100&preview_size=M`
      headers['Authorization'] = `OAuth ${oauthToken}`
    }

    const res = await fetch(yandexApiUrl, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('ошибка API Яндекс.Диска:', errText)
      return NextResponse.json({ error: 'Не удалось загрузить папки с Яндекс.Диска. Проверьте ссылку в настройках.' }, { status: res.status })
    }

    const data = (await res.json()) as {
      name?: string
      _embedded?: { items?: YandexResourceItem[] }
    }
    const rawItems = data._embedded?.items || []

    const items = rawItems
      .filter((item) => item.type === 'dir' || (item.type === 'file' && item.mime_type?.startsWith('image/')))
      .map((item) => ({
        name: item.name,
        type: item.type,
        path: item.path,
        preview: item.type === 'file' ? `/api/yandex-disk/preview-proxy?path=${encodeURIComponent(item.path)}` : null,
        size: item.size || 0,
        mimeType: item.mime_type || null,
      }))

    return NextResponse.json({
      configured: true,
      currentPath: reqPath,
      folderName: data.name || 'Корень',
      items,
    })
  } catch (err: unknown) {
    console.error('Ошибка роута yandex-disk/resources:', err)
    const message = err instanceof Error ? err.message : 'Ошибка сервера'
    const status = message === 'Не авторизован' ? 401 : message === 'Недостаточно прав' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
