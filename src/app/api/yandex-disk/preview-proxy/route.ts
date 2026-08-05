import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')
    const rawPreviewUrl = searchParams.get('url')

    if (!filePath && !rawPreviewUrl) {
      return new Response('Missing path or url parameter', { status: 400 })
    }

    // Загружаем настройки Яндекс.Диска
    const settings = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
      `SELECT key, value FROM public.system_settings WHERE key IN ('yandex_disk_public_url', 'yandex_disk_token')`
    )

    let publicUrl = process.env.YANDEX_DISK_PUBLIC_URL || ''
    let oauthToken = process.env.YANDEX_DISK_TOKEN || ''

    for (const s of settings) {
      if (s.key === 'yandex_disk_public_url' && s.value) publicUrl = s.value.trim()
      if (s.key === 'yandex_disk_token' && s.value) oauthToken = s.value.trim()
    }

    let downloadTargetUrl = ''
    const headers: Record<string, string> = {}

    if (filePath) {
      // 1. Запрашиваем у API Яндекс.Диска ссылку на превью по пути к файлу
      let metaApiUrl = ''
      if (publicUrl) {
        metaApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(filePath)}&preview_size=M`
      } else {
        metaApiUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(filePath)}&preview_size=M`
        if (oauthToken) headers['Authorization'] = `OAuth ${oauthToken}`
      }

      const metaRes = await fetch(metaApiUrl, { headers, cache: 'no-store' })
      if (!metaRes.ok) {
        return new Response('File meta not found on Yandex.Disk', { status: metaRes.status })
      }

      const metaData = await metaRes.json()
      downloadTargetUrl = metaData.preview || metaData.file
    } else if (rawPreviewUrl) {
      downloadTargetUrl = rawPreviewUrl
      if (oauthToken) headers['Authorization'] = `OAuth ${oauthToken}`
    }

    if (!downloadTargetUrl) {
      return new Response('No image preview URL available', { status: 404 })
    }

    // 2. Скачиваем байты превью на бэкенде
    const imgRes = await fetch(downloadTargetUrl, { headers })
    if (!imgRes.ok) {
      return new Response('Failed to download image preview from Yandex', { status: imgRes.status })
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await imgRes.arrayBuffer()

    // 3. Отдаем байты прямо с нашего сервера в браузер с кэшированием 1 день
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err: any) {
    console.error('Ошибка в preview-proxy:', err)
    return new Response(err?.message || 'Proxy Error', { status: 500 })
  }
}
