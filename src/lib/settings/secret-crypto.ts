import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const PREFIX = 'enc:v1'

function encryptionKey(): Buffer {
  const rawKey = process.env.SETTINGS_ENCRYPTION_KEY
  if (!rawKey || rawKey.length < 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY должен быть задан и содержать не менее 32 символов')
  }
  return createHash('sha256').update(rawKey).digest()
}

export function encryptSecret(value: string): string {
  if (!value || value.startsWith(`${PREFIX}:`)) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(`${PREFIX}:`)) return value
  const [, version, ivRaw, tagRaw, encryptedRaw] = value.split(':')
  if (`enc:${version}` !== PREFIX || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Повреждено зашифрованное значение настройки')
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
