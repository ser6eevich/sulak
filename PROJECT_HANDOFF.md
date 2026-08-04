# 📌 PROJECT HANDOFF — СУЛАК CRM (Инструкция по перезапуску и передаче контекста для AI)

> **Для Antigravity / AI-помощника на macOS:**
> Прочитай этот файл перед началом работы! Здесь описана архитектура, бизнес-логика, структура базы данных, финансовые правила и пошаговая инструкция развёртывания проекта «Сулак CRM» на макбуке (macOS).

---

## 🚀 1. Общие сведения о проекте

**Сулак CRM** — это высоконагруженная ERP/CRM веб-система управления производством, продажами, логистикой и расчётом зарплат для фабрики мебели «Сулак».

* **Репозиторий / Папка:** `Sulak`
* **Технологический стек:**
  * **Core:** Next.js 16 (App Router), React 19, TypeScript
  * **База данных:** PostgreSQL (`sulak_db`)
  * **ORM:** Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`)
  * **Стили:** TailwindCSS v4 + CSS (светлая/тёмная тема, адаптивный UI)
  * **Авторизация:** Безопасные HTTP-only JWT-куки (`sulak_session` via `jose` + `bcryptjs`)
  * **Хранилище медиа/фото:** Облачный адаптер S3 (`@aws-sdk/client-s3` в `src/lib/storage.ts`) с авто-fallback в локальный каталог
  * **Интеграции:** Telegram Bot API (алерты по просроченным заказам)

---

## 🔑 2. Пользователи и Роли в системе

Все пароли для локальной разработки: `123456`

1. **Владелец (Owner):** `bilal@sulak.ru`
2. **Администратор (Admin):** `admin@sulak.ru`
3. **Менеджеры продаж:**
   * **Зоя:** `zoya@sulak.ru`
   * **Софа:** `sofa@sulak.ru`
4. **Водители / Логисты:**
   * **Ризван:** `driver-5f3f987f@sulak.ru`
5. **Цех / Производство / Склад:**
   * `production@sulak.ru`, `warehouse@sulak.ru`

---

## 💼 3. Ключевая бизнес-логика и тонкости расчёта ЗП

### 3.1. Расчёт Зарплаты Менеджеров (`/payroll`)
* **Сетка ставок за доставленный подзаказ (зависит от объёма за период):**
  * `< 65` заказов ➔ **850 ₽**
  * `< 80` заказов ➔ **1 000 ₽**
  * `< 100` заказов ➔ **1 300 ₽**
  * `< 120` заказов ➔ **1 700 ₽**
  * `>= 120` заказов ➔ **2 000 ₽**
* **Отчетные периоды:**
  * Переходный период: **15 июля — 1 августа 2026**
  * Исторические периоды: с 15-го по 14-е число (например, 14.06 – 14.07, 14.05 – 14.06).
* **Многосоставные заказы (SubOrders):**
  * Заказы с несколькими товарами (например, №214 и №231 по 2 предмета) имеют у каждого предмета свой `subOrderIndex` (`0`, `1`, `2`...).
  * Каждый подзаказ считается как **отдельная доставка** и оплачивается поштучно.
* **Печать выписки А4:**
  * Кнопка печатной выписки в [PayrollClient.tsx](file:///src/app/(dashboard)/payroll/PayrollClient.tsx) открывает отдельное окно `window.open()`, отпозиционированное по верху страницы (`top: 0`), со стилями `@page { size: A4 portrait; margin: 12mm; }`.
  * Выписка включает колонки: *№ Заказа*, *Дата оформления*, *Дата вручения*, *Сумма*, *Статус*, *Ставка*.

### 3.2. Статусы Заказов (`Order.status`)
* `pending` — Ожидает подтверждения
* `confirmed` — Подтвержден
* `production` — В производстве
* `production_completed` — Готов на производстве
* `warehouse` — На складе
* `delivery` — В доставке
* `delivered` — Доставлен
* `cancelled` — Отменен

---

## 🛠️ 4. Пошаговая инструкция по развёртыванию на macOS (Mac)

### Шаг 1. Установка PostgreSQL на macOS через Homebrew
```bash
# 1. Установка PostgreSQL (если еще не установлен)
brew install postgresql@15

# 2. Запуск службы PostgreSQL
brew services start postgresql@15

# 3. Создание базы данных sulak_db
createdb sulak_db
```

### Шаг 2. Создание файла `.env.local`
В корне проекта создай файл `.env.local`:
```env
# База данных PostgreSQL на Mac
DATABASE_URL="postgresql://localhost:5432/sulak_db"

# Ключ авторизации JWT
JWT_SECRET="sulak-secret-key-macbook-dev-2026"

# Защитный секрет для Крона
CRON_SECRET="sulak-cron-secret-dev-2026"

# S3 Бакет (опционально, если ключи не заданы - сохраняет локально в dev режиме)
S3_BUCKET_NAME="sulak-crm-uploads"
S3_REGION="ru-central1"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""

# Telegram бот
TELEGRAM_BOT_TOKEN="8740932255:AAFr6dNDwAUgDobwgUNIzQDc8SAV3Ks21TM"
TELEGRAM_CHAT_ID="1803301964"

PORT=3000
```

### Шаг 3. Установка зависимостей и накатывание схемы БД
```bash
# 1. Установка зависимостей
npm install

# 2. Создание таблиц в PostgreSQL и генерация Prisma Client
npx prisma db push
npx prisma generate

# 3. (Опционально) Импорт дампа данных или сидинг
```

### Шаг 4. Запуск сервера разработки
```bash
# Обычный запуск:
npm run dev

# Запуск с доступом по локальной сети Wi-Fi (чтобы заходить с телефона/планшета/другого ноута):
npx next dev -H 0.0.0.0 -p 3000
```

---

## 🛡️ 5. Безопасность и важные файлы настройки

* **[next.config.ts](file:///next.config.ts):** содержит `allowedDevOrigins` и `allowedOrigins` для работы Server Actions и HMR с локальных IP (`192.168.x.x`) и туннелей.
* **[src/lib/storage.ts](file:///src/lib/storage.ts):** адаптер загрузки медиафайлов (S3 / Local disk).
* **[src/app/api/cron/check-stale-orders/route.ts](file:///src/app/api/cron/check-stale-orders/route.ts):** защищенный крон с проверкой `CRON_SECRET`.
* **[DEPLOYMENT.md](file:///DEPLOYMENT.md):** подробное руководство по деплою на VDS/VPS сервер.

---

## 🎯 Инструкция для AI на маке:
> При открытии проекта на Mac просто просканируй данный файл `PROJECT_HANDOFF.md` и файл `prisma/schema.prisma`. Вся архитектура, структура данных и правила расчетов уже состыкованы и готовы к работе!
