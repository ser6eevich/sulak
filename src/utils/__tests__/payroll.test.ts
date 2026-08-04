import { describe, it, expect } from 'vitest'
import { getRateForOrderCount, getPeriodBoundsForDate } from '../payroll'

describe('Payroll Calculations', () => {
  describe('getRateForOrderCount', () => {
    it('should return 850 for order count less than 65', () => {
      expect(getRateForOrderCount(0)).toBe(850)
      expect(getRateForOrderCount(10)).toBe(850)
      expect(getRateForOrderCount(64)).toBe(850)
    })

    it('should return 1000 for order count between 65 and 79', () => {
      expect(getRateForOrderCount(65)).toBe(1000)
      expect(getRateForOrderCount(70)).toBe(1000)
      expect(getRateForOrderCount(79)).toBe(1000)
    })

    it('should return 1300 for order count between 80 and 99', () => {
      expect(getRateForOrderCount(80)).toBe(1300)
      expect(getRateForOrderCount(90)).toBe(1300)
      expect(getRateForOrderCount(99)).toBe(1300)
    })

    it('should return 1700 for order count between 100 and 119', () => {
      expect(getRateForOrderCount(100)).toBe(1700)
      expect(getRateForOrderCount(110)).toBe(1700)
      expect(getRateForOrderCount(119)).toBe(1700)
    })

    it('should return 2000 for order count 120 and above', () => {
      expect(getRateForOrderCount(120)).toBe(2000)
      expect(getRateForOrderCount(150)).toBe(2000)
    })
  })

  describe('getPeriodBoundsForDate', () => {
    it('should calculate correct bounds for a date after the 14th of the month', () => {
      // 15 июня 2026 => период: 14 июня - 14 июля
      const testDate = new Date(2026, 5, 15) // Июнь (0-indexed => 5)
      const { startDate, endDate } = getPeriodBoundsForDate(testDate)

      expect(startDate.getFullYear()).toBe(2026)
      expect(startDate.getMonth()).toBe(5) // Июнь
      expect(startDate.getDate()).toBe(14)
      expect(startDate.getHours()).toBe(0)

      expect(endDate.getFullYear()).toBe(2026)
      expect(endDate.getMonth()).toBe(6) // Июль
      expect(endDate.getDate()).toBe(14)
      expect(endDate.getHours()).toBe(23)
    })

    it('should calculate correct bounds for a date before the 14th of the month', () => {
      // 10 июня 2026 => период: 14 мая - 14 июня
      const testDate = new Date(2026, 5, 10) // Июнь
      const { startDate, endDate } = getPeriodBoundsForDate(testDate)

      expect(startDate.getFullYear()).toBe(2026)
      expect(startDate.getMonth()).toBe(4) // Май
      expect(startDate.getDate()).toBe(14)

      expect(endDate.getFullYear()).toBe(2026)
      expect(endDate.getMonth()).toBe(5) // Июнь
      expect(endDate.getDate()).toBe(14)
    })
  })
})
