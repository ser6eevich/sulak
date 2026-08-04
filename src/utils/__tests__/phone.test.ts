import { describe, it, expect } from 'vitest'
import { normalizePhoneNumber, validatePhoneNumber } from '../phone'

describe('Phone Number Utility', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize standard Russian mobile number with +7', () => {
      expect(normalizePhoneNumber('+7 (928) 123-45-67')).toBe('+79281234567')
    })

    it('should normalize standard Russian mobile number starting with 8', () => {
      expect(normalizePhoneNumber('89281234567')).toBe('+79281234567')
    })

    it('should normalize Russian mobile number without country code', () => {
      expect(normalizePhoneNumber('9281234567')).toBe('+79281234567')
    })

    it('should strip all formatting characters', () => {
      expect(normalizePhoneNumber(' +7-928-123-45-67 ')).toBe('+79281234567')
    })
  })

  describe('validatePhoneNumber', () => {
    it('should return true for valid Russian mobile numbers', () => {
      expect(validatePhoneNumber('+7 (928) 123-45-67')).toBe(true)
      expect(validatePhoneNumber('89281234567')).toBe(true)
      expect(validatePhoneNumber('9281234567')).toBe(true)
    })

    it('should return false for invalid formats', () => {
      expect(validatePhoneNumber('12345')).toBe(false)
      expect(validatePhoneNumber('+7 (928) 123-45-6')).toBe(false) // short
      expect(validatePhoneNumber('')).toBe(false)
    })
  })
})
