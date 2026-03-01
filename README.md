# FRP Client

Полноценная русскоязычная веб-платформа для удаленной разблокировки устройств:
- роли `клиент`, `мастер`, `администратор`;
- управление заявками, оплатами и чатом;
- система событий по каждой заявке;
- первичная настройка через веб-интерфейс без консоли;
- прод-контур для деплоя на VPS.

## Ключевые возможности

- Вход через Telegram и логин/пароль.
- Первичное создание первого администратора на странице входа.
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
- `80` frontend + proxy `/api`, `/django-admin`, `/healthz`.

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
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
nano backend/.env
nano frontend/.env

# production запуск
# если нужен Telegram login на фронте:
# export VITE_TELEGRAM_BOT_USERNAME=your_bot_username
docker compose -f docker-compose.prod.yml up -d --build
```

## Проверки после запуска

```bash
docker compose -f docker-compose.prod.yml ps
curl -I http://127.0.0.1/healthz
curl -I http://127.0.0.1/api/health/
```

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
