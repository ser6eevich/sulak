import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reqPath = searchParams.get('path') || '/'

    // Загружаем настройки Яндекс.Диска из базы
    const settings = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
      `SELECT key, value FROM public.system_settings WHERE key IN ('yandex_disk_public_url', 'yandex_disk_token')`
    )

    let publicUrl = process.env.YANDEX_DISK_PUBLIC_URL || ''
    let oauthToken = process.env.YANDEX_DISK_TOKEN || ''

    for (const s of settings) {
      if (s.key === 'yandex_disk_public_url' && s.value) publicUrl = s.value.trim()
      if (s.key === 'yandex_disk_token' && s.value) oauthToken = s.value.trim()
    }

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

    const res = await fetch(yandexApiUrl, { headers, cache: 'no-store' })

    if (!res.ok) {
      const errText = await res.text()
      console.error('ошибка API Яндекс.Диска:', errText)
      return NextResponse.json({ error: 'Не удалось загрузить папки с Яндекс.Диска. Проверьте ссылку в настройках.' }, { status: res.status })
    }

    const data = await res.json()
    const rawItems = data._embedded?.items || []

    const items = rawItems
      .filter((i: any) => i.type === 'dir' || (i.type === 'file' && i.mime_type?.startsWith('image/')))
      .map((i: any) => ({
        name: i.name,
        type: i.type, // 'dir' | 'file'
        path: i.path,
        preview: i.preview || null,
        file: i.file || null, // URL прямого скачивания для публичных файлов
        size: i.size || 0,
        mimeType: i.mime_type || null,
      }))

    return NextResponse.json({
      configured: true,
      currentPath: reqPath,
      folderName: data.name || 'Корень',
      items,
    })
  } catch (err: any) {
    console.error('Ошибка роута yandex-disk/resources:', err)
    return NextResponse.json({ error: err.message || 'Ошибка сервера' }, { status: 500 })
  }
}
