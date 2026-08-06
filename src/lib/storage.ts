import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * Универсальный модуль загрузки файлов (S3 Bucket / Fallback).
 * 
 * Если в .env / .env.local заданы переменные S3 (S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY),
 * файл загружается напрямую в облачное S3 хранилище.
 * 
 * Если ключи пока не заданы, модуль содействует локальной разработке.
 */
export async function uploadFileToStorage(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME
  const region = process.env.S3_REGION || 'us-east-1'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const endpoint = process.env.S3_ENDPOINT // Опционально для Yandex Cloud, VK Cloud, Selectel, MinIO
  const publicUrlPrefix = process.env.S3_PUBLIC_URL_PREFIX // Публичный домен или ссылка на бакет

  // 1. Проверяем наличие конфигурации S3
  if (bucketName && accessKeyId && secretAccessKey) {
    const s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    const disableAcl = process.env.S3_DISABLE_ACL === 'true'

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        ...(disableAcl ? {} : { ACL: 'public-read' }),
      })
      await s3Client.send(command)
    } catch (err: unknown) {
      const storageError = err as { name?: string; message?: string }
      // Если бакет не поддерживает Object ACL (например, Yandex Cloud с Bucket Owner Enforced),
      // пробуем повторить загрузку без параметра ACL
      if (storageError.name === 'AccessControlListNotSupported' || storageError.message?.includes('ACL')) {
        const commandWithoutAcl = new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: contentType,
        })
        await s3Client.send(commandWithoutAcl)
      } else {
        throw err
      }
    }

    // Возвращаем сформированную публичную ссылку на S3
    if (publicUrlPrefix) {
      const cleanPrefix = publicUrlPrefix.replace(/\/$/, '')
      return `${cleanPrefix}/${fileName}`
    }

    if (endpoint) {
      const cleanEndpoint = endpoint.replace(/\/$/, '')
      return `${cleanEndpoint}/${bucketName}/${fileName}`
    }

    return `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`
  }

  // 2. В продакшн-режиме (или при включенном STRICT_S3) запрещаем сохранение на локальный диск сервера
  const isProduction = process.env.NODE_ENV === 'production' || process.env.STRICT_S3 === 'true'
  if (isProduction) {
    throw new Error(
      'Хранение на локальном диске запрещено в продакшене. Настройте S3 хранилище в .env (S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).'
    )
  }

  // 3. Локальный вариант исключительно для разработки (Development fallback)
  const fs = await import('fs')
  const path = await import('path')

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  const filePath = path.join(uploadsDir, fileName)
  fs.writeFileSync(filePath, buffer)

  return `/uploads/${fileName}`
}
