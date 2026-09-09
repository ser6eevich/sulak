import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  order: {
    findUnique: vi.fn(),
  },
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ default: prismaMock }))

import { sendOrderTelegramNotification } from '../telegram'

const orderId = '69e0e7df-d073-4a37-a295-681066b51a25'

function telegramResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function orderFixture(imageUrl: string | null = null) {
  return {
    id: orderId,
    number: '515',
    status: 'pending',
    paymentStatus: 'unpaid',
    totalPrice: 3_900_000,
    discount: 200_000,
    deliveryPrice: 150_000,
    assemblyPrice: 50_000,
    deliveryAddress: 'Калужская область, село Барятино',
    comment: 'Позвонить заранее',
    createdAt: new Date('2026-09-07T14:30:00.000Z'),
    imageUrl,
    client: {
      fullName: 'Каспар',
      primaryPhone: '+79066455610',
      additionalPhone: '+79061234567',
    },
    seller: {
      fullName: 'Анастасия Гофман',
      telegramUsername: 'manager',
    },
    creator: null,
    driver: null,
    items: [
      {
        quantity: 1,
        customTableSize: '240/280x100',
        customChairsCount: null,
        customColor: null,
        variant: {
          size: '240/280x100',
          color: 'Слоновая кость с золотом',
          thickness: null,
          attributes: { tablePattern: 'Мрамор' },
          product: { name: 'стол Голд 240/280x100' },
        },
      },
      {
        quantity: 6,
        customTableSize: null,
        customChairsCount: null,
        customColor: 'Синий',
        variant: {
          size: null,
          color: 'Белый с серебром',
          thickness: null,
          attributes: null,
          product: { name: 'стул Медальон' },
        },
      },
    ],
  }
}

describe('Telegram order message synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$queryRawUnsafe.mockResolvedValue([
      { key: 'telegram_chat_id', value: '-1001234567890' },
      { key: 'telegram_bot_token', value: 'test-token' },
      { key: 'telegram_site_url', value: 'https://stoly.example.test' },
    ])
    prismaMock.order.findUnique.mockResolvedValue(orderFixture())
    prismaMock.systemSetting.findUnique.mockResolvedValue(null)
    prismaMock.systemSetting.upsert.mockResolvedValue({})
    prismaMock.systemSetting.delete.mockResolvedValue({})
    prismaMock.systemSetting.findMany.mockResolvedValue([])
  })

  it('edits the original photo caption when an order message is linked', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ chatId: '-1001234567890', messageId: 42, kind: 'photo' }),
    })
    const fetchMock = vi.fn().mockResolvedValue(
      telegramResponse({ ok: true, result: { message_id: 42 } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendOrderTelegramNotification(orderId, 'updated')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/editMessageCaption')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      chat_id: '-1001234567890',
      message_id: 42,
    })
    const caption = JSON.parse(fetchMock.mock.calls[0][1].body).caption
    expect(caption).toContain('<b>Заказ №515</b>')
    expect(caption).toContain('Комментарий:</b> Позвонить заранее')
    expect(caption).toContain('<code>+79066455610</code>')
    expect(caption).toContain('• <code>+79061234567</code>')
    expect(caption).not.toContain('Доп. телефон:')
    expect(caption).toContain('стол: Голд 240/280, узор: Мрамор, цвет: Слоновая кость с золотом')
    expect(caption).toContain('стул: Медальон — 6 шт, цвет: Синий')
    expect(caption).toContain('• 37 000 ₽')
    expect(caption).not.toContain('Скидка:')
    expect(caption).toContain('Доставка: +1 500 ₽')
    expect(caption).toContain('Сборка и подъём: +500 ₽')
    expect(caption).toContain('<b>Итого: 39 000 ₽</b>')
    expect(caption).toContain('#новый_заказ')
    expect(caption).not.toContain('#заказ_изменен')
    expect(prismaMock.systemSetting.upsert).not.toHaveBeenCalled()
  })

  it('retries a transient network failure and edits the same message', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ chatId: '-1001234567890', messageId: 42, kind: 'text' }),
    })
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        telegramResponse({ ok: true, result: { message_id: 42 } })
      )
    vi.stubGlobal('fetch', fetchMock)

    await sendOrderTelegramNotification(orderId, 'updated')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/editMessageText')
    expect(fetchMock.mock.calls[1][0]).toContain('/editMessageText')
    expect(prismaMock.systemSetting.upsert).not.toHaveBeenCalled()
  })

  it('does not send a supplemental message after a permanent edit error', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ chatId: '-1001234567890', messageId: 42, kind: 'text' }),
    })
    const fetchMock = vi.fn().mockResolvedValue(
      telegramResponse({ ok: false, description: 'Bad Request: message to edit not found' }, 400)
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendOrderTelegramNotification(orderId, 'updated')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/editMessageText')
    expect(prismaMock.systemSetting.upsert).not.toHaveBeenCalled()
  })

  it('creates and links a canonical message for a legacy order', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(
      telegramResponse({ ok: true, result: { message_id: 101 } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendOrderTelegramNotification(orderId, 'updated')

    expect(fetchMock.mock.calls[0][0]).toContain('/sendMessage')
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        value: JSON.stringify({ chatId: '-1001234567890', messageId: 101, kind: 'text' }),
      }),
    }))
  })

  it('stores the first Telegram message id when a new order is sent with a photo', async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderFixture(JSON.stringify({ order_0: ['https://cdn.example.test/order.jpg'] }))
    )
    const fetchMock = vi.fn().mockResolvedValue(
      telegramResponse({ ok: true, result: { message_id: 202 } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendOrderTelegramNotification(orderId, 'new_order')

    expect(fetchMock.mock.calls[0][0]).toContain('/sendPhoto')
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        value: JSON.stringify({ chatId: '-1001234567890', messageId: 202, kind: 'photo' }),
      }),
    }))
  })

  it('does not duplicate a new order that already has a Telegram message', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ chatId: '-1001234567890', messageId: 202, kind: 'text' }),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await sendOrderTelegramNotification(orderId, 'new_order')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(prismaMock.systemSetting.delete).toHaveBeenCalledWith({
      where: { key: `order_telegram_retry_${orderId}` },
    })
  })

  it('queues a new order after a network failure instead of sending a fallback duplicate', async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderFixture(JSON.stringify({ order_0: ['https://cdn.example.test/order.jpg'] }))
    )
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    await sendOrderTelegramNotification(orderId, 'new_order')

    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: `order_telegram_retry_${orderId}` },
      create: expect.objectContaining({ key: `order_telegram_retry_${orderId}` }),
    }))
  })
})
