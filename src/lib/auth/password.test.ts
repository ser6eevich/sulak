import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPORARY_PASSWORD,
  validateAdministrativePassword,
  validatePassword,
} from './password'

describe('validatePassword', () => {
  it('rejects short and one-class passwords', () => {
    expect(validatePassword('abc123')).toContain('10')
    expect(validatePassword('abcdefghij')).toContain('букву и одну цифру')
  })

  it('accepts a sufficiently long password with letters and digits', () => {
    expect(validatePassword('reliable-2026')).toBeNull()
  })

  it('allows the standard temporary password only in administrative flows', () => {
    expect(validatePassword(DEFAULT_TEMPORARY_PASSWORD)).toContain('10')
    expect(validateAdministrativePassword(DEFAULT_TEMPORARY_PASSWORD)).toBeNull()
    expect(validateAdministrativePassword('12345')).toContain('10')
  })
})
