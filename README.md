# FRP Client

Полноценная русскоязычная веб-платформа для удаленной разблокировки устройств:
- роли `клиент`, `мастер`, `администратор`;
- управление заявками, оплатами и чатом;
- система событий по каждой заявке;
- первичная настройка через веб-интерфейс без консоли;
- прод-контур для деплоя на VPS.

## Ключевые возможности

- Вход через Telegram и логин/пароль.
- Регистрация клиента по нику и паролю.
- Первичное создание первого администратора на странице входа.
- Telegram-уведомления мастерам о новых заявках (если у мастера привязан Telegram).
- Telegram-бот клиентского кабинета: заявки, статусы, чат, сигналы мастеру, повтор заявки.
- Сообщения мастера/админа с сайта автоматически дублируются клиенту в Telegram-бот.
- Быстрые ответы мастера в чате: собственные команды (`/1`, `/инструкция`) с управлением через UI.
- Быстрые сигналы клиента в заявке: `готов к подключению`, `нужна помощь`, `проблема с оплатой`, `перенос сессии`.
- Повтор заявки в 1 клик (создание новой заявки по параметрам завершенной/закрытой).
- Дашборды по ролям с KPI и быстрыми действиями.
- Таймлайн событий по заявке (`кто / что / когда`).
- Админ-инструменты: роли пользователей, блокировки, системные действия, реквизиты оплаты.
- Health endpoints для мониторинга:
  - `GET /healthz`
  - `GET /api/health/`

## Режимы запуска

### 1) Обычный (dev-like) через `docker-compose.yml`

```bash
docker compose up -d --build
```

Порты:
- `5173` frontend
- `8000` backend
- `5432` postgres

### 2) Production через `docker-compose.prod.yml`

Production-контур включает:
- backend (gunicorn + migrate + collectstatic);
- frontend (Nginx + статическая сборка Vite + reverse-proxy на backend);
- раздачу пользовательских медиафайлов через frontend Nginx (общий volume);
- healthchecks сервисов.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Порт:
- `127.0.0.1:8080` frontend + proxy `/api`, `/django-admin`, `/healthz`.

Django admin доступен по пути: `/django-admin/`.

## Быстрый деплой GitHub -> VPS

### На локальной машине

```bash
git add .
git commit -m "prod update"
git push origin main
```

### На VPS

```bash
cd /var/www/FRPclient
git pull --ff-only origin main

# первый запуск
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # только для dev-сборки frontend
nano .env
nano backend/.env

# production запуск
# для Telegram login на фронте:
# в .env задайте VITE_TELEGRAM_BOT_USERNAME=ClientFRP_bot
# если нужны Telegram-уведомления мастерам:
# убедитесь, что в backend/.env задан TELEGRAM_BOT_TOKEN
docker compose -f docker-compose.prod.yml up -d --build

# запуск Telegram-бота клиента (отдельный профиль)
docker compose -f docker-compose.prod.yml --profile bot up -d --build telegram-bot
```

### Переменные для Telegram-бота

В `backend/.env`:

```bash
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_CLIENT_BOT_FRONTEND_URL=https://client.androidmultitool.ru
```

В `/.env` (в корне проекта):

```bash
VITE_TELEGRAM_BOT_USERNAME=ClientFRP_bot
FRONTEND_PORT_BIND=127.0.0.1:8080:80
```

Бот авторизует пользователя по `telegram_id` уже привязанного аккаунта. Сначала зайдите на сайт через Telegram-вход.

Запуск вручную без Docker:

```bash
cd backend
python manage.py run_client_telegram_bot --frontend-url https://client.androidmultitool.ru
```

### Команды Telegram-бота клиента

```text
/menu
/profile
/my
/open <id>
/new
/active <id>
/chat <id> <сообщение>
/signal <id> <ready|help|payment|reschedule> [комментарий]
/repeat <id>
/cancel
```

## Проверки после запуска

```bash
docker compose -f docker-compose.prod.yml ps
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/api/health/
```

Проверка, что Telegram-бот вшит в фронтовый бандл:

```bash
ASSET_LOCAL=$(curl -s http://127.0.0.1:8080/ | grep -oE '/assets/index-[^"]+\.js' | head -n1)
ASSET_DOMAIN=$(curl -ks https://client.androidmultitool.ru/ | grep -oE '/assets/index-[^"]+\.js' | head -n1)
echo "LOCAL=$ASSET_LOCAL"
echo "DOMAIN=$ASSET_DOMAIN"

curl -s "http://127.0.0.1:8080${ASSET_LOCAL}" | grep -ao "ClientFRP_bot" | head -n1
curl -ks "https://client.androidmultitool.ru${ASSET_DOMAIN}" | grep -ao "ClientFRP_bot" | head -n1
```

Если на домене нет `ClientFRP_bot`, проверьте system nginx (`proxy_pass http://127.0.0.1:8080;`) и выполните:

```bash
nginx -t && systemctl reload nginx
```

## Telegram Login: Bot domain invalid

В `@BotFather`:

```text
/setdomain
@ClientFRP_bot
client.androidmultitool.ru
```

Вводите только домен, без `https://`, `/`, портов и путей.

Если `Bot domain invalid` повторяется:
- проверьте HTTPS доступность домена;
- попробуйте root-домен: `androidmultitool.ru`;
- открывайте страницу логина с домена, который принят BotFather.

## Полезные команды

```bash
# логи backend
docker compose -f docker-compose.prod.yml logs -f backend

# логи frontend
docker compose -f docker-compose.prod.yml logs -f frontend

# перезапуск
docker compose -f docker-compose.prod.yml up -d --build
```

## Важные замечания

- Не храните `.env` в git.
- Для продакшена используйте длинный `SECRET_KEY` (минимум 32+ символа).
- Ограничьте `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS` под ваш домен.
