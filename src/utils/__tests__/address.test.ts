import { describe, expect, it } from 'vitest'
import { classifyAddressRegion, isMoscowOrMoAddress } from '../address'

describe('classifyAddressRegion', () => {
  it.each([
    ['Калужская область', 'Калуга'],
    ['Тульская область', 'Тула'],
    ['Рязанская область', 'Рязань'],
    ['Владимирская область', 'Владимир'],
    ['Тверская область', 'Тверь'],
    ['Ярославская область', 'Ярославль'],
    ['Смоленская область', 'Смоленск'],
  ])('includes %s and its capital in the near belt', (region, capital) => {
    expect(classifyAddressRegion({ region })).toBe('near_belt')
    expect(classifyAddressRegion({ city: capital })).toBe('near_belt')
  })

  it('recognizes inflected and abbreviated near-belt region names in a free-form address', () => {
    expect(classifyAddressRegion({ deliveryAddress: 'Рязанской области, г. Михайлов' })).toBe('near_belt')
    expect(classifyAddressRegion({ deliveryAddress: 'Тульская обл. г. Узловая' })).toBe('near_belt')
  })

  it('gives an explicitly specified near-belt region priority over a Moscow locality', () => {
    expect(classifyAddressRegion({ deliveryAddress: 'Тверская область, г. Клин' })).toBe('near_belt')
    expect(classifyAddressRegion({ deliveryAddress: 'Тульская область, г. Новомосковск' })).toBe('near_belt')
  })

  it('keeps Moscow and Moscow Oblast in their existing group', () => {
    expect(classifyAddressRegion({ region: 'МО', city: 'Химки' })).toBe('moscow')
    expect(classifyAddressRegion({ deliveryAddress: 'МО, г. Одинцово' })).toBe('moscow')
    expect(classifyAddressRegion({ deliveryAddress: 'М.О., г. Балашиха' })).toBe('moscow')
    expect(classifyAddressRegion({ deliveryAddress: 'Московская область, г. Подольск' })).toBe('moscow')
    expect(isMoscowOrMoAddress({ city: 'Москва' })).toBe(true)
  })

  it('does not classify unrelated regions as Moscow or near belt', () => {
    expect(classifyAddressRegion({ region: 'Новосибирская область', city: 'Новосибирск' })).toBe('other')
    expect(classifyAddressRegion({ region: 'Республика Татарстан', city: 'Казань' })).toBe('other')
  })
})
