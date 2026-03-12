# FRP Client

Полноценная русскоязычная веб-платформа для удаленной разблокировки устройств:
- роли `клиент`, `мастер`, `администратор`;
- управление заявками, оплатами и чатом;
- система событий по каждой заявке;
- первичная настройка через веб-интерфейс без консоли;
- прод-контур для деплоя на VPS.

## Ключевые возможности

- Вход через Telegram, Google, Яндекс, VK и логин/пароль.
- Регистрация клиента по нику и паролю.
- При блокировке клиента интерфейс полностью отключается и показывается экран "Аккаунт заблокирован" с причиной.
- Первичное создание первого администратора на странице входа.
- Telegram-уведомления мастерам о новых заявках (если у мастера привязан Telegram).
- Telegram-бот клиентского кабинета: заявки, статусы, чат, сигналы мастеру, повтор заявки.
- Сообщения мастера/админа с сайта автоматически дублируются клиенту в Telegram-бот.
- Сообщения клиента из Telegram (текст, фото, документы) попадают в web-чат заявки на сайте.
- Мастер получает Telegram push, когда клиент пишет новое сообщение по своей заявке.
- Клиент получает Telegram-уведомления о смене статуса заявки (например, заявка взята, ожидает оплату, в работе, завершена).
- Быстрые ответы мастера в чате: собственные команды (`/1`, `/инструкция`) с управлением через UI.
- Антимусор в клиентском чате: блокируются спам-сообщения и недопустимая лексика, в UI показывается понятная причина.
- Быстрые сигналы клиента в заявке: `готов к подключению`, `нужна помощь`, `проблема с оплатой`, `перенос сессии`.
- Повтор заявки в 1 клик (создание новой заявки по параметрам завершенной/закрытой).
- Дашборды по ролям с KPI и быстрыми действиями.
- Таймлайн событий по заявке (`кто / что / когда`).
- Админ-инструменты: роли пользователей, блокировки, системные действия, реквизиты оплаты.
- Health endpoints для мониторинга:
  - `GET /healthz`
  - `GET /api/health/` (публичная безопасная сводка без DB/Redis деталей)
  - `GET /api/health/internal/` (admin-only диагностика зависимостей)
- OpenAPI документация:
  - `GET /api/schema/`
  - `GET /api/schema/swagger/`
  - `GET /api/schema/redoc/`

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
- backend (gunicorn; migrate + collectstatic выполняет deploy script);
- frontend (Nginx + статическая сборка Vite + reverse-proxy на backend);
- приватную раздачу пользовательских медиафайлов через signed URLs и backend/X-Accel-Redirect;
- healthchecks сервисов.

```bash
docker compose -f docker-compose.prod.yml up -d --build
# или на legacy-серверах:
docker-compose -f docker-compose.prod.yml up -d --build
# или одной командой:
sh scripts/deploy_prod.sh --with-bot --backup-first --smoke --runtime-audit --telegram-bot-username ClientFRP_bot
```

Порт:
- `127.0.0.1:8080` frontend + proxy `/api`, internal `/healthz` только для loopback, admin only для `admin.frpclient.ru`.

Django admin доступен только на отдельном host: `https://admin.frpclient.ru/django-admin/`.

## Быстрый деплой GitHub -> VPS

Release policy:
- production deploy и rollback теперь рассчитаны только на clean git worktree;
- перед релизом все изменения должны быть закоммичены и запушены;
- release metadata привязываются к `git_commit`, `git_tag` (если HEAD помечен тегом) и `source_fingerprint`.

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
sudo install -d -m 700 /etc/frpclient
sudo install -m 600 ops/secrets/backend.secrets.env.example /etc/frpclient/backend.secrets.env
sudo install -m 600 ops/secrets/frontend.build.secrets.env.example /etc/frpclient/frontend.build.secrets.env
nano .env
nano backend/.env
sudo nano /etc/frpclient/backend.secrets.env
sudo nano /etc/frpclient/frontend.build.secrets.env

# production запуск
# для Telegram login на фронте:
# в .env задайте VITE_TELEGRAM_BOT_USERNAME=ClientFRP_bot
# если нужны Telegram-уведомления мастерам:
# убедитесь, что в /etc/frpclient/backend.secrets.env задан TELEGRAM_BOT_TOKEN
docker-compose -f docker-compose.prod.yml up -d --build

# запуск Telegram-бота клиента (отдельный compose-файл)
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.bot.yml up -d --build telegram-bot

# тот же деплой одной командой
sh scripts/deploy_prod.sh --with-bot --backup-first --smoke --runtime-audit --telegram-bot-username ClientFRP_bot
```

Если checkout содержит незакоммиченные изменения, `deploy_prod.sh` и `rollback_prod.sh` завершатся ошибкой до начала релиза.

## Secret Management

Production secrets больше не должны лежать в файлах из репозитория.

Правило:
- `.env` в корне и `backend/.env` содержат только base config;
- реальные секреты лежат в root-owned external files:
  - `/etc/frpclient/backend.secrets.env`
  - `/etc/frpclient/frontend.build.secrets.env`
- `docker-compose.prod.yml`, deploy/rollback и backup-скрипты читают base env + external secret env;
- `prod_preflight.py` теперь валит релиз, если secret files отсутствуют, лежат внутри repo или если секреты остались в base env.

Минимальная установка:

```bash
sudo install -d -m 700 /etc/frpclient
sudo install -m 600 ops/secrets/backend.secrets.env.example /etc/frpclient/backend.secrets.env
sudo install -m 600 ops/secrets/frontend.build.secrets.env.example /etc/frpclient/frontend.build.secrets.env
sudo chown root:root /etc/frpclient/backend.secrets.env /etc/frpclient/frontend.build.secrets.env
```

Base env paths:

```bash
# .env
BACKEND_ENV_FILE=./backend/.env
BACKEND_SECRETS_FILE=/etc/frpclient/backend.secrets.env
FRONTEND_BUILD_SECRETS_FILE=/etc/frpclient/frontend.build.secrets.env
```

Во внешний backend secret file выносите:
- `SECRET_KEY`
- `POSTGRES_PASSWORD`
- `RUSTDESK_ENCRYPTION_KEYS`
- `TELEGRAM_BOT_TOKEN`
- `MEDIA_STORAGE_ACCESS_KEY_ID`
- `MEDIA_STORAGE_SECRET_ACCESS_KEY`
- OAuth client secrets
- `EMAIL_HOST_PASSWORD`
- `SENTRY_DSN`

Во внешний frontend build secret file выносите:
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`

