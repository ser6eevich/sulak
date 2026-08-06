import { describe, expect, it } from 'vitest'
import { validatePassword } from './password'

describe('validatePassword', () => {
  it('rejects short and one-class passwords', () => {
    expect(validatePassword('abc123')).toContain('10')
    expect(validatePassword('abcdefghij')).toContain('букву и одну цифру')
  })

  it('accepts a sufficiently long password with letters and digits', () => {
    expect(validatePassword('reliable-2026')).toBeNull()
  })
})
