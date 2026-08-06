import { afterEach, describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './secret-crypto'

const originalKey = process.env.SETTINGS_ENCRYPTION_KEY

afterEach(() => {
  if (originalKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY
  else process.env.SETTINGS_ENCRYPTION_KEY = originalKey
})

describe('integration secret encryption', () => {
  it('round-trips AES-GCM values without exposing plaintext', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = 'test-only-key-that-is-longer-than-32-characters'
    const encrypted = encryptSecret('sensitive-token')
    expect(encrypted).toMatch(/^enc:v1:/)
    expect(encrypted).not.toContain('sensitive-token')
    expect(decryptSecret(encrypted)).toBe('sensitive-token')
  })

  it('keeps legacy plaintext readable during rollout', () => {
    expect(decryptSecret('legacy-token')).toBe('legacy-token')
  })
})
