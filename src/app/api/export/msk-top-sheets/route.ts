import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { isMoscowOrMoAddress } from '@/utils/address'

export const dynamic = 'force-dynamic'

// ── Типы ────────────────────────────────────────────────────────────────────

interface ProductStat {
  productName: string
  sku: string
  categoryName: string
  size: string | null
  color: string | null
  material: string | null
  orderCount: number
  totalUnits: number
}

// ── Авторизация Google ───────────────────────────────────────────────────────

function getGoogleAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error(
      'Не настроена переменная GOOGLE_SERVICE_ACCOUNT_JSON в .env.local. ' +
      'Скачайте JSON-ключ Service Account из Google Cloud Console и вставьте его содержимое в эту переменную.'
    )
  }

  let credentials: object
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON содержит невалидный JSON. Проверьте значение в .env.local.')
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  })
}

// ── Агрегация МСК позиций ────────────────────────────────────────────────────

async function getMskProductStats(params: {
  dateFrom?: string
  dateTo?: string
}): Promise<{ stats: ProductStat[]; mskCount: number; totalOrders: number }> {
  const orders = await prisma.order.findMany({
    where: {
      status: { not: 'cancelled' },
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
              ...(params.dateTo
                ? { lte: new Date(new Date(params.dateTo).setHours(23, 59, 59, 999)) }
                : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      deliveryAddress: true,
      client: { select: { region: true, city: true, address: true } },
      items: {
        select: {
          quantity: true,
          variant: {
            select: {
              sku: true,
              size: true,
              color: true,
              material: true,
              product: {
                select: {
                  name: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const totalOrders = orders.length
  const mskOrders = orders.filter(o =>
    isMoscowOrMoAddress({
      region: o.client?.region,
      city: o.client?.city,
      address: o.client?.address,
      deliveryAddress: o.deliveryAddress,
    })
  )

  const map = new Map<string, ProductStat>()

  for (const order of mskOrders) {
    const seenInOrder = new Set<string>()
    for (const item of order.items) {
      const v = item.variant
      const key = v.sku
      const alreadyCounted = seenInOrder.has(key)
      seenInOrder.add(key)

      if (!map.has(key)) {
        map.set(key, {
          productName: v.product.name,
          sku: v.sku,
          categoryName: v.product.category.name,
          size: v.size,
          color: v.color,
          material: v.material,
          orderCount: 0,
          totalUnits: 0,
        })
      }
      const stat = map.get(key)!
      if (!alreadyCounted) stat.orderCount += 1
      stat.totalUnits += item.quantity
    }
  }

  const stats = Array.from(map.values()).sort(
    (a, b) => b.orderCount - a.orderCount || b.totalUnits - a.totalUnits
  )

  return { stats, mskCount: mskOrders.length, totalOrders }
}

// ── Запись в Google Sheets ───────────────────────────────────────────────────

async function upsertSpreadsheet(
  auth: InstanceType<typeof google.auth.GoogleAuth>,
  stats: ProductStat[],
  meta: { mskCount: number; totalOrders: number; dateLabel: string; generatedAt: string }
): Promise<string> {
  const sheetsApi = google.sheets({ version: 'v4', auth })

  let spreadsheetId = process.env.GOOGLE_SHEETS_ID || ''
  let spreadsheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : ''

  if (!spreadsheetId) {
    try {
      const created = await sheetsApi.spreadsheets.create({
        requestBody: {
          properties: { title: `Сулак — ТОП МСК ${meta.generatedAt}`, locale: 'ru_RU' },
          sheets: [{ properties: { title: 'ТОП МСК', sheetId: 0 } }],
        },
      })
      spreadsheetId = created.data.spreadsheetId!
      spreadsheetUrl = created.data.spreadsheetUrl!
    } catch (err: unknown) {
      const apiError = err as { message?: string; status?: number }
      if (apiError.message?.includes('permission') || apiError.status === 403) {
        throw new Error(
          'У Service Account квота своего диска = 0 байт. Пожалуйста, создайте Google Таблицу на своём диске, нажмите «Поделиться», выдать доступ Редактора почте sulak-msk@supple-outlet-464708-f7.iam.gserviceaccount.com и укажите ID таблицы в GOOGLE_SHEETS_ID в .env.local'
        )
      }
      throw err
    }
  }

  // ── Формируем данные ──────────────────────────────────────────────────────
  const headerRows: (string | number)[][] = [
    ['Сулак — ТОП позиций по Москве и МО'],
    [`Период: ${meta.dateLabel}`],
    [`Сгенерировано: ${meta.generatedAt}`],
    [`МСК/МО заказов: ${meta.mskCount} из ${meta.totalOrders}`],
    [],
    ['№', 'Модель', 'SKU', 'Категория', 'Размер', 'Цвет', 'Материал', 'Заказов (МСК)', 'Единиц (МСК)', '% от МСК заказов'],
  ]

  const dataRows: (string | number)[][] = stats.map((s, idx) => [
    idx + 1,
    s.productName,
    s.sku,
    s.categoryName,
    s.size     || '',
    s.color    || '',
    s.material || '',
    s.orderCount,
    s.totalUnits,
    meta.mskCount > 0 ? Math.round((s.orderCount / meta.mskCount) * 100) : 0,
  ])

  const allRows = [...headerRows, ...dataRows]

  // Очищаем лист
  await sheetsApi.spreadsheets.values.clear({
    spreadsheetId,
    range: 'A1:Z10000',
  })

  // Записываем данные
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  })

  // ── Форматирование ────────────────────────────────────────────────────────
  const headerRowIdx = 5 // 0-based индекс строки шапки таблицы

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Заголовок документа — жирный, крупный, тёмный фон
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 14, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.18, green: 0.18, blue: 0.24 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        // Шапка таблицы — жирная, синяя
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: headerRowIdx, endRowIndex: headerRowIdx + 1, startColumnIndex: 0, endColumnIndex: 10 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.29, green: 0.39, blue: 1 },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
          },
        },
        // Авто-ширина всех колонок
        {
          autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 },
          },
        },
        // Заморозить шапку
        {
          updateSheetProperties: {
            properties: {
              sheetId: 0,
              gridProperties: { frozenRowCount: headerRowIdx + 1 },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  })

  return spreadsheetUrl
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({ where: { id: user.id } })
    if (!profile || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { dateFrom, dateTo } = body as { dateFrom?: string; dateTo?: string }

    // Агрегация
    const { stats, mskCount, totalOrders } = await getMskProductStats({ dateFrom, dateTo })

    if (stats.length === 0) {
      return NextResponse.json(
        { error: 'Нет данных по МСК заказам за выбранный период' },
        { status: 404 }
      )
    }

    // Google Auth
    const auth = getGoogleAuth()

    // Метка периода
    const dateLabel =
      dateFrom || dateTo
        ? `${dateFrom ? new Date(dateFrom).toLocaleDateString('ru-RU') : '…'} — ${dateTo ? new Date(dateTo).toLocaleDateString('ru-RU') : '…'}`
        : 'За всё время'

    const generatedAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })

    // Запись в Google Sheets
    const url = await upsertSpreadsheet(auth, stats, {
      mskCount,
      totalOrders,
      dateLabel,
      generatedAt,
    })

    return NextResponse.json({ url, statsCount: stats.length, mskCount })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка экспорта в Google Sheets:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
