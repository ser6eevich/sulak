import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { uploadFileToStorage } from '@/lib/storage'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { path, fileUrl } = await request.json()

    if (!path) {
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
    let downloadUrl = fileUrl

    if (!downloadUrl) {
      // Запрашиваем прямую ссылку на скачивание через Yandex API
      const settings = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
        `SELECT key, value FROM public.system_settings WHERE key IN ('yandex_disk_public_url', 'yandex_disk_token')`
      )

      let publicUrl = process.env.YANDEX_DISK_PUBLIC_URL || ''
      let oauthToken = process.env.YANDEX_DISK_TOKEN || ''

      for (const s of settings) {
        if (s.key === 'yandex_disk_public_url' && s.value) publicUrl = s.value.trim()
        if (s.key === 'yandex_disk_token' && s.value) oauthToken = s.value.trim()
      }

      let yandexApiUrl = ''
      const headers: Record<string, string> = {}

      if (publicUrl) {
        yandexApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`
      } else if (oauthToken) {
        yandexApiUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`
        headers['Authorization'] = `OAuth ${oauthToken}`
      }

      if (yandexApiUrl) {
        const linkRes = await fetch(yandexApiUrl, { headers })
        if (linkRes.ok) {
          const linkData = await linkRes.json()
          downloadUrl = linkData.href
        }
      }
    }

    if (!downloadUrl) {
      return NextResponse.json({ error: 'Не удалось получить ссылку для скачивания файла с Яндекс.Диска' }, { status: 400 })
    }

    // Скачиваем бинарные данные картинки
    const imgRes = await fetch(downloadUrl)
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Ошибка скачивания фото с Яндекс.Диска' }, { status: 500 })
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await imgRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

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
  } catch (err: any) {
    console.error('Ошибка yandex-disk/select-photo:', err)
    return NextResponse.json({ error: err.message || 'Ошибка сервера' }, { status: 500 })
  }
}