Rotation checklist после засветки:
- перевыпустить SSH/VPS credentials;
- перевыпустить `TELEGRAM_BOT_TOKEN`;
- перевыпустить OAuth client secrets;
- перевыпустить SMTP password;
- перевыпустить `RUSTDESK_ENCRYPTION_KEYS`;
- записать новые значения только во внешние secret files;
- прогнать `python scripts/prod_preflight.py --base-url https://frpclient.ru` перед deploy.

## Media Storage (R2 Private)

Финальный production-вариант для пользовательских файлов:
- `MEDIA_STORAGE_PROVIDER=r2`
- private bucket в Cloudflare R2
- backend сохраняет uploads напрямую в object storage
- API отдаёт short-lived signed URLs вместо локальных `/media/...`
- локальный `/api/media/signed/` остаётся только fallback-режимом для filesystem storage

Базовые backend env:

```bash
MEDIA_STORAGE_PROVIDER=r2
MEDIA_STORAGE_BUCKET_NAME=frpclient-media
MEDIA_STORAGE_REGION_NAME=auto
MEDIA_STORAGE_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com
MEDIA_STORAGE_PREFIX=prod/media
MEDIA_STORAGE_SIGNATURE_VERSION=s3v4
MEDIA_STORAGE_ADDRESSING_STYLE=virtual
MEDIA_STORAGE_QUERYSTRING_EXPIRE=1800
```

Секреты:

```bash
# /etc/frpclient/backend.secrets.env
MEDIA_STORAGE_ACCESS_KEY_ID=...
MEDIA_STORAGE_SECRET_ACCESS_KEY=...
```

После включения `MEDIA_STORAGE_PROVIDER=r2`:
- serializer URL для `profile_photo`, `payment_proof`, chat attachments и quick replies становятся direct signed R2 links;
- `media_backup.sh` больше не читает container volume, а экспортирует текущий media tree из object storage в архив;
- `media_restore.sh` умеет заливать архив обратно в remote prefix через `--wipe-remote`.

Если нужен живой e2e acceptance smoke уже как пользователь:

```bash
sh scripts/deploy_prod.sh --with-bot --backup-first --smoke --acceptance --runtime-audit --telegram-bot-username ClientFRP_bot
```

По умолчанию `scripts/deploy_prod.sh` ещё и сохраняет rollback snapshot текущих docker images.
Если это нужно временно пропустить, используйте `--skip-image-snapshot`.
По умолчанию хранятся только последние `10` rollback snapshot'ов; это можно переопределить
через `ROLLBACK_RETENTION_COUNT`.
После успешного deploy/rollback dangling docker images автоматически чистятся; при необходимости
это можно пропустить через `--skip-docker-prune`.

После `compose up` deploy и rollback дополнительно ждут, пока `frp-backend`, `frp-backend-ws` и `frp-frontend`
станут `healthy`, чтобы post-deploy smoke/audit не ловили ложные падения на переходном состоянии.
`redis` теперь тоже имеет healthcheck, а `backend-ws` больше не запускает `migrate` при старте,
чтобы не было конкурентных schema changes из двух контейнеров.
Сам `deploy_prod.sh` теперь сначала поднимает только `postgres`/`redis`, затем отдельно выполняет
`python manage.py migrate` и `collectstatic`, и только после этого стартует runtime-контейнеры.
Регулярный housekeeping Django (`clearsessions` + `flushexpiredtokens`) вынесен в отдельный systemd timer,
чтобы просроченные сессии и записи blacklist не копились в БД.
Обновление platform metrics для админ-дашборда тоже вынесено в отдельный timer, чтобы графики и KPI не зависели от ручного запуска.
Во время deploy/rollback system nginx может автоматически включать marker-based maintenance mode, чтобы пользователь не попадал на переходные `502` и миграции вживую.
Параллельно с этим действует глобальный deploy-lock, чтобы timer-джобы не влезали в стек в момент релиза.

### Переменные для Telegram-бота

В `backend/.env`:

```bash
TELEGRAM_CLIENT_BOT_FRONTEND_URL=https://frpclient.ru
REDIS_URL=redis://redis:6379/1
LOG_LEVEL=INFO
LOG_JSON=1
```

Во внешнем secret file:

```bash
# /etc/frpclient/backend.secrets.env
TELEGRAM_BOT_TOKEN=ваш_токен_бота
SECRET_KEY=...
POSTGRES_PASSWORD=...
RUSTDESK_ENCRYPTION_KEYS=...
SENTRY_DSN=
```

В `/.env` (в корне проекта):

```bash
VITE_TELEGRAM_BOT_USERNAME=ClientFRP_bot
FRONTEND_PORT_BIND=127.0.0.1:8080:80
BACKEND_ENV_FILE=./backend/.env
BACKEND_SECRETS_FILE=/etc/frpclient/backend.secrets.env
FRONTEND_BUILD_SECRETS_FILE=/etc/frpclient/frontend.build.secrets.env
```

Frontend build secrets:

```bash
# /etc/frpclient/frontend.build.secrets.env
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=
VITE_SENTRY_TRACES_SAMPLE_RATE=0
```

Бот авторизует пользователя по `telegram_id` уже привязанного аккаунта. Сначала зайдите на сайт через Telegram-вход.

Запуск вручную без Docker:

```bash
cd backend
python manage.py run_client_telegram_bot --frontend-url https://frpclient.ru
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
docker-compose -f docker-compose.prod.yml ps
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/api/health/
curl -I -H "X-Request-ID: manual-check-12345678" http://127.0.0.1:8080/api/health/
```

Быстрый публичный smoke test:

```bash
python scripts/prod_smoke.py --base-url https://frpclient.ru --oauth-provider google --oauth-provider vk --oauth-provider yandex --telegram-bot-username ClientFRP_bot
```

Живой acceptance smoke для verified client-пользователя:

```bash
python scripts/prod_acceptance.py --base-url https://frpclient.ru --username smoke_client --password 'strong-password'
```

`prod_acceptance.py` проверяет:
- login;
- `/api/me/`;
- `/api/dashboard/`;
- создание заявки;
- получение списка и detail заявки;
- websocket notifications ping/pong;
- websocket platform event после `client-access` update.

Проверка, что Telegram-бот вшит в фронтовый бандл:

