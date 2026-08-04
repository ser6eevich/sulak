import { describe, it, expect } from 'vitest'
import { calculateItemsTotal, calculateGrandTotal } from '../orders'

describe('Order Calculations', () => {
  it('should correctly sum up items total price', () => {
    const items = [
      { quantity: 2, unitPrice: 15000 }, // 30000
      { quantity: 1, unitPrice: 45000 }, // 45000
      { quantity: 3, unitPrice: 5000 },  // 15000
    ]
    expect(calculateItemsTotal(items)).toBe(90000)
  })

  it('should calculate grand total with services and discount', () => {
    const itemsTotal = 100000
    const delivery = 3000
    const assembly = 1500
    const discount = 5000
    // 100000 + 3000 + 1500 - 5000 = 99500
    expect(calculateGrandTotal(itemsTotal, delivery, assembly, discount)).toBe(99500)
  })

  it('should not allow grand total to be negative', () => {
    const itemsTotal = 5000
    const delivery = 0
    const assembly = 0
    const discount = 10000 // Скидка больше суммы заказа
    expect(calculateGrandTotal(itemsTotal, delivery, assembly, discount)).toBe(0)
  })
})
