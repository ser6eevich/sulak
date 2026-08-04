import { describe, it, expect } from 'vitest'
import { getRoleLabel } from '../roles'

describe('getRoleLabel', () => {
  it('should return correct label for admin', () => {
    expect(getRoleLabel('admin')).toBe('Администратор')
  })

  it('should return correct label for driver', () => {
    expect(getRoleLabel('driver')).toBe('Водитель')
  })

  it('should return fallback value for unknown role', () => {
    expect(getRoleLabel('unknown')).toBe('unknown')
  })
})
