import { describe, expect, it } from 'vitest'
import { resolveRetrospectiveOrderFields } from '@/lib/orders/retrospective-order'

describe('resolveRetrospectiveOrderFields', () => {
  it('does not update retrospective fields when the mode is disabled', () => {
    expect(resolveRetrospectiveOrderFields({
      enabled: false,
      customCreatedAt: '2026-08-16T12:00:00.000Z',
      status: 'pending',
      paymentStatus: 'unpaid',
    })).toBeNull()
  })

  it('returns the selected creation date and statuses', () => {
    const result = resolveRetrospectiveOrderFields({
      enabled: true,
      customCreatedAt: '2026-08-16T12:00:00.000Z',
      status: 'production',
      paymentStatus: 'paid',
    })

    expect(result).toEqual({
      createdAt: new Date('2026-08-16T12:00:00.000Z'),
      deliveredAt: null,
      status: 'production',
      paymentStatus: 'paid',
    })
  })

  it('requires a delivery date for an already delivered order', () => {
    expect(() => resolveRetrospectiveOrderFields({
      enabled: true,
      customCreatedAt: '2026-08-16T12:00:00.000Z',
      status: 'delivered',
      paymentStatus: 'paid',
    })).toThrow('Укажите дату и время доставки заказа')
  })

  it('rejects an invalid creation date', () => {
    expect(() => resolveRetrospectiveOrderFields({
      enabled: true,
      customCreatedAt: 'not-a-date',
    })).toThrow('Некорректная дата и время создания заказа')
  })
})
