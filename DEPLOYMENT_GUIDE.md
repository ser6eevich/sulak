# Пошаговое руководство по развёртыванию "Сулак CRM" БЕЗ Докера

Данный гайд написан простым языком **«шаг за шагом»**. Все команды для сервера можно просто копировать и вставлять в терминал.

---

## 📋 Что нужно иметь на руках перед началом:

1. **IP-адрес сервера** (например: `185.178.44.12`) и **пароль от root** (или SSH-ключ).
2. **Ваш домен**: `stoly.srp-lsp.ru`, направленный на IP-адрес вашего сервера (A-запись в панели домена).
3. **Ссылка на ваш GitHub репозиторий**: `https://github.com/ser6eevich/sulak.git`
4. **Доступы от S3 хранилища** (Timeweb Cloud S3).

---

## 🚀 ШАГ 1. Подключение к серверу и установка программ

### 1.1. Откройте Терминал на вашем Mac и подключитесь к серверу:
```bash
ssh root@ИП_ВАШЕГО_СЕРВЕРА
```
*(Сервер попросит ввести пароль. При вводе пароля символы не отображаются на экране — это нормально, просто введите пароль и нажмите Enter).*

### 1.2. Обновляем систему и устанавливаем Node.js 20, Git, Nginx и PostgreSQL:
Скопируйте и вставьте весь этот блок команд в терминал:

```bash
# Обновляем список программ сервера
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js версии 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx postgresql postgresql-contrib

# Устанавливаем PM2 — программу, которая держит ваш сайт работающим 24/7
sudo npm install -g pm2
```

---

## 🗄️ ШАГ 2. Создание базы данных PostgreSQL на сервере

Выполните команды в терминале сервера для создания базы данных и пользователя:

```bash
# Заходим в управление PostgreSQL
sudo -u postgres psql
```

Внутри появившейся консоли `postgres=#` введите по очереди эти команды:

```sql
CREATE DATABASE sulak_db;
CREATE USER sulak_user WITH PASSWORD 'VanyayA1';
GRANT ALL PRIVILEGES ON DATABASE sulak_db TO sulak_user;
ALTER DATABASE sulak_db OWNER TO sulak_user;
\q
```
*(Команда `\q` выходит из консоли PostgreSQL назад в сервер).*

---

## 📁 ШАГ 3. Скачивание проекта и создание `.env` файла

### 3.1. Скачиваем проект из GitHub:
```bash
# Создаём папку для сайта
sudo mkdir -p /var/www/sulak
sudo chown -R $USER:$USER /var/www/sulak
cd /var/www/sulak

# Скачиваем ваш код из GitHub
git clone https://github.com/ser6eevich/sulak.git .
```

### 3.2. Устанавливаем библиотеки проекта:
```bash
npm install --production=false
```

### 3.3. Создаём главный файл настроек `.env`:
```bash
nano .env
```
Скопируйте и вставьте туда весь следующий блок целиком:

```env
# ── Среда окружения ──
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://stoly.srp-lsp.ru

# ── База данных PostgreSQL ──
DATABASE_URL="postgresql://sulak_user:VanyayA1@localhost:5432/sulak_db?schema=public"

# ── S3 Облачное хранилище Timeweb Cloud (для фото) ──
S3_BUCKET_NAME=stoly
S3_REGION=ru-1
S3_ACCESS_KEY_ID=LGU722WUDGASIHZP39WL
S3_SECRET_ACCESS_KEY=bJ8gDJpwn2Q5BImd7tbnCthI5Vbt5vljDl84YAzB
S3_ENDPOINT=https://s3.twcstorage.ru
S3_PUBLIC_URL_PREFIX=https://stoly.s3.twcstorage.ru

# ── Telegram Уведомления ──
TELEGRAM_BOT_TOKEN=8740932255:AAFr6dNDwAUgDobwgUNIzQDc8SAV3Ks21TM
TELEGRAM_CHAT_ID=1803301964

# ── Защита крон-задач ──
CRON_SECRET=SulakCronSecretKey2026!

# ── Web Push Уведомления (iOS PWA) ──
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BFdlQdGaOr2s2EZFkpbh8fAg0g_yhTpTkkqGofWUQlkp3KastoOIIN9jCEKpCwRMv6wQvjyNb32RExefKams7yE
VAPID_PUBLIC_KEY=BFdlQdGaOr2s2EZFkpbh8fAg0g_yhTpTkkqGofWUQlkp3KastoOIIN9jCEKpCwRMv6wQvjyNb32RExefKams7yE
VAPID_PRIVATE_KEY=soQ13IlcpmZqxh4A5-AznjUFlnunp87IIMRnRwxT3ag
VAPID_SUBJECT=mailto:admin@sulak.ru
```

