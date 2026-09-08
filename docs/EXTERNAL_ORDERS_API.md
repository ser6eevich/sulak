# Внешний API заказов (`/api/external`)

Публичный (по токену) API Сулак CRM для сторонних сервисов. Сделан для
**Авито-сервиса**: вместо устаревшей статистики продаж из MS CRM берём
фактические заказы из CRM. Заказы по аккаунтам Авито **не разделяются** —
отдаётся только общее количество и суммы по проекту.

Базовый префикс:

- **тот же сервер** (Авито-сервис и CRM развёрнуты рядом) — `http://127.0.0.1:<PORT>/api/external`, где `PORT` — порт Next-приложения CRM (по умолчанию `3000`). Идёт мимо nginx, без TLS.
- извне — `https://<домен-crm>/api/external`.

---

## Аутентификация

Токен задаётся на сервере CRM переменной окружения `EXTERNAL_API_TOKEN`
(можно несколько через запятую). Передаётся в **заголовке** — в query-строке
не поддерживается намеренно (попадает в логи/историю).

```
Authorization: Bearer <EXTERNAL_API_TOKEN>
```
либо
```
X-Api-Key: <EXTERNAL_API_TOKEN>
```

| Код | Когда |
|-----|-------|
| `401` | токен отсутствует или неверный |
| `503` | `EXTERNAL_API_TOKEN` не задан на сервере CRM |
| `400` | ошибка в параметрах запроса (текст в поле `error`) |
| `500` | внутренняя ошибка |

Формат ошибки всегда одинаковый:

```json
{ "ok": false, "error": "человекочитаемое описание" }
```

`/api/external/*` исключён из cookie-авторизации веб-приложения (middleware
`src/proxy.ts`), проверяется только токен.

---

## Общие query-параметры

Применяются к `stats`, `daily`, `orders`.

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `from` | `to` − 30 суток | Начало периода, **включительно**. `YYYY-MM-DD` (полночь по Москве, UTC+3) или полная ISO-8601 строка. |
| `to` | текущий момент | Конец периода. Для `YYYY-MM-DD` включается весь этот день (граница = начало следующих суток по Москве). Для ISO — строго до указанного момента. |
| `dateField` | `createdAt` | По какому полю фильтровать/группировать: `createdAt`, `updatedAt`, `shippedAt`, `deliveredAt`, `plannedDeliveryDate`. Для nullable-полей (`shippedAt`, `deliveredAt`, `plannedDeliveryDate`) заказы с `null` в выборку не попадают. |
| `status` | — | CSV-фильтр по статусам (см. ниже). Если задан — берутся строго перечисленные статусы. |
| `includeCancelled` | `false` | Если `status` не задан: включать ли `cancelled`. По умолчанию отменённые исключены. |

Ограничения: максимальный период — **400 суток**; `from` должен быть строго
раньше `to`.

### Статусы заказа (`status`)

| Значение | Метка |
|----------|-------|
| `pending` | Ожидает подтверждения |
| `confirmed` | Подтверждён |
| `production` | В производстве |
| `production_completed` | Готов на производстве |
| `warehouse` | На складе |
| `delivery` | Доставляется |
| `delivered` | Доставлен |
| `cancelled` | Отменён |

### Статусы оплаты (`paymentStatus`)

`unpaid`, `partially_paid`, `paid`.

### Денежные значения

Внутри CRM суммы хранятся в **копейках**. В ответах:

- поля верхнего уровня (`revenue.grandTotal`, `days[].revenue`, `items[].amountRub`) — **в рублях**, округление до целого;
- вложенный объект `kopecks` / поля `*Kopecks` — исходные копейки (для точных расчётов).

Итоговая сумма заказа = `itemsTotal − discount + delivery + assembly`
(`totalPrice − discount + deliveryPrice + assemblyPrice`).

---

## Эндпоинты

### `GET /api/external/ping`

Проверка доступности и токена.

```json
{
  "ok": true,
  "service": "sulak-crm",
  "scope": "external-orders-api",
  "time": "2026-09-08T09:00:00.000Z"
}
```

---

