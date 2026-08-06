import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { uploadFileToStorage } from '@/lib/storage'
import crypto from 'crypto'
import { requireAccess } from '@/lib/auth/dal'
import { fetchTrustedYandexImage } from '@/lib/security/remote-image'
import { getYandexDiskSettings } from '@/lib/yandex-disk/settings'

export async function POST(request: NextRequest) {
  try {
    await requireAccess('orders', ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'])
    const { path } = (await request.json()) as { path?: unknown }

    if (typeof path !== 'string' || !path || path.length > 1024) {
      return NextResponse.json({ error: 'Путь к файлу на Яндекс.Диске обязателен' }, { status: 400 })
    }

    // 1. ПРОВЕРКА КЭША В БАЗЕ ДАННЫХ (Дедупликация на S3)
    const existingCache = await prisma.yandexDiskCache.findUnique({
      where: { yandexPath: path },
    })

    if (existingCache) {
      console.log(`[YandexDiskCache] Файл найден в кэше для пути "${path}". Берем готовый S3 URL.`)
      return NextResponse.json({ imageUrl: existingCache.s3Url, cached: true })
    }

    // 2. ФАЙЛ ВЫБРАН ВПЕРВЫЕ — СКАЧИВАЕМ С ЯНДЕКС.ДИСКА
    const { publicUrl, oauthToken } = await getYandexDiskSettings()
    let yandexApiUrl = ''
    const headers: Record<string, string> = {}

    if (publicUrl) {
      yandexApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`
    } else if (oauthToken) {
      yandexApiUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`
      headers.Authorization = `OAuth ${oauthToken}`
    }

    if (!yandexApiUrl) return NextResponse.json({ error: 'Яндекс.Диск не настроен' }, { status: 400 })

    const linkRes = await fetch(yandexApiUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!linkRes.ok) return NextResponse.json({ error: 'Не удалось получить файл с Яндекс.Диска' }, { status: 502 })
    const linkData = (await linkRes.json()) as { href?: string }
    const downloadUrl = linkData.href

    if (!downloadUrl) {
      return NextResponse.json({ error: 'Не удалось получить ссылку для скачивания файла с Яндекс.Диска' }, { status: 400 })
    }

    // Скачиваем бинарные данные картинки
    const { bytes, contentType } = await fetchTrustedYandexImage(downloadUrl, 15 * 1024 * 1024)
    const buffer = Buffer.from(bytes)

    const ext = path.split('.').pop()?.toLowerCase() || 'jpg'
    const uniqueFileName = `yandex_${crypto.randomUUID()}.${ext}`

    // 3. Загружаем файл в наше S3 хранилище Timeweb
    const s3Url = await uploadFileToStorage(buffer, uniqueFileName, contentType)

    // 4. Записываем привязку в таблицу кэша (чтобы последующие вызовы брали файл из S3 мгновенно)
    await prisma.yandexDiskCache.create({
      data: {
        yandexPath: path,
        s3Url,
      },
    })

    console.log(`[YandexDiskCache] Сохранено новое фото в S3 и запись в кэше: ${path} -> ${s3Url}`)

    return NextResponse.json({ imageUrl: s3Url, cached: false })
  } catch (err: unknown) {
    console.error('Ошибка yandex-disk/select-photo:', err)
    const message = err instanceof Error ? err.message : 'Ошибка сервера'
    const status = message === 'Не авторизован' ? 401 : message === 'Недостаточно прав' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
