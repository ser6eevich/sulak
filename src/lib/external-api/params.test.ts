import { describe, expect, it } from 'vitest'

import {
  ApiParamError,
  enumerateMoscowDays,
  moscowDayKey,
  parseDateParam,
  resolveDateField,
  resolveIntParam,
  resolveRange,
  resolveSortOrder,
  resolveStatuses,
} from './params'

const params = (qs: string) => new URLSearchParams(qs)

describe('parseDateParam', () => {
  it('трактует YYYY-MM-DD как полночь по Москве (UTC+3)', () => {
    expect(parseDateParam('2026-09-01').toISOString()).toBe('2026-08-31T21:00:00.000Z')
  })

  it('для верхней границы берёт начало следующих суток по Москве', () => {
    expect(parseDateParam('2026-09-01', true).toISOString()).toBe('2026-09-01T21:00:00.000Z')
  })

  it('принимает полную ISO-строку без изменений', () => {
    expect(parseDateParam('2026-09-01T12:34:56Z').toISOString()).toBe('2026-09-01T12:34:56.000Z')
  })

  it('бросает ApiParamError на мусоре', () => {
    expect(() => parseDateParam('вчера')).toThrow(ApiParamError)
  })
})

describe('resolveRange', () => {
  it('по умолчанию — последние 30 суток', () => {
    const now = new Date('2026-09-08T00:00:00.000Z')
    const { from, to } = resolveRange(params(''), now)
    expect(to.toISOString()).toBe('2026-09-08T00:00:00.000Z')
    expect(from.toISOString()).toBe('2026-08-09T00:00:00.000Z')
  })

  it('весь указанный день "to" попадает в диапазон', () => {
    const { to } = resolveRange(params('from=2026-09-01&to=2026-09-07'))
    expect(to.toISOString()).toBe('2026-09-07T21:00:00.000Z')
  })

  it('отклоняет from >= to', () => {
    expect(() => resolveRange(params('from=2026-09-08&to=2026-09-01'))).toThrow(ApiParamError)
  })

  it('отклоняет слишком широкий диапазон', () => {
    expect(() => resolveRange(params('from=2024-01-01&to=2026-01-01'))).toThrow(ApiParamError)
  })
})

describe('resolveStatuses', () => {
  it('пусто без параметра', () => {
    expect(resolveStatuses(params(''))).toEqual([])
  })

  it('парсит CSV', () => {
    expect(resolveStatuses(params('status=delivered,cancelled'))).toEqual(['delivered', 'cancelled'])
  })

  it('бросает на неизвестном статусе', () => {
    expect(() => resolveStatuses(params('status=done'))).toThrow(ApiParamError)
  })
})

describe('resolveDateField', () => {
  it('createdAt по умолчанию', () => {
    expect(resolveDateField(params(''))).toBe('createdAt')
  })

  it('бросает на неизвестном поле', () => {
    expect(() => resolveDateField(params('dateField=paidAt'))).toThrow(ApiParamError)
  })
})

describe('resolveIntParam / resolveSortOrder', () => {
  it('возвращает дефолт', () => {
    expect(resolveIntParam(params(''), 'limit', { def: 50, min: 1, max: 200 })).toBe(50)
  })

  it('валидирует границы', () => {
    expect(() => resolveIntParam(params('limit=999'), 'limit', { def: 50, min: 1, max: 200 })).toThrow(
      ApiParamError,
    )
  })

  it('order по умолчанию desc', () => {
    expect(resolveSortOrder(params(''))).toBe('desc')
    expect(() => resolveSortOrder(params('order=up'))).toThrow(ApiParamError)
  })
})

describe('enumerateMoscowDays', () => {
  it('перечисляет все календарные дни диапазона включительно', () => {
    const range = {
      from: parseDateParam('2026-09-01'),
      to: parseDateParam('2026-09-03', true),
    }
    expect(enumerateMoscowDays(range)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('moscowDayKey отражает московский сдвиг суток', () => {
    expect(moscowDayKey(new Date('2026-08-31T21:30:00.000Z'))).toBe('2026-09-01')
  })
})