### `GET /api/external/orders/stats`

Агрегаты за период — **основной эндпоинт для Авито-сервиса**.

```
GET /api/external/orders/stats?from=2026-08-01&to=2026-08-31
```

```json
{
  "ok": true,
  "range": {
    "from": "2026-07-31T21:00:00.000Z",
    "to": "2026-08-31T21:00:00.000Z",
    "dateField": "createdAt",
    "statuses": null,
    "includeCancelled": false
  },
  "orders": {
    "total": 1240,
    "byStatus": {
      "pending": 12,
      "confirmed": 30,
      "production": 45,
      "production_completed": 10,
      "warehouse": 25,
      "delivery": 18,
      "delivered": 1100,
      "cancelled": 0
    },
    "byStatusLabels": { "pending": "Ожидает подтверждения", "...": "..." },
    "byPaymentStatus": { "unpaid": 40, "partially_paid": 15, "paid": 1185 }
  },
  "revenue": {
    "currency": "RUB",
    "itemsTotal": 45000000,
    "discount": 1200000,
    "delivery": 900000,
    "assembly": 300000,
    "grandTotal": 45000000,
    "kopecks": {
      "itemsTotal": 4500000000,
      "discount": 120000000,
      "delivery": 90000000,
      "assembly": 30000000,
      "grandTotal": 4500000000
    }
  },
  "generatedAt": "2026-09-08T09:00:00.000Z"
}
```

`orders.total` — то самое «общее количество заказов с проекта».
`byStatus` всегда содержит все ключи статусов (нули для отсутствующих).

---

### `GET /api/external/orders/daily`

Ряд по календарным суткам (по Москве). Дни без заказов присутствуют с нулями —
удобно строить график.

```
GET /api/external/orders/daily?from=2026-09-01&to=2026-09-03&dateField=createdAt
```

```json
{
  "ok": true,
  "range": { "from": "2026-08-31T21:00:00.000Z", "to": "2026-09-03T21:00:00.000Z", "dateField": "createdAt", "statuses": null, "includeCancelled": false },
  "timezone": "Europe/Moscow",
  "totals": { "orders": 57, "revenue": 2100000, "revenueKopecks": 210000000 },
  "days": [
    { "date": "2026-09-01", "orders": 20, "revenue": 750000, "revenueKopecks": 75000000 },
    { "date": "2026-09-02", "orders": 0,  "revenue": 0,      "revenueKopecks": 0 },
    { "date": "2026-09-03", "orders": 37, "revenue": 1350000, "revenueKopecks": 135000000 }
  ],
  "generatedAt": "2026-09-08T09:00:00.000Z"
}
```

---

### `GET /api/external/orders`

Постраничный список заказов **без персональных данных клиента** (нет имени,
телефона, адреса). Нужен для сверки/детализации.

Доп. параметры:

| Параметр | По умолчанию | Диапазон |
|----------|--------------|----------|
| `limit` | `50` | `1..200` |
| `offset` | `0` | `0..1000000` |
| `order` | `desc` | `asc` \| `desc` (сортировка по `dateField`) |

```
GET /api/external/orders?from=2026-09-01&to=2026-09-08&limit=2
```

```json
{
  "ok": true,
  "range": { "from": "2026-08-31T21:00:00.000Z", "to": "2026-09-08T21:00:00.000Z", "dateField": "createdAt", "statuses": null, "includeCancelled": false },
  "pagination": { "limit": 2, "offset": 0, "order": "desc", "total": 143, "returned": 2, "hasMore": true },
  "items": [
    {
      "id": "0b3e...uuid",
      "number": "10432",
      "status": "delivered",
      "paymentStatus": "paid",
      "itemsCount": 2,
      "amountRub": 159000,
      "amountKopecks": 15900000,
      "createdAt": "2026-09-08T07:12:00.000Z",
      "updatedAt": "2026-09-08T15:40:00.000Z",
      "shippedAt": "2026-09-08T09:00:00.000Z",
      "deliveredAt": "2026-09-08T14:30:00.000Z",
      "plannedDeliveryDate": "2026-09-08T00:00:00.000Z"
    }
  ],
  "generatedAt": "2026-09-08T09:00:00.000Z"
}
```

