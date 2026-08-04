# 🚀 Инструкция по развёртыванию системы «Сулак CRM» на сервере (Production / VDS)

Данный документ предназначен для системного администратора и DevOps-инженера компании.

---

## 📋 1. Архитектура и технологии

* **Фреймворк:** Next.js 16 (App Router) + React 19 + TypeScript
* **База данных:** PostgreSQL 15+ (автономная СУБД)
* **ORM:** Prisma 7 (драйвер `@prisma/client` + `@prisma/adapter-pg`)
* **Авторизация:** Безопасная JWT-авторизация в HTTP-only куках (`jose` + `bcryptjs`)
* **Хранение медиа/фото:** Облачное хранилище S3 (VK Cloud, Yandex Cloud, AWS S3, Selectel или MinIO) с автоматическим fallback в dev-режиме
* **Защита Cron:** Валидация bearer-токена `CRON_SECRET` для защиты автоматических задач от публичного вызова
* **Интеграция:** Telegram Bot API (уведомления и алерты)

---

## 🛠️ 2. Безопасность и проверка API-ручек

1. **Авторизация всех серверных методов:**
   Все Server Actions и ключевые маршруты API (`/api/upload-image` и т.д.) проверяют активную сессию пользователя через Supabase/JWT авторизацию.
2. **Защита фоновых задач (Cron):**
   Маршрут `/api/cron/check-stale-orders` защищен проверкой секретного токена `CRON_SECRET`:
   * В заголовках запроса передается: `Authorization: Bearer <CRON_SECRET>` или `x-cron-secret: <CRON_SECRET>`.
   * При отсутствии правильного токена сервер возвращает `401 Unauthorized`.

---

## 📦 3. Интеграция с S3 Бакет (Облачное хранилище фото)

Для загрузки каталога товаров, сканов, аватарок и фото-отзывов система использует модуль `@aws-sdk/client-s3`. 

> **ВНИМАНИЕ (ВАЖНО ДЛЯ ПРОДАКШЕНА):**
> В режиме продакшена (`NODE_ENV=production` или `STRICT_S3=true`) сохранение загружаемых файлов на локальный диск сервера полностью заблокировано. Настройка переменных S3 является **ОБЯЗАТЕЛЬНОЙ**, иначе загрузка файлов вернёт статус ошибки `400 / 500`.

Для подключения S3 на прод-сервере укажите следующие переменные окружения в `.env.local`:

```env
S3_BUCKET_NAME="sulak-crm-uploads"
S3_REGION="ru-central1"
S3_ACCESS_KEY_ID="ВАШ_S3_ACCESS_KEY"
S3_SECRET_ACCESS_KEY="ВАШ_S3_SECRET_KEY"
S3_ENDPOINT="https://storage.yandexcloud.net"               # Опционально для S3-совместимых провайдеров
S3_PUBLIC_URL_PREFIX="https://storage.yandexcloud.net/sulak-crm-uploads" # Опционально публичный URL
```

---

## ⚡ 4. Полный список переменных окружения (`.env.local`)

```env
# 1. СУБД PostgreSQL
DATABASE_URL="postgresql://sulak_user:СЛОЖНЫЙ_ПАРОЛЬ@localhost:5432/sulak_db"

# 2. Секретный ключ подписи JWT
JWT_SECRET="СГЕНЕРИРУЙТЕ_СЛУЧАЙНУЮ_СТРОКУ_JWT"

# 3. Защитный токен расписания Cron
CRON_SECRET="СГЕНЕРИРУЙТЕ_СЛУЧАЙНЫЙ_СЕКРЕТ_CRON"

# 4. Облачное хранилище S3
S3_BUCKET_NAME="sulak-crm-uploads"
S3_REGION="ru-central1"
S3_ACCESS_KEY_ID="ВАШ_ACCESS_KEY"
S3_SECRET_ACCESS_KEY="ВАШ_SECRET_KEY"
S3_ENDPOINT="https://storage.yandexcloud.net"
S3_PUBLIC_URL_PREFIX="https://storage.yandexcloud.net/sulak-crm-uploads"

# 5. Telegram Бот
TELEGRAM_BOT_TOKEN="8740932255:AAFr6dNDwAUgDobwgUNIzQDc8SAV3Ks21TM"
TELEGRAM_CHAT_ID="1803301964"

# 6. Порт
PORT=3000
```

---

## 🛠️ 5. Развёртывание и запуск на сервере

```bash
# 1. Установка зависимостей
npm ci

# 2. Накатывание структуры БД и генерация Prisma
npx prisma db push
npx prisma generate

# 3. Продуктивная сборка Next.js
npm run build

# 4. Запуск через PM2
pm2 start npm --name "sulak-crm" -- run start -- -p 3000
```