Чтобы сохранить файл в `nano`: нажмите **Ctrl + O**, затем **Enter**, затем для выхода **Ctrl + X**.

---

## ⚙️ ШАГ 4. Добавление подкачки SWAP, сборка и запуск

Выполняем команды по порядку:

```bash
# 1. Добавляем 2 ГБ оперативной памяти (SWAP), чтобы сборке хватало ресурсов
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 2. Применяем структуру таблиц к базе данных
npx prisma migrate deploy

# 3. Сборка проекта Next.js
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 4. Запускаем сайт в PM2 (работает 24/7)
pm2 start npm --name "sulak" -- run start

# Настраиваем автозапуск PM2 при перезагрузке самого сервера
pm2 save
pm2 startup
```

---

## 🌐 ШАГ 5. Настройка домена `stoly.srp-lsp.ru` и SSL (`https://`)

### 5.1. Создаём конфигурацию веб-сервера Nginx:
```bash
sudo nano /etc/nginx/sites-available/sulak
```

Вставьте следующий текст:

```nginx
server {
    server_name stoly.srp-lsp.ru;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Сохраните файл: **Ctrl + O** -> **Enter** -> **Ctrl + X**.

### 5.2. Активируем сайт в Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/sulak /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5.3. Выпускаем защищённый SSL-сертификат (`https://`):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stoly.srp-lsp.ru
```
*(После выполнения ваш сайт заведётся по `https://stoly.srp-lsp.ru`).*

---

## ⚡ ШАГ 6. Настройка Автодеплоя через GitHub

1. Сгенерируйте SSH-ключ на сервере:
   ```bash
   ssh-keygen -t ed25519 -C "github-actions"
   cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/id_ed25519
   ```
2. Скопируйте приватный ключ из терминала.
3. Перейдите на GitHub: **[github.com/ser6eevich/sulak/settings/secrets/actions](https://github.com/ser6eevich/sulak/settings/secrets/actions)**
4. Добавьте секреты:
   - `SERVER_HOST` = IP вашего сервера
   - `SERVER_USER` = `root`
   - `SERVER_SSH_KEY` = Скопированный ключ
   - `SERVER_PORT` = `22`

Теперь при любом `git push origin master` с Mac — сайт на сервере будет автоматически обновляться сам!

---

## ⏰ ШАГ 7. Настройка Автоматической Проверки Отзывов Авито (Crontab)

Чтобы сервер автоматически каждый час проверял все 7 аккаунтов Авито на новые отзывы и сразу присылал их в Telegram:

1. Откройте планировщик задач на сервере:
   ```bash
   crontab -e
   ```
2. В самый конец файла добавьте следующую строчку:
   ```text
   0 * * * * curl -s "http://localhost:3000/api/cron/check-avito-reviews?secret=SulakCronSecretKey2026!" > /dev/null 2>&1
   ```
3. Сохраните файл (**Ctrl + O** -> **Enter** -> **Ctrl + X**).

*Система теперь полностью автономна! Каждый час она запрашивает новые отзывы по Авито API, исключает дубликаты и отправляет новые сообщения в Telegram.*