```bash
ASSET_LOCAL=$(curl -s http://127.0.0.1:8080/ | grep -oE '/assets/index-[^"]+\.js' | head -n1)
ASSET_DOMAIN=$(curl -ks https://frpclient.ru/ | grep -oE '/assets/index-[^"]+\.js' | head -n1)
echo "LOCAL=$ASSET_LOCAL"
echo "DOMAIN=$ASSET_DOMAIN"

curl -s "http://127.0.0.1:8080${ASSET_LOCAL}" | grep -ao "ClientFRP_bot" | head -n1
curl -ks "https://frpclient.ru${ASSET_DOMAIN}" | grep -ao "ClientFRP_bot" | head -n1
```

Если на домене нет `ClientFRP_bot`, проверьте system nginx (`proxy_pass http://127.0.0.1:8080;`) и выполните:

```bash
nginx -t && systemctl reload nginx
```

Версионированный конфиг system nginx для прод-домена лежит в `ops/nginx/frpclient.ru.conf`.
Отдельный vhost для админки лежит в `ops/nginx/admin.frpclient.ru.conf`.
Для автоматического включения host после появления DNS добавлен helper:
- `ops/nginx/admin.frpclient.ru.http.conf`
- `ops/nginx/enable_admin_host.sh`

## Django Admin Hardening

Админка теперь строится как отдельный защищённый контур:
- отдельный host `admin.frpclient.ru`;
- host-gate в Django: `/django-admin/` не открывается на основном домене;
- MFA через `django-otp` (`OTPAdminSite`);
- edge access выносится в nginx и должен быть закрыт либо через Tailscale, либо через Cloudflare Access.

Что нужно на VPS:

```bash
cp ops/nginx/admin.frpclient.ru.conf /etc/nginx/sites-available/admin.frpclient.ru.conf
mkdir -p /etc/nginx/snippets

# выберите один вариант edge-защиты:
cp ops/nginx/snippets/frpclient-admin-access.tailscale.conf /etc/nginx/snippets/frpclient-admin-access.conf
# или
cp ops/nginx/snippets/frpclient-admin-access.cloudflare-access.conf /etc/nginx/snippets/frpclient-admin-access.conf

ln -sf /etc/nginx/sites-available/admin.frpclient.ru.conf /etc/nginx/sites-enabled/admin.frpclient.ru.conf
nginx -t && systemctl reload nginx
```

Если хотите включать admin host без ручного двухшагового переключения `HTTP -> certbot -> TLS`, используйте:

```bash
sh ops/security/connect_tailscale.sh --check-only
TAILSCALE_AUTH_KEY=tskey-... sh ops/security/connect_tailscale.sh --hostname frpclient-prod --advertise-tags tag:prod,tag:admin
sh ops/nginx/enable_admin_host.sh --check-only --access-mode tailscale
CERTBOT_EMAIL=you@example.com sh ops/nginx/enable_admin_host.sh --access-mode tailscale
```

Скрипт:
- `ops/security/connect_tailscale.sh` поднимает `tailscaled`, печатает текущий status и выполняет `tailscale up`;
- проверяет, что `admin.frpclient.ru` уже резолвится;
- ставит выбранный access snippet (`tailscale` или `cloudflare`);
- временно включает HTTP-only vhost для ACME challenge;
- выпускает сертификат через `certbot --webroot`;
- переключает nginx на финальный TLS vhost.

Новые backend env:

```bash
ADMIN_HOST=admin.frpclient.ru
ADMIN_ALLOWED_HOSTS=admin.frpclient.ru,127.0.0.1,localhost
```

После установки `django-otp` и миграций создайте TOTP-устройство для staff/admin:

```bash
cd /var/www/FRPclient/backend
python manage.py bootstrap_admin_totp --username <admin_username> --issue-static-token
```

Команда выведет `config_url=` для TOTP-приложения и одноразовый `emergency_static_token=...`.
После этого входите только через `https://admin.frpclient.ru/django-admin/`.

## Maintenance Mode

Для короткого технического окна во время deploy/rollback есть marker-based maintenance mode:
- `ops/nginx/frpclient.ru.conf`
- `ops/nginx/maintenance.html`
- `ops/nginx/maintenance_mode.sh`

`nginx` проверяет наличие файла `/var/www/FRPclient/.deploy/maintenance-mode` и, если он существует,
отдаёт статическую страницу обслуживания с `503 Service Unavailable` и `Retry-After`.
Во время deploy/rollback скрипты также временно паузят `frpclient-public-smoke.timer`,
`frpclient-managed-acceptance.timer` и `frpclient-runtime-audit.timer`, а затем поднимают их обратно,
чтобы monitoring не ловил ожидаемый `503` как ложную production-аварию.

## Deploy Lock

Для защиты от параллельных операций есть отдельный lock:
- `ops/common/deploy_lock.sh`
- `ops/common/job_status.sh`

Deploy и rollback атомарно создают директорию `.deploy/active.lock`. Пока lock активен, фоновые job-скрипты
(`public_smoke`, `managed_acceptance`, `runtime_audit`, backup/verify, housekeeping, metrics refresh, certbot dry-run)
завершаются успешно со `skip`, а не пытаются работать поверх релиза. Сам `runtime_audit` lock больше не игнорирует
полностью: он считает свежий lock допустимым во время релиза, но валится, если lock завис дольше допустимого окна.

Ключевые фоновые jobs также пишут snapshots в `.deploy/status/*.json`. Эти файлы доступны backend через
read-only runtime-state mount и показываются в `/api/admin/system/status/`, чтобы в админке было видно
последний успех/ошибку smoke, audit, backups, acceptance и maintenance jobs без чтения journald вручную.
Туда же теперь пишется и последний `deploy`, а verify jobs (`postgres_verify`, `media_verify`) тоже попадают
в этот же status-layer. `rollback` не входит в mandatory jobs-list, но его persisted status тоже читается
из `.deploy/status/rollback.json` и показывается внутри rollback inventory как `last_run`.
Отдельно deploy/rollback теперь пишут `current release` metadata в `.deploy/release/current.json`, чтобы в админке
было видно, когда именно прод последний раз менялся, через `deploy` или `rollback`, и какой git commit/container image
сейчас живут на сервере.
Рядом с этим ведётся и короткая history-лента в `.deploy/release/history/*.json`, поэтому админка показывает не только
текущий live release, но и несколько последних live transitions.
Начиная с текущего production-контура rollback snapshot'ы также сохраняют source metadata
(`SOURCE_GIT_COMMIT`, `SOURCE_GIT_BRANCH`, `SOURCE_GIT_TAG`, `SOURCE_FINGERPRINT`), поэтому release trail остаётся корректным
даже если на VPS checkout работает без `.git`.

