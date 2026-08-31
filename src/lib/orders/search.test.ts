import { describe, expect, it } from 'vitest'
import { parseExactOrderNumberQuery } from './search'

describe('parseExactOrderNumberQuery', () => {
  it.each([
    ['427', '427'],
    ['№427', '427'],
    ['#427', '427'],
    ['427 заказ', '427'],
  ])('recognizes an exact order number in %s', (query, expected) => {
    expect(parseExactOrderNumberQuery(query)).toBe(expected)
  })

  it.each([
    '+7 999 427-00-00',
    '79994270000',
    'Иван 427',
    '427-428',
  ])('keeps non-order queries in text search mode: %s', (query) => {
    expect(parseExactOrderNumberQuery(query)).toBeNull()
  })
})