Постраничный обход: увеличивать `offset` на `limit`, пока `pagination.hasMore === true`.

---

## Примеры вызова

### curl

```bash
curl -s "https://<домен-crm>/api/external/orders/stats?from=2026-08-01&to=2026-08-31" \
  -H "Authorization: Bearer $EXTERNAL_API_TOKEN"
```

### TypeScript (для Авито-сервиса)

```ts
const CRM_BASE = process.env.SULAK_CRM_URL!        // http://127.0.0.1:3000 (тот же сервер) или https://<домен-crm>
const CRM_TOKEN = process.env.SULAK_CRM_API_TOKEN! // = EXTERNAL_API_TOKEN на стороне CRM

async function crmGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(`${CRM_BASE}/api/external${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CRM_TOKEN}` },
  })
  const body = await res.json()
  if (!res.ok || body.ok === false) {
    throw new Error(`CRM API ${res.status}: ${body.error ?? res.statusText}`)
  }
  return body as T
}

// Общее число заказов проекта за период
interface CrmOrdersStats {
  ok: true
  orders: { total: number; byStatus: Record<string, number> }
  revenue: { grandTotal: number }
}

export async function getProjectOrdersCount(from: string, to: string): Promise<number> {
  const stats = await crmGet<CrmOrdersStats>('/orders/stats', { from, to })
  return stats.orders.total
}

// Ряд по дням для графика
interface CrmOrdersDaily {
  ok: true
  days: Array<{ date: string; orders: number; revenue: number }>
}

export async function getProjectOrdersByDay(from: string, to: string) {
  const { days } = await crmGet<CrmOrdersDaily>('/orders/daily', { from, to })
  return days
}
```

---

## Замечания по интеграции

- **Один сервер.** Если Авито-сервис и CRM на одной машине — ходите на `http://127.0.0.1:<PORT>`, это минует nginx и TLS. При желании закройте путь снаружи: `location /api/external/ { deny all; return 404; }` в конфиге домена CRM (локальные вызовы не затрагиваются). Общий `EXTERNAL_API_TOKEN` всё равно оставьте — middleware его требует.
- **Часовой пояс.** `daily` группирует по московским суткам (UTC+3, без летнего времени). Границы `from`/`to` в формате `YYYY-MM-DD` тоже считаются по Москве.
- **Что считать «продажей».** Обычно нужен `dateField=createdAt` + дефолтное исключение `cancelled`. Если нужна выручка по факту доставки — `dateField=deliveredAt`.
- **Идемпотентность/кэш.** Ответы не кэшируются (`dynamic = 'force-dynamic'`). Кэшируйте на стороне Авито-сервиса (у него уже есть `CacheService`).
- **Ротация токена.** Сменить `EXTERNAL_API_TOKEN` на сервере CRM → перезапуск приложения. Несколько токенов через запятую позволяют менять без простоя.
- **Расширение.** Новые поля в ответах добавляются обратносовместимо; полагаться на порядок ключей не нужно.

---

## Файлы реализации (в этом репозитории)

| Путь | Назначение |
|------|-----------|
| `src/lib/external-api/auth.ts` | проверка токена, обёртка `withExternalApi` |
| `src/lib/external-api/params.ts` | разбор и валидация query-параметров, работа с датами/МСК |
| `src/lib/external-api/orders.ts` | запросы к БД: `getOrdersStats`, `getOrdersDaily`, `getOrdersList` |
| `src/app/api/external/ping/route.ts` | `GET /api/external/ping` |
| `src/app/api/external/orders/stats/route.ts` | `GET /api/external/orders/stats` |
| `src/app/api/external/orders/daily/route.ts` | `GET /api/external/orders/daily` |
| `src/app/api/external/orders/route.ts` | `GET /api/external/orders` |
| `src/lib/external-api/params.test.ts` | unit-тесты разбора параметров |
| `src/proxy.ts` | `/api/external/*` исключён из cookie-авторизации |
| `.env.example` | переменная `EXTERNAL_API_TOKEN` |