Проверка на VPS:

```bash
cd /var/www/FRPclient
sh ops/common/deploy_lock.sh status
```

Ручной release, если lock остался после аварийного kill процесса:

```bash
cd /var/www/FRPclient
sh ops/common/deploy_lock.sh release
```

`/api/admin/system/status/` теперь также показывает `deploy_lock`, `maintenance_mode` и rollback inventory:
доступное количество snapshot'ов, последний label, наличие bot snapshot и битые manifest'ы, если recovery-контур
требует внимания.

Ручное включение на VPS:

```bash
cd /var/www/FRPclient
sh ops/nginx/maintenance_mode.sh on manual
curl -I https://frpclient.ru
sh ops/nginx/maintenance_mode.sh off
```

Deploy и rollback используют этот marker автоматически. Если нужно временно отключить это поведение:

```bash
sh scripts/deploy_prod.sh --skip-maintenance-mode ...
sh scripts/rollback_prod.sh --skip-maintenance-mode ...
```

## Резервные копии

Репозиторий содержит готовый backup-контур:
- `ops/backup/postgres_backup.sh`
- `ops/backup/postgres_verify_backup.sh`
- `ops/backup/postgres_restore.sh`
- `ops/backup/media_backup.sh`
- `ops/backup/media_restore.sh`
- `ops/backup/media_verify_backup.sh`
- `ops/backup/prune_backup_artifacts.py`
- `ops/systemd/frpclient-postgres-backup.service`
- `ops/systemd/frpclient-postgres-backup.timer`
- `ops/systemd/frpclient-postgres-verify.service`
- `ops/systemd/frpclient-postgres-verify.timer`
- `ops/systemd/frpclient-media-backup.service`
- `ops/systemd/frpclient-media-backup.timer`
- `ops/systemd/frpclient-media-verify.service`
- `ops/systemd/frpclient-media-verify.timer`

Ручной backup на VPS:

```bash
cd /var/www/FRPclient
sh ops/backup/postgres_backup.sh
ls -lah /var/backups/frpclient/postgres
sh ops/backup/media_backup.sh
ls -lah /var/backups/frpclient/media
```

По умолчанию backup-скрипты держат не больше `10` последних архивов каждого типа и
дополнительно удаляют архивы старше `14` дней. Параметры можно переопределить через
`KEEP_COUNT` и `RETENTION_DAYS` при запуске `postgres_backup.sh` и `media_backup.sh`.

Установка daily-backup через systemd:

```bash
cp ops/systemd/frpclient-postgres-backup.service /etc/systemd/system/
cp ops/systemd/frpclient-postgres-backup.timer /etc/systemd/system/
cp ops/systemd/frpclient-postgres-verify.service /etc/systemd/system/
cp ops/systemd/frpclient-postgres-verify.timer /etc/systemd/system/
cp ops/systemd/frpclient-media-backup.service /etc/systemd/system/
cp ops/systemd/frpclient-media-backup.timer /etc/systemd/system/
cp ops/systemd/frpclient-media-verify.service /etc/systemd/system/
cp ops/systemd/frpclient-media-verify.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-postgres-backup.timer
systemctl enable --now frpclient-postgres-verify.timer
systemctl enable --now frpclient-media-backup.timer
systemctl enable --now frpclient-media-verify.timer
systemctl list-timers frpclient-postgres-backup.timer
systemctl list-timers frpclient-postgres-verify.timer
systemctl list-timers frpclient-media-backup.timer
systemctl list-timers frpclient-media-verify.timer
```

Ручная проверка, что последний backup реально восстанавливается:

```bash
cd /var/www/FRPclient
sh ops/backup/postgres_verify_backup.sh
sh ops/backup/media_verify_backup.sh
```

Ручной restore из дампа:

```bash
cd /var/www/FRPclient
sh ops/backup/postgres_restore.sh /var/backups/frpclient/postgres/latest.sql.gz --force
sh ops/backup/media_restore.sh /var/backups/frpclient/media/latest.tar.gz --force
```

`postgres_restore.sh` дропает и пересоздаёт целевую БД, поэтому используйте его только в окне обслуживания.

## Django Housekeeping

Для регулярной очистки служебных Django-данных есть отдельный systemd-контур:
- `ops/maintenance/django_housekeeping.sh`
- `ops/systemd/frpclient-django-housekeeping.service`
- `ops/systemd/frpclient-django-housekeeping.timer`

Он запускает:
- `python manage.py clearsessions`
- `python manage.py flushexpiredtokens`

Установка на VPS:

```bash
cp ops/systemd/frpclient-django-housekeeping.service /etc/systemd/system/
cp ops/systemd/frpclient-django-housekeeping.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-django-housekeeping.timer
systemctl start frpclient-django-housekeeping.service
journalctl -u frpclient-django-housekeeping.service -n 50 --no-pager
```

## Platform Metrics Refresh

Для автоматического обновления KPI и графиков админ-дашборда есть отдельный systemd-контур:
- `ops/maintenance/platform_metrics_refresh.sh`
- `ops/systemd/frpclient-platform-metrics.service`
- `ops/systemd/frpclient-platform-metrics.timer`

Он:
- определяет `yesterday` и `today` через Django `timezone.localdate()`;
- пересчитывает метрики за обе даты;
- валится ошибкой, если строки `DailyMetrics` для этих дат не создались.

Установка на VPS:

```bash
cp ops/systemd/frpclient-platform-metrics.service /etc/systemd/system/
cp ops/systemd/frpclient-platform-metrics.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-platform-metrics.timer
systemctl start frpclient-platform-metrics.service
journalctl -u frpclient-platform-metrics.service -n 50 --no-pager
```

## Public Smoke Monitor

Для регулярной проверки живого домена есть systemd-контур:
- `ops/monitoring/public_smoke.sh`
- `ops/systemd/frpclient-public-smoke.service`
- `ops/systemd/frpclient-public-smoke.timer`

Установка на VPS:

```bash
cp ops/systemd/frpclient-public-smoke.service /etc/systemd/system/
cp ops/systemd/frpclient-public-smoke.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-public-smoke.timer
systemctl start frpclient-public-smoke.service
journalctl -u frpclient-public-smoke.service -n 50 --no-pager
```

Монитор проверяет:
- `/`
- `/api/health/`
- OAuth start endpoints
- наличие Telegram bot username во фронтовом bundle

## Runtime Audit

