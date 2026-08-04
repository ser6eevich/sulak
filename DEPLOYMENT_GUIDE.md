# Пошаговое руководство по развёртыванию "Сулак CRM" БЕЗ Докера

Данный гайд написан простым языком **«шаг за шагом»**. Все команды для сервера можно просто копировать и вставлять в терминал.

---

## 📋 Что нужно иметь на руках перед началом:

1. **IP-адрес сервера** (например: `185.178.44.12`) и **пароль от root** (или SSH-ключ).
2. **Ваш домен** (например: `sulak.ru`), направленный на IP-адрес вашего сервера (A-запись в панели домена).
3. **Ссылка на ваш GitHub репозиторий** (например: `https://github.com/ваш-логин/sulak-crm.git`).
4. **Доступы от S3 хранилища** (Bucket Name, Access Key, Secret Key, Endpoint).

---

## 🚀 ШАГ 1. Подключение к серверу и установка программ

### 1.1. Откройте Терминал на вашем Mac и подключитесь к серверу:
*(Замените `185.178.44.12` на ваш реальный IP сервера)*
```bash
ssh root@185.178.44.12
```
*(Сервер попросит ввести пароль. При вводе пароля символы не отображаются на экране — это нормально, просто введите пароль и нажмите Enter).*

### 1.2. Обновляем систему и устанавливаем Node.js 20, Git, Nginx и PostgreSQL:
Скопируйте и вставьте весь этот блок команд в терминал:

```bash
# Обновляем список программ сервера
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js версии 20 (нужен для запуска сайта)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx postgresql postgresql-contrib

# Устанавливаем PM2 — программу, которая держит ваш сайт работающим 24/7
sudo npm install -g pm2
```

Проверим версии:
```bash
node -v   # Должно показать v20.x.x
git --version
pm2 -v
```

---

## 🗄️ ШАГ 2. Создание базы данных PostgreSQL на сервере

Выполните команды в терминале сервера для создания базы данных и пользователя:

```bash
# Заходим в управление PostgreSQL
sudo -u postgres psql
```

Внутри появившейся консоли `postgres=#` введите по очереди эти 4 команды *(замените `ВАШ_ПАРОЛЬ_БД` на ваш надежный пароль)*:

```sql
CREATE DATABASE sulak_db;
CREATE USER sulak_user WITH PASSWORD 'ВАШ_ПАРОЛЬ_БД';
GRANT ALL PRIVILEGES ON DATABASE sulak_db TO sulak_user;
ALTER DATABASE sulak_db OWNER TO sulak_user;
\q
```
*(Команда `\q` выходит из консоли PostgreSQL назад в сервер).*

Ваша строка подключения к базе теперь выглядит так:
`postgresql://sulak_user:ВАШ_ПАРОЛЬ_БД@localhost:5432/sulak_db?schema=public`

---

## 📁 ШАГ 3. Скачивание проекта и создание `.env` файла

### 3.1. Скачиваем проект из GitHub:
```bash
# Создаём папку для сайта
sudo mkdir -p /var/www/sulak
sudo chown -R $USER:$USER /var/www/sulak
cd /var/www/sulak

# Скачиваем ваш код из GitHub (укажите ссылку на ваш репозиторий)
git clone https://github.com/ВАШ_ЛОГИН/СУЛАК_РЕПОЗИТОРИЙ.git .
```

### 3.2. Устанавливаем библиотеки проекта:
```bash
npm install --production=false
```

### 3.3. Создаём главный файл настроек `.env`:
```bash
nano .env
```
*(Откроется текстовый редактор. Скопируйте туда блок ниже и подставьте свои реальные данные)*:

