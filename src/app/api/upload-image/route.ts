import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { uploadFileToStorage } from '@/lib/storage'
import crypto from 'crypto'

/**
 * POST /api/upload-image
 * Загрузка изображений (каталог, фото чеков, аватары, отзывы).
 * Защищена авторизацией пользователя.
 * Загружает файл напрямую в S3 бакет при наличии S3 ключей в окружении.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Проверяем аутентификацию пользователя
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // 2. Читаем файл из multipart/form-data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден в запросе' }, { status: 400 })
    }

    // 3. Проверка типа файла — только изображения
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Разрешена загрузка только изображений' }, { status: 400 })
    }

    // 4. Лимит размера файла — максимум 15 МБ
    const MAX_FILE_SIZE = 15 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Размер файла превышает лимит 15 МБ' }, { status: 400 })
    }

    // 5. Строгая проверка допустимых расширений
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Разрешены только форматы изображений (JPG, PNG, WEBP, GIF, HEIC)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Генерация случайного имени файла
    const uniqueFileName = `${crypto.randomUUID()}.${ext}`

    // Загрузка в S3 хранилище (или fallback на локальный дистрибутив при отсутствии ключей)
    const imageUrl = await uploadFileToStorage(buffer, uniqueFileName, file.type)

    return NextResponse.json({ imageUrl })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Ошибка сервера при загрузке изображения' },
      { status: 500 }
    )
  }
}