Для регулярной операционной проверки прода есть отдельный systemd-контур:
- `ops/monitoring/runtime_audit.sh`
- `ops/systemd/frpclient-runtime-audit.service`
- `ops/systemd/frpclient-runtime-audit.timer`

Установка на VPS:

```bash
cp ops/systemd/frpclient-runtime-audit.service /etc/systemd/system/
cp ops/systemd/frpclient-runtime-audit.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-runtime-audit.timer
systemctl start frpclient-runtime-audit.service
journalctl -u frpclient-runtime-audit.service -n 50 --no-pager
```

Аудит проверяет:
- активные `frpclient-postgres-backup.timer` и `frpclient-public-smoke.timer`;
- активный `frpclient-media-backup.timer`, если он включён;
- активный `frpclient-media-verify.timer`, если он включён;
- активный `frpclient-django-housekeeping.timer`, если он включён;
- активный `frpclient-platform-metrics.timer`, если он включён;
- свежий успешный последний запуск `frpclient-public-smoke.service`;
- активный timer управляемого acceptance smoke;
- свежий успешный последний запуск `frpclient-managed-acceptance.service`;
- активные `certbot.timer` и dry-run timer проверки renewal;
- свежий успешный последний запуск `frpclient-certbot-dry-run.service`;
- свежий успешный последний запуск `frpclient-postgres-verify.service`, если включён его timer;
- свежий успешный последний запуск `frpclient-media-verify.service`, если включён его timer;
- свежий успешный последний запуск `frpclient-django-housekeeping.service`, если включён его timer;
- свежий успешный последний запуск `frpclient-platform-metrics.service`, если включён его timer;
- активный `fail2ban` и `sshd` jail;
- заполнение корневого диска;
- свежесть, размер и gzip-целостность последнего Postgres backup;
- свежесть, размер и tar-целостность последнего media backup, если включён его timer;
- корректность и свежесть `.deploy/release/current.json`, включая наличие source metadata;
- корректность latest rollback manifest в `.deploy/rollback/manifests`, включая source metadata у recovery point;
- что ключевые контейнеры запущены и healthy;
- публичный `/api/health/` и срок действия TLS-сертификата.

## Sentry + Structured Logging

Backend теперь пишет structured logs через `structlog` и прокидывает `X-Request-ID`:
- входящий `X-Request-ID` принимается, если он валиден;
- иначе backend генерирует новый request id и возвращает его в response header;
- этот же `request_id` попадает в backend logs и Sentry scope;
- чувствительные поля (`Authorization`, cookies, tokens, passwords, `rustdesk_password`) редактируются до `[REDACTED]`.

Frontend:
- инициализирует Sentry только если задан `VITE_SENTRY_DSN`;
- добавляет `X-Request-ID` в каждый API-запрос;
- прикладывает `request_id`, method/status/url к captured API errors;
- не отправляет в Sentry ожидаемые клиентские `4xx`.

Минимальная проверка после настройки DSN:

```bash
curl -i -H "X-Request-ID: smoke-observability-123" https://frpclient.ru/api/health/
```

Ожидаемо:
- в ответе есть `X-Request-ID: smoke-observability-123`;
- backend logs содержат `request_id=smoke-observability-123` или JSON-поле `request_id`;
- `sentry-sdk` и frontend Sentry остаются no-op, если DSN не задан.

Проверка backend Sentry test-event:

```bash
cd /var/www/FRPclient/backend
python manage.py shell -c "import sentry_sdk; sentry_sdk.capture_message('frpclient backend sentry smoke')"
```

Проверка frontend Sentry:
- задайте `VITE_SENTRY_DSN` и пересоберите frontend;
- откройте продовый сайт и спровоцируйте тестовую ошибку из DevTools Console:

```js
window.setTimeout(() => {
  throw new Error("frpclient frontend sentry smoke");
}, 0);
```

Для трассировки API-запроса по request id:

```bash
docker-compose -f docker-compose.prod.yml logs -f backend | grep smoke-observability-123
```

## Dependency Hygiene

Backend dependency ranges остаются в [backend/requirements.txt](/c:/Users/igor/Desktop/FRPclient/backend/requirements.txt), а reproducible CI/install resolution фиксируется в [backend/requirements.lock.txt](/c:/Users/igor/Desktop/FRPclient/backend/requirements.lock.txt). В CI backend всегда ставится через:

```bash
pip install -r backend/requirements.txt -c backend/requirements.lock.txt
```

GitHub Actions теперь дополнительно гоняет:
- `pip check`
- `pip-audit -r backend/requirements.lock.txt`
- `npm audit --audit-level=high`

Автообновления dependency-стека приходят через [dependabot.yml](/c:/Users/igor/Desktop/FRPclient/.github/dependabot.yml) для:
- `backend/` (pip)
- `frontend/` (npm)
- GitHub Actions

Если обновляете backend lock вручную, делайте это в чистом отдельном окружении и коммитьте вместе с изменением [backend/requirements.txt](/c:/Users/igor/Desktop/FRPclient/backend/requirements.txt).

## OpenAPI

Backend теперь публикует OpenAPI 3 schema через `drf-spectacular`:

```bash
GET /api/schema/
GET /api/schema/swagger/
GET /api/schema/redoc/
```

Локальная генерация schema-файла:

```bash
cd backend
set DEBUG=1
set DB_ENGINE=sqlite
python manage.py spectacular --file openapi.yml
```

PowerShell-вариант:

```powershell
cd backend
$env:DEBUG='1'
$env:DB_ENGINE='sqlite'
python manage.py spectacular --file openapi.yml
```

Что уже описано в schema:
- глобальные security schemes для `Bearer JWT` и same-origin `session cookie`;
- публичные schema/docs endpoints;
- production API version/title из `OPENAPI_*` env vars.

Что важно:
- legacy `APIView`, у которых нет явного `serializer_class` или `@extend_schema`, `drf-spectacular` пропускает graceful fallback'ом;
- это не ломает runtime API и не мешает генерации schema, но такие endpoints нужно аннотировать по мере доработки.

## API List Limits

Боевые list endpoint'ы больше не отдают неограниченные выборки. Общие параметры:
- `limit`
- `offset`
- `include_meta=1`

По умолчанию контракт не ломается: без `include_meta=1` list endpoint по-прежнему возвращает массив. Если нужен count/limit/offset, передавайте `include_meta=1`, и ответ будет в форме:

```json
{
  "count": 42,
  "limit": 100,
  "offset": 0,
  "results": []
}
```

