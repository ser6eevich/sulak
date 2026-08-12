/**
 * Модуль автоисправления опечаток и форматирования адресов доставки для CRM «Сулак»
 */

const REPLACEMENTS: [RegExp, string][] = [
  // Регионы и сокращения
  [/\b(м\.?о\.?|мос\.?\s*обл(?:асть)?)\b/gi, 'Московская обл.'],
  [/\b(л\.?о\.?|лен\.?\s*обл(?:асть)?)\b/gi, 'Ленинградская обл.'],
  
  // Частые опечатки в типе населенного пункта / улицы
  [/\b(грод|горд|грда)\b/gi, 'г.'],
  [/\b(пасад|пассад)\b/gi, 'Посад'],
  [/\b(сергиев\s*пасад|сергиев\-посад)\b/gi, 'Сергиев Посад'],
  [/\b(улица|улиц|ул)\b/gi, 'ул.'],
  [/\b(проспект|просп)\b/gi, 'пр-кт'],
  [/\b(переулок|пер)\b/gi, 'пер.'],
  [/\b(проезд)\b/gi, 'пр-д'],
  [/\b(бульвар|бул)\b/gi, 'б-р'],
  [/\b(шоссе)\b/gi, 'ш.'],
  [/\b(область)\b/gi, 'обл.'],
  [/\b(район|рн)\b/gi, 'р-н'],
  [/\b(деревня|дер)\b/gi, 'д.'],
  [/\b(поселок|посёлок|пос)\b/gi, 'пос.'],

  // Частые опечатки в улицах и топонимах
  [/\b(птицеградская|птицеграцкая)\b/gi, 'Птицеградская'],
  [/\b(новосибирская)\b/gi, 'Новосибирская'],
  [/\b(куйбышев|куйбышив)\b/gi, 'Куйбышев'],
  [/\b(гуляева)\b/gi, 'Гуляева'],
  [/\b(ленина)\b/gi, 'Ленина'],
  [/\b(мир[ао])\b/gi, 'Мира'],

  // Опечатки перед номером дома/офиса
  [/\b(дом)\b/gi, 'д.'],
  [/\b(квартира|кв)\b/gi, 'кв.'],
  [/\b(офис|оф)\b/gi, 'оф.'],
]

/**
 * Главная функция исправления опечаток и нормирования адреса
 */
export function normalizeAddress(input?: string | null): string {
  if (!input || !input.trim()) return ''

  let str = input.trim()

  // 1. Применяем замены опечаток
  for (const [regex, replacement] of REPLACEMENTS) {
    str = str.replace(regex, replacement)
  }

  // 2. Исправляем паттерны типов (г. , ул. , д. , кв. , оф. )
  str = str.replace(/\bг\b\.?/gi, 'г.')
  str = str.replace(/\bул\b\.?/gi, 'ул.')
  str = str.replace(/\bд\b\.?\s*(\d+)/gi, 'д. $1')
  str = str.replace(/\bкв\b\.?\s*(\d+)/gi, 'кв. $1')
  str = str.replace(/\bоф\b\.?\s*(\d+)/gi, 'оф. $1')

  // 3. Форматируем заглавные буквы для слов
  const words = str.split(/([\s,.\-/]+)/)
  const formattedWords = words.map(w => {
    if (!w || /[\s,.\-/]+/.test(w)) return w
    
    // Сокращения огибаем в нижний регистр, кроме заглавных аббревиатур
    const lower = w.toLowerCase()
    if (['г.', 'ул.', 'д.', 'кв.', 'оф.', 'обл.', 'р-н', 'пр-кт', 'пер.', 'пр-д', 'б-р', 'ш.'].includes(lower)) {
      return lower
    }

    // Делаем заглавной первую букву слова
    return w.charAt(0).toUpperCase() + w.slice(1)
  })

  str = formattedWords.join('')

  // 4. Расстановка запятых и пробелов
  // Заменяем множественные точки/запятые/пробелы
  str = str
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\.\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()

  // Убираем точки или запятые в самом конце
  str = str.replace(/[,.]+\s*$/, '')

  return str
}

export interface AddressRegionInput {
  region?: string | null
  city?: string | null
  address?: string | null
  deliveryAddress?: string | null
}

