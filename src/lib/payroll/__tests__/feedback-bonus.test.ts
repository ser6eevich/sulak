import { describe, expect, it } from 'vitest'
import { getFeedbackBonus } from '../feedback-bonus'

describe('getFeedbackBonus', () => {
  it('calculates the photo review bonus by rating', () => {
    expect(getFeedbackBonus('with_photo', 5)).toBe(500)
    expect(getFeedbackBonus('with_photo', 4)).toBe(400)
    expect(getFeedbackBonus('with_photo', 3)).toBe(300)
  })

  it('applies the same rating reductions to a text review', () => {
    expect(getFeedbackBonus('no_photo', 5)).toBe(300)
    expect(getFeedbackBonus('no_photo', 4)).toBe(200)
    expect(getFeedbackBonus('no_photo', 3)).toBe(100)
  })

  it('preserves the historical bonus for a review without a rating', () => {
    expect(getFeedbackBonus('with_photo', null)).toBe(500)
    expect(getFeedbackBonus('no_photo', undefined)).toBe(300)
  })
})