Для cursor-like chat/event endpoint'ов дополнительно поддерживается безопасный `after_id`. Некорректные значения (`limit=abc`, `after_id=bad`, слишком большой `offset`) теперь возвращают `400`, а не приводят к silent fallback или `500`.

## Minimal Staging

Для risky migrations и pre-prod smoke теперь есть отдельный минимальный staging-контур без копирования всего production-ops слоя.

Файлы:
- [`.env.staging.example`](/c:/Users/igor/Desktop/FRPclient/.env.staging.example)
- [`backend/.env.staging.example`](/c:/Users/igor/Desktop/FRPclient/backend/.env.staging.example)
- [`ops/secrets/backend.staging.secrets.env.example`](/c:/Users/igor/Desktop/FRPclient/ops/secrets/backend.staging.secrets.env.example)
- [`ops/secrets/frontend.staging.build.secrets.env.example`](/c:/Users/igor/Desktop/FRPclient/ops/secrets/frontend.staging.build.secrets.env.example)
- [`ops/nginx/staging.frpclient.ru.conf`](/c:/Users/igor/Desktop/FRPclient/ops/nginx/staging.frpclient.ru.conf)
- [`scripts/deploy_staging.sh`](/c:/Users/igor/Desktop/FRPclient/scripts/deploy_staging.sh)

Смысл staging:
- отдельный `COMPOSE_PROJECT_NAME=frpclient-staging`;
- отдельные container names, named volumes и runtime-state (`.deploy.staging`);
- отдельный loopback bind `127.0.0.1:18081:80`;
- отдельный public base URL `https://staging.frpclient.ru`;
- staging не пишет release/status/lock в production `.deploy`.

Минимальная установка на VPS:

```bash
cd /var/www/FRPclient
cp .env.staging.example .env.staging
cp backend/.env.staging.example backend/.env.staging
sudo install -m 600 ops/secrets/backend.staging.secrets.env.example /etc/frpclient/backend.staging.secrets.env
sudo install -m 600 ops/secrets/frontend.staging.build.secrets.env.example /etc/frpclient/frontend.staging.build.secrets.env
sudo chown root:root /etc/frpclient/backend.staging.secrets.env /etc/frpclient/frontend.staging.build.secrets.env
sudo cp ops/nginx/staging.frpclient.ru.conf /etc/nginx/sites-available/staging.frpclient.ru.conf
sudo ln -sf /etc/nginx/sites-available/staging.frpclient.ru.conf /etc/nginx/sites-enabled/staging.frpclient.ru.conf
sudo nginx -t && sudo systemctl reload nginx
```

Deploy staging:

```bash
cd /var/www/FRPclient
sh scripts/deploy_staging.sh --smoke
```

Acceptance на staging, если нужен живой end-to-end прогон:

```bash
cd /var/www/FRPclient
sh scripts/deploy_staging.sh --smoke --acceptance
```

По умолчанию staging wrapper:
- использует `.env.staging`;
- включает preflight;
- сохраняет отдельный `deploy lock`, `job status` и `release state` в `.deploy.staging`;
- пропускает image snapshot и docker prune, чтобы staging не трогал production rollback/storage policy.

## Offsite Backups (R2 / S3)

Локальный backup-контур остаётся основным, но теперь его можно дублировать за пределы VPS в S3-compatible storage (`Cloudflare R2`, `AWS S3` и т.п.) без установки `awscli` на host. Для upload/verify используется временный Docker image `amazon/aws-cli`.

Базовая конфигурация в [backend/.env.example](/c:/Users/igor/Desktop/FRPclient/backend/.env.example):
- `OFFSITE_BACKUP_ENABLED=1`
- `OFFSITE_BACKUP_PROVIDER=r2` или `s3`
- `OFFSITE_BACKUP_BUCKET=...`
- `OFFSITE_BACKUP_REGION=auto`
- `OFFSITE_BACKUP_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com` для `R2` или пусто для обычного `AWS S3`
- `OFFSITE_BACKUP_PREFIX=frpclient/prod`
- `OFFSITE_BACKUP_AWS_CLI_IMAGE=amazon/aws-cli:2.31.1`

Секреты в [ops/secrets/backend.secrets.env.example](/c:/Users/igor/Desktop/FRPclient/ops/secrets/backend.secrets.env.example):
- `OFFSITE_BACKUP_ACCESS_KEY_ID=...`
- `OFFSITE_BACKUP_SECRET_ACCESS_KEY=...`

Поведение:
- `postgres_backup.sh` и `media_backup.sh` после локального архива автоматически отправляют его в offsite storage, если `OFFSITE_BACKUP_ENABLED=1`;
- в storage ведётся `latest.json` manifest для `postgres` и `media`;
- старые offsite archive objects очищаются по `keep-count`/`retention-days`;
- ежедневная проверка remote state идёт через [offsite_verify_backup.sh](/c:/Users/igor/Desktop/FRPclient/ops/backup/offsite_verify_backup.sh) и timer [frpclient-offsite-backup-verify.timer](/c:/Users/igor/Desktop/FRPclient/ops/systemd/frpclient-offsite-backup-verify.timer).

Установка на VPS:

```bash
cd /var/www/FRPclient
sudo install -m 644 ops/systemd/frpclient-offsite-backup-verify.service /etc/systemd/system/
sudo install -m 644 ops/systemd/frpclient-offsite-backup-verify.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now frpclient-offsite-backup-verify.timer
sudo systemctl start frpclient-offsite-backup-verify.service
```

Ручная проверка:

```bash
cd /var/www/FRPclient
IGNORE_DEPLOY_LOCK=1 sh ops/backup/postgres_backup.sh
IGNORE_DEPLOY_LOCK=1 sh ops/backup/media_backup.sh
IGNORE_DEPLOY_LOCK=1 sh ops/backup/offsite_verify_backup.sh
```

Если `OFFSITE_BACKUP_ENABLED=0`, offsite verify service корректно помечается как `skipped`.

## Frontend Quality Gate

Frontend теперь имеет базовый quality gate:
- `npm run lint`
- `npm run format:check`
- `npm run typecheck`
- `npm run test`
- `npm run test:a11y`
- `npm run build`

Конфиги лежат в:
- [eslint.config.js](/c:/Users/igor/Desktop/FRPclient/frontend/eslint.config.js)
- [.prettierrc.json](/c:/Users/igor/Desktop/FRPclient/frontend/.prettierrc.json)
- [tsconfig.json](/c:/Users/igor/Desktop/FRPclient/frontend/tsconfig.json)
- [vitest.config.js](/c:/Users/igor/Desktop/FRPclient/frontend/vitest.config.js)
- [vitest.a11y.config.js](/c:/Users/igor/Desktop/FRPclient/frontend/vitest.a11y.config.js)