export type AddressRegionGroup = 'moscow' | 'near_belt' | 'other'

const MOSCOW_REGION_NAMES = ['москва', 'московская', 'подмосковье', 'мск', 'мо', 'м о', 'тио', 'тинао']

const MOSCOW_LOCALITIES = [
  'балашиха', 'подольск', 'химки', 'мытищи', 'королев', 'люберцы', 'красногорск',
  'электросталь', 'коломна', 'одинцово', 'серпухов', 'щелково', 'домодедово',
  'орехово зуево', 'раменское', 'жуковский', 'пушкино', 'сергиев посад', 'ногинск',
  'долгопрудный', 'реутов', 'воскресенск', 'лобня', 'клин', 'дубна', 'егорьевск',
  'чехов', 'ивантеевка', 'ступино', 'павловский посад', 'дмитров', 'наро фоминск',
  'фрязино', 'лыткарино', 'дзержинский', 'солнечногорск', 'руза', 'можайск',
  'луховицы', 'кашира', 'протвино', 'пущино', 'электрогорск', 'черноголовка',
  'котельники', 'волоколамск', 'кубинка', 'голицыно', 'яхрома', 'талдом',
  'высоковск', 'дрезна', 'зарайск', 'пересвет', 'краснозаводск', 'рошаль',
  'куровское', 'хотьково', 'истра', 'апрелевка', 'бронницы', 'звенигород',
  'краснознаменск', 'шатура', 'старая купавна', 'электроугли', 'дедовск',
  'зержинский', 'птицеградская',
]

const NEAR_BELT_REGION_STEMS = [
  'калуж',
  'тульск',
  'рязан',
  'владимирск',
  'тверск',
  'ярославск',
  'смоленск',
]

const NEAR_BELT_CAPITALS = [
  'калуга',
  'тула',
  'рязань',
  'владимир',
  'тверь',
  'ярославль',
  'смоленск',
]

function normalizeRegionText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasWholePhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `)
}

function hasNearBeltRegionName(text: string): boolean {
  const tokens = text.split(' ')
  return tokens.some(token => NEAR_BELT_REGION_STEMS.some(stem => token.startsWith(stem)))
}

/**
 * Распределяет адрес строго в одну из групп региональной статистики.
 * Явно указанная область имеет приоритет над совпадением по названию города.
 */
export function classifyAddressRegion(input?: AddressRegionInput | null): AddressRegionGroup {
  if (!input) return 'other'

  const region = normalizeRegionText(input.region)
  const city = normalizeRegionText(input.city)
  const address = normalizeRegionText(input.address)
  const deliveryAddress = normalizeRegionText(input.deliveryAddress)
  const combined = [region, city, address, deliveryAddress].filter(Boolean).join(' ')
  const localityText = [city, address, deliveryAddress].filter(Boolean).join(' ')

  if (!combined) return 'other'

  // Поле региона считается самым надёжным источником.
  if (hasNearBeltRegionName(region)) return 'near_belt'
  if (MOSCOW_REGION_NAMES.some(name => hasWholePhrase(region, name))) return 'moscow'

  // В свободном адресе область должна быть указана явно, чтобы улица с похожим
  // названием не меняла категорию заказа.
  const hasNearBeltArea = NEAR_BELT_REGION_STEMS.some(stem =>
    new RegExp(`(?:^| )${stem}[^ ]* (?:обл|область|области)(?: |$)`).test(combined)
  )
  if (hasNearBeltArea) return 'near_belt'

  const hasMoscowArea = [
    'москва',
    'московская обл',
    'московская область',
    'подмосковье',
    'мск',
    'мо',
    'м о',
    'тио',
    'тинао',
  ].some(name => hasWholePhrase(combined, name))
  if (hasMoscowArea) return 'moscow'

  if (NEAR_BELT_CAPITALS.some(name => hasWholePhrase(localityText, name))) return 'near_belt'
  if (MOSCOW_LOCALITIES.some(name => hasWholePhrase(localityText, name))) return 'moscow'

  return 'other'
}

/**
 * Совместимый предикат для существующей аналитики и экспорта МСК/МО.
 */
export function isMoscowOrMoAddress(input?: AddressRegionInput | null): boolean {
  return classifyAddressRegion(input) === 'moscow'
}
