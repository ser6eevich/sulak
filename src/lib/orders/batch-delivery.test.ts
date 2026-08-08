import { describe, expect, it } from 'vitest'
import { extractBatchOrderNumbers } from './batch-delivery'

describe('extractBatchOrderNumbers', () => {
  it('extracts order numbers from a driver report', () => {
    expect(extractBatchOrderNumbers('168 заказ\n171 заказ\n№181, #194')).toEqual([
      '168',
      '171',
      '181',
      '194',
    ])
  })

  it('deduplicates numbers and normalizes leading zeroes', () => {
    expect(extractBatchOrderNumbers('№00168; 168; заказ 000')).toEqual(['168', '0'])
  })

  it('ignores words and date-like values', () => {
    expect(extractBatchOrderNumbers('доставлено 08.08.2026, заказ №225')).toEqual(['225'])
  })
})