Локальная проверка:

```bash
cd frontend
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:a11y
npm run build
```

## Frontend Accessibility Baseline

Для ключевого UI добавлен минимальный a11y-baseline:
- icon-only controls в shell, notifications и chat теперь имеют явные `aria-label`;
- auth status-сообщения объявляются через `role="alert"` / `role="status"` и `aria-live`;
- notifications drawer теперь имеет semantic `dialog` и keyboard-accessible list actions;
- focus-visible ring унифицирован для header controls, auth buttons и важных inline actions.

Автоматические проверки живут в `vitest-axe` и запускаются командой:

```bash
cd frontend
npm run test:a11y
```

## Gradual TypeScript Migration

Frontend переведён на постепенную TS-миграцию без переписывания всего UI сразу.
Сейчас на TypeScript уже вынесены:
- `src/shared/api/httpClient.ts`
- `src/shared/api/wsClient.ts`
- `src/shared/api/queryKeys.ts`
- `src/shared/auth/tokenStore.ts`
- `src/shared/auth/models.ts`
- `src/features/auth/api/authApi.ts`
- `src/features/auth/model/useLoginMutations.ts`

API payload contracts в shared auth-слое теперь валидируются через `zod`, а CI дополнительно гоняет `npm run typecheck`.

## Frontend Performance Delivery

Frontend delivery path теперь настроен так:
- глобальный `_t=Date.now()` больше не добавляется ко всем `GET` запросам;
- для действительно чувствительных endpoint'ов используется точечный `withBypassCache(...)`;
- edge/frontend nginx включают `gzip` для HTML, JSON, JS, CSS и SVG;
- font delivery для `Manrope` переведён на `dns-prefetch + preconnect + preload + display=swap`;
- Vite дополнительно разбивает heavy vendor-stack на отдельные чанки:
  - `vendor-observability`
  - `vendor-validation`
  - `vendor-dnd`
  - `vendor-icons`

Если новому GET endpoint нужна гарантированная сеть без browser cache reuse, используйте:

```js
import { withBypassCache } from "../shared/api/httpClient";

api.get("/notifications/", withBypassCache({ params: { is_read: 0 } }));
```

## Frontend E2E Smoke

Критический browser smoke теперь покрывает путь:
- login
- create appointment
- chat message
- chat file upload/download
- B2B queue visibility

Локальный запуск:

```bash
pip install -r backend/requirements.txt -c backend/requirements.lock.txt
npm --prefix frontend ci
npm --prefix frontend run e2e:install
npm --prefix frontend run e2e
```

Что поднимается автоматически:
- backend через [run_playwright_backend.py](/c:/Users/igor/Desktop/FRPclient/scripts/run_playwright_backend.py) на isolated SQLite/media runtime в `.playwright-runtime`
- approved B2B smoke-user через `python manage.py seed_playwright_smoke`
- Vite dev server с same-origin proxy на `/api` и `/ws`
- локальные isolated порты по умолчанию: backend `38123`, frontend `34173`

