import { describe, expect, it } from 'vitest'
import { normalizePhoneSearchQuery, parseExactOrderNumberQuery } from '../search'

describe('order search helpers', () => {
  it('normalizes a phone prefix entered with 8 to the stored +7 format', () => {
    expect(normalizePhoneSearchQuery('8900')).toBe('7900')
    expect(normalizePhoneSearchQuery('+7 (900)')).toBe('7900')
  })

  it('does not mistake a phone prefix for an order number', () => {
    expect(parseExactOrderNumberQuery('8900')).toBeNull()
    expect(parseExactOrderNumberQuery('520')).toBe('520')
    expect(parseExactOrderNumberQuery('№8900')).toBe('8900')
  })
})