```env
# ── Среда окружения ──
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://sulak.ru

# ── База данных PostgreSQL (создали на Шаге 2) ──
DATABASE_URL="postgresql://sulak_user:ВАШ_ПАРОЛЬ_БД@localhost:5432/sulak_db?schema=public"

# ── S3 Облачное хранилище (для фото) ──
S3_BUCKET_NAME=имя-вашего-бакета
S3_ACCESS_KEY_ID=ваш-access-key
S3_SECRET_ACCESS_KEY=ваш-secret-key
S3_ENDPOINT=https://storage.yandexcloud.net # или ссылка вашего S3 провайдера
S3_PUBLIC_URL_PREFIX=https://публичная-ссылка-на-бакет # или cdn

# ── Telegram Уведомления ──
TELEGRAM_BOT_TOKEN=8740932255:AAFr6dNDwAUgDobwgUNIzQDc8SAV3Ks21TM
TELEGRAM_CHAT_ID=1803301964

# ── Защита крон-задач (любое случайное сложное слово) ──
CRON_SECRET=MySuperSecretCronKey2026

# ── Web Push Уведомления (iOS PWA) ──
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BFdlQdGaOr2s2EZFkpbh8fAg0g_yhTpTkkqGofWUQlkp3KastoOIIN9jCEKpCwRMv6wQvjyNb32RExefKams7yE
VAPID_PUBLIC_KEY=BFdlQdGaOr2s2EZFkpbh8fAg0g_yhTpTkkqGofWUQlkp3KastoOIIN9jCEKpCwRMv6wQvjyNb32RExefKams7yE
VAPID_PRIVATE_KEY=soQ13IlcpmZqxh4A5-AznjUFlnunp87IIMRnRwxT3ag
VAPID_SUBJECT=mailto:admin@sulak.ru
```

Чтобы сохранить файл в `nano`: нажмите **Ctrl + O**, затем **Enter**, затем для выхода **Ctrl + X**.

---

## ⚙️ ШАГ 4. Создание таблиц в БД, сборка и первый запуск

Выполняем три команды:

```bash
# 1. Применяем структуру таблиц к созданной базе данных
npx prisma migrate deploy

# 2. Компилируем проект Next.js
npm run build

# 3. Запускаем сайт в PM2 (будет работать постоянно)
pm2 start npm --name "sulak" -- run start

# Настраиваем автозапуск PM2 при перезагрузке самого сервера
pm2 save
pm2 startup
```

Проверим статус:
```bash
pm2 status
```
*(В таблице должно быть написно `sulak` -> `online` зеленого цвета).*

---

## 🌐 ШАГ 5. Настройка домена и бесплатного SSL-сертификата (`https://`)

### 5.1. Создаём конфигурацию веб-сервера Nginx:
```bash
sudo nano /etc/nginx/sites-available/sulak
```

Вставьте следующий текст *(замените `sulak.ru` и `www.sulak.ru` на ваш реальный домен)*:

```nginx
server {
    server_name sulak.ru www.sulak.ru;

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

### 5.3. Выпускаем бесплатный защищённый SSL-сертификат (`https://`):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sulak.ru -d www.sulak.ru
```
*(Certbot попросит ввести ваш email и согласиться с условиями [нажать Y]. После этого ваш сайт начнёт открываться по `https://sulak.ru`).*

---

## ⚡ ШАГ 6. Настройка автодеплоя через GitHub (чтобы всё само менялось)

Когда вы вносите изменения в код на своём Mac и делаете `git push`, GitHub сам подключится к серверу и обновит сайт.

### 6.1. Генерируем SSH-ключ на сервере:
В терминале сервера введите:
```bash
ssh-keygen -t ed25519 -C "github-actions"
```
*(Нажимайте Enter на все вопросы, пароль создавать не нужно).*

Посмотрим созданные ключи:
```bash
# Разрешаем входить по этому ключу
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# ВЫВЕДЕМ ПРИВАТНЫЙ КЛЮЧ НА ЭКРАН (Скопируйте весь вывод от BEGIN до END):
cat ~/.ssh/id_ed25519
```

### 6.2. Вставляем ключи в GitHub:
1. Зайдите на **[github.com](https://github.com)** в ваш репозиторий.
2. Перейдите в **Settings** -> слева **Secrets and variables** -> **Actions**.
3. Нажмите **New repository secret** и добавьте 4 секрета:
   - Имя: `SERVER_HOST` | Значение: IP-адрес вашего сервера (например `185.178.44.12`)
   - Имя: `SERVER_USER` | Значение: `root`
   - Имя: `SERVER_SSH_KEY` | Значение: Скопированный текст приватного ключа из пункта 6.1 (начинается с `-----BEGIN OPENSSH PRIVATE KEY-----`)
   - Имя: `SERVER_PORT` | Значение: `22`

**ГОТОВО!** Теперь при любом вызове `git push origin main` с вашего Mac — сайт на сервере будет автоматически компилироваться и обновляться за 15 секунд!

---

## 🛠️ Полезные команды для управления сервером

- **Посмотреть статус сайта**: `pm2 status`
- **Посмотреть живые логи ошибок**: `pm2 logs sulak`
- **Перезапустить сайт вручную**: `pm2 restart sulak`
- **Посмотреть свободную память и загрузку процессора**: `htop`