Основные переменные для override:
- `PLAYWRIGHT_SMOKE_USERNAME`
- `PLAYWRIGHT_SMOKE_PASSWORD`
- `PLAYWRIGHT_SMOKE_EMAIL`
- `PLAYWRIGHT_ADMIN_USERNAME`
- `PLAYWRIGHT_ADMIN_PASSWORD`
- `PLAYWRIGHT_ADMIN_EMAIL`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_BACKEND_PORT`
- `PLAYWRIGHT_FRONTEND_PORT`
- `PLAYWRIGHT_KEEP_RUNTIME=1`

## Safe Server Hardening

Репозиторий содержит безопасный hardening-слой для VPS:
- `ops/security/apply_safe_hardening.sh`
- `ops/security/apply_ssh_key_cutover.sh`
- `ops/security/fail2ban/jail.d/sshd.local`
- `ops/security/sysctl/99-frpclient-vm.conf`
- `ops/security/apt/20auto-upgrades`
- `ops/security/apt/52frpclient-unattended-upgrades`
- `ops/security/sshd_config.d/20-frpclient-safe.conf`
- `ops/security/sshd_config.d/30-frpclient-key-only.conf`

Что делает `apply_safe_hardening.sh`:
- создаёт swap-файл, если swap ещё не включён;
- ставит и включает `fail2ban` вместе с `python3-systemd` для `backend = systemd`;
- включает `unattended-upgrades`;
- применяет безопасный SSH drop-in без отключения password login;
- применяет безопасные VM/sysctl настройки;
- завершится ошибкой, если `fail2ban` не поднял `sshd` jail.

Запуск на VPS:

```bash
cd /var/www/FRPclient
sh ops/security/apply_safe_hardening.sh
```

Важно:
- этот safe hardening не отключает `root`/password login в SSH;
- для реального SSH-hardening сначала нужен ваш `public key`, и только после этого можно выключать парольный вход и `PermitRootLogin yes`.

Безопасный cutover на SSH-ключи:

```bash
cd /var/www/FRPclient
sh ops/security/apply_ssh_key_cutover.sh --public-key-file /root/igor_ed25519.pub
```

После проверки второго SSH-сеанса по ключу:

```bash
cd /var/www/FRPclient
sh ops/security/apply_ssh_key_cutover.sh --public-key-file /root/igor_ed25519.pub --lockdown
```

`--lockdown` включает:
- `PasswordAuthentication no`
- `KbdInteractiveAuthentication no`
- `ChallengeResponseAuthentication no`
- `PermitRootLogin prohibit-password`

## Release Gate 1.0

Минимальный релизный контракт, который стоит гонять перед деплоем:

```bash
python scripts/release_check.py
```

Что входит в проверку:
- backend: `pytest tests` на отдельном test settings c SQLite;
- frontend: production build через `npm run build`.

Локально можно запускать части отдельно:

```bash
python scripts/release_check.py --backend-only
python scripts/release_check.py --frontend-only
```

## Production Preflight

Перед боевым деплоем есть отдельная env-проверка:

```bash
python scripts/prod_preflight.py --base-url https://frpclient.ru
```

Она валит деплой заранее, если сломаны ключевые production-инварианты:
- `DEBUG=0`, корректный `SECRET_KEY`, без `ALLOWED_HOSTS=*`;
- `REDIS_URL` задан;
- `VITE_SITE_URL`, `OAUTH_FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` совпадают с боевым доменом;
- Telegram bot username синхронизирован между backend и frontend;
- OAuth callback URI для Google, Yandex и VK совпадают с `frpclient.ru`;
- VK использует новый `id.vk.com` flow.

`scripts/deploy_prod.sh` запускает этот preflight автоматически. Если нужно временно его пропустить, используйте `--skip-preflight`.

## Rollback

Перед каждым production deploy `scripts/deploy_prod.sh` сохраняет rollback snapshot текущих образов
в `.deploy/rollback/manifests/<timestamp>.env`.
Старые rollback manifest'ы и их docker tags автоматически чистятся, чтобы не раздувать диск;
по умолчанию сохраняются последние `10` snapshot'ов.
Этот inventory также отдается в `/api/admin/system/status/`, чтобы из админки было видно, к чему реально можно откатиться.
После самого rollback `scripts/rollback_prod.sh` пишет persisted status в `.deploy/status/rollback.json`,
поэтому в админке виден и последний результат recovery drill.
А `scripts/deploy_prod.sh` и `scripts/rollback_prod.sh` оба обновляют `.deploy/release/current.json`, поэтому текущий
live release в админке синхронизирован и после обычного релиза, и после recovery. История последних переходов тоже
обновляется автоматически и хранит короткий trail по `deploy`/`rollback`.
Запись `current release` больше не best-effort: deploy/rollback теперь обновляют её до post-release smoke/audit,
поэтому тот же самый runtime audit уже проверяет свежий live release, а не предыдущий.
Для старых snapshot'ов source metadata может оставаться пустой; новые snapshot'ы уже сохраняют её в manifest и
после rollback показывают корректный live source fingerprint без зависимости от server-side git checkout.

Список доступных snapshot:

```bash
sh scripts/rollback_prod.sh --list
```

Откат к последнему snapshot:

```bash
sh scripts/rollback_prod.sh --smoke --runtime-audit --telegram-bot-username ClientFRP_bot
```

Откат к конкретному snapshot:

```bash
sh scripts/rollback_prod.sh --label 20260311T220000Z --smoke --runtime-audit --telegram-bot-username ClientFRP_bot
```

После успешного deploy/rollback выполняется безопасный `docker image prune` только для dangling images,
чтобы регулярные rebuild не раздували диск rollback-tag'ами и `<none>`-образами.

## Managed Production Acceptance

Есть управляемый e2e acceptance smoke, который:
- сам создаёт временного верифицированного клиента;
- проходит login, `/api/me/`, `/api/dashboard/`, создание заявки;
- проверяет websocket ping/pong и живое событие `appointment.client_access_updated`;
- затем удаляет временного пользователя и связанные артефакты из прод-БД.

Запуск:

```bash
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py run_prod_acceptance --base-url https://frpclient.ru
```

Для отладки можно сохранить артефакты:

```bash
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py run_prod_acceptance --base-url https://frpclient.ru --keep-artifacts
```

Для регулярной проверки этого business-flow есть отдельный systemd-контур:
- `ops/monitoring/managed_acceptance.sh`
- `ops/systemd/frpclient-managed-acceptance.service`
- `ops/systemd/frpclient-managed-acceptance.timer`

Установка на VPS:

```bash
cp ops/systemd/frpclient-managed-acceptance.service /etc/systemd/system/
cp ops/systemd/frpclient-managed-acceptance.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-managed-acceptance.timer
systemctl start frpclient-managed-acceptance.service
journalctl -u frpclient-managed-acceptance.service -n 50 --no-pager
```

## Certbot Renewal Dry-Run

Чтобы не узнавать о проблеме renewal в день истечения сертификата, есть отдельная dry-run проверка:
- `ops/monitoring/certbot_dry_run.sh`
- `ops/systemd/frpclient-certbot-dry-run.service`
- `ops/systemd/frpclient-certbot-dry-run.timer`

Установка на VPS:

```bash
cp ops/systemd/frpclient-certbot-dry-run.service /etc/systemd/system/
cp ops/systemd/frpclient-certbot-dry-run.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frpclient-certbot-dry-run.timer
systemctl start frpclient-certbot-dry-run.service
journalctl -u frpclient-certbot-dry-run.service -n 50 --no-pager
```

## Telegram Login: Bot domain invalid

В `@BotFather`:

```text
/setdomain
@ClientFRP_bot
frpclient.ru
```

Вводите только домен, без `https://`, `/`, портов и путей.

Если `Bot domain invalid` повторяется:
- проверьте HTTPS доступность домена;
- проверьте, что в настройках бота указан именно `frpclient.ru`;
- открывайте страницу логина с домена, который принят BotFather.

## OAuth Redirect URI Setup

Если Google, VK или Яндекс возвращают `redirect_uri_mismatch`, `Security Error` или похожую ошибку,
значит в кабинете провайдера не зарегистрированы callback URL из `backend/.env` / `BACKEND_SECRETS_FILE`.

Для production `frpclient.ru` должны быть разрешены точные URI:

```text
Google: https://frpclient.ru/api/auth/oauth/google/callback/
Yandex: https://frpclient.ru/api/auth/oauth/yandex/callback/
VK: https://frpclient.ru/api/auth/oauth/vk/callback/
```

После изменения callback URL в кабинете провайдера проверьте, что в `backend/.env` / `BACKEND_SECRETS_FILE`
совпадают `GOOGLE_OAUTH_REDIRECT_URI`, `YANDEX_OAUTH_REDIRECT_URI`, `VK_OAUTH_REDIRECT_URI`,
и перезапустите backend:

```bash
sh scripts/deploy_prod.sh --with-bot --skip-image-snapshot --smoke --runtime-audit --telegram-bot-username ClientFRP_bot
```

## Полезные команды

```bash
# логи backend
docker-compose -f docker-compose.prod.yml logs -f backend

# логи frontend
docker-compose -f docker-compose.prod.yml logs -f frontend

# перезапуск
docker-compose -f docker-compose.prod.yml up -d --build
```

Если на сервере установлен Compose Plugin (`docker compose`), используйте его.
Если сервер старый и доступен только `docker-compose`, текущие prod-файлы совместимы и с ним.

## Важные замечания

- Не храните `.env`, `backend/.env`, `/etc/frpclient/*.env` в git.
- Для продакшена используйте длинный `SECRET_KEY` (минимум 32+ символа).
- Ограничьте `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS` под ваш домен.
- Для production с отдельным `backend-ws` `REDIS_URL` обязателен, иначе realtime между контейнерами не будет работать.
