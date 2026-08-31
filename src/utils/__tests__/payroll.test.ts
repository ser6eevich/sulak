import { describe, it, expect } from 'vitest'
import {
  generatePayrollPeriods,
  getEffectiveDeliveryBounds,
  getRateForOrderCount,
  getPeriodBoundsForDate,
} from '../payroll'

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

    it('assigns all of July 14 to the historical period ending that day', () => {
      const { startDate, endDate } = getPeriodBoundsForDate(
        new Date('2026-07-14T20:59:59.999Z') // 14 июля, 23:59:59.999 MSK
      )

      expect(startDate.toISOString()).toBe('2026-06-13T21:00:00.000Z')
      expect(endDate.toISOString()).toBe('2026-07-14T20:59:59.999Z')
    })

    it('starts the transition payroll at midnight on July 15 Moscow time', () => {
      const { startDate, endDate } = getPeriodBoundsForDate(
        new Date('2026-07-14T21:00:00.000Z') // 15 июля, 00:00 MSK
      )

      expect(startDate.toISOString()).toBe('2026-07-14T21:00:00.000Z')
      expect(endDate.toISOString()).toBe('2026-07-31T21:00:00.000Z')
    })
  })

  describe('generatePayrollPeriods', () => {
    it('keeps the current calendar period first through the last day of the month', () => {
      const periods = generatePayrollPeriods(new Date(2026, 7, 31, 12, 0, 0))

      expect(periods[0].label).toBe('1 августа 2026 — 1 сентября 2026')
    })
  })

  describe('getEffectiveDeliveryBounds', () => {
    it('includes the July carry-over and all August deliveries in the August 2026 payroll', () => {
      const start = new Date('2026-07-31T21:00:00.000Z')
      const end = new Date('2026-08-31T21:00:00.000Z')

      expect(getEffectiveDeliveryBounds(start, end)).toEqual({
        deliveryStart: new Date('2026-07-29T21:00:00.000Z'),
        deliveryEnd: end,
      })
    })

    it('does not overlap the September payroll with the August carry-over', () => {
      const start = new Date('2026-08-31T21:00:00.000Z')
      const end = new Date('2026-09-30T21:00:00.000Z')

      expect(getEffectiveDeliveryBounds(start, end)).toEqual({
        deliveryStart: start,
        deliveryEnd: end,
      })
    })
  })
})
