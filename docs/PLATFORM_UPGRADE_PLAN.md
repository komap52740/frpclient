# Platform Upgrade Plan (Phase 0 Discovery)

Дата: 2026-03-01  
Статус: Discovery complete, без функциональных изменений.

## Progress Log

- ✅ Phase 0 complete:
  - repository discovery and compatibility contract documented.
- ✅ Phase 1 complete:
  - new `apps.platform` foundation app added.
  - `PlatformEvent`, `FeatureFlag`, `Notification`, `SoftDeleteAuditMixin` introduced.
  - notification APIs and admin feature-flag APIs added under legacy `/api/*`.
  - chat soft-delete harmonized with `deleted_by`.
  - tests added for event emission, feature flag evaluation, notifications unread flow.
- ✅ Phase 2 complete:
  - platform events integrated into appointment lifecycle, chat and reviews.
  - existing appointment timeline endpoint `/api/appointments/{id}/events/` preserved.
  - admin event inspection endpoint added: `GET /api/v1/events/`.
  - integration tests added for lifecycle/chat/review event emission.
- ✅ Phase 3 complete:
  - safe rule engine added (`Rule` model + JSON conditions/actions, no `eval`).
  - rule execution is triggered synchronously after every `emit_event`.
  - supported actions: `create_notification`, `change_status` (safe transitions), `assign_tag/assign_flag`, `request_admin_attention`.
  - admin CRUD API for rules: `/api/v1/admin/rules/`.
  - management command added: `python manage.py replay_platform_rules --last=200`.
- ✅ Phase 4 complete:
  - client risk scoring fields added to `ClientStats`: `risk_score`, `risk_level`, `risk_updated_at`.
  - risk score is recalculated in `recalculate_client_stats` and refreshed on key flows (including ban/unban and review updates).
  - risk is exposed in `/api/me`, admin users API and appointment detail for the assigned master.
- ✅ Phase 5 complete:
  - `MasterStats` model added with `master_score` and KPI components.
  - master score recalculation added and hooked into status/review flows.
  - master dashboard now returns `master_score`.
  - admin masters API supports score sorting/filtering (`ordering`, `min_score`).
- ✅ Phase 6 complete:
  - `DailyMetrics` model added for aggregated daily KPI snapshots.
  - aggregation service and management command added:
    - `python manage.py compute_daily_metrics --date=YYYY-MM-DD`
    - `python manage.py compute_daily_metrics --from=YYYY-MM-DD --to=YYYY-MM-DD`
  - admin metrics API added: `GET /api/v1/admin/metrics/daily?from=...&to=...`.

## 1. Repo Structure Summary

## 1.1 Monorepo top-level
- `backend/` — Django + DRF API.
- `frontend/` — React SPA (Vite + MUI).
- `docker-compose.yml` — dev-like stack.
- `docker-compose.prod.yml` — production stack.
- `docs/` — product and architecture documents.

## 1.2 Backend apps (current)
- `apps.accounts` — auth, user roles, bootstrap-admin, dashboard summary, site settings.
- `apps.appointments` — appointment lifecycle, statuses, payment steps, timeline events.
- `apps.chat` — appointment chat/messages, read state, soft-delete for messages.
- `apps.reviews` — client/master reviews and behavior flags.
- `apps.adminpanel` — admin operational APIs (users, masters, appointments, system actions/settings).
- `apps.common` — health endpoints.

## 1.3 Frontend (current)
- Role-based SPA routes in `frontend/src/App.jsx`.
- Auth context + API client with JWT refresh cookie flow.
- Client/master/admin dashboards and appointment detail screen.
- Chat panel and event timeline visualization.

## 2. Current Auth Flow

- Public endpoints:
  - `GET /api/auth/bootstrap-status/`
  - `POST /api/auth/bootstrap-admin/`
  - `POST /api/auth/login/`
  - `POST /api/auth/telegram/`
  - `POST /api/auth/refresh/`
  - `POST /api/auth/logout/`
- Session mechanics:
  - access token in frontend storage.
  - refresh token in httpOnly cookie.
- `GET /api/me/` returns user profile + payment settings.
- Roles: `client`, `master`, `admin` (+ `is_superuser` fallback).

## 3. Current Appointment Status Machine

Status set in `apps.appointments.models.AppointmentStatusChoices`:
- `NEW`
- `IN_REVIEW`
- `AWAITING_PAYMENT`
- `PAYMENT_PROOF_UPLOADED`
- `PAID`
- `IN_PROGRESS`
- `COMPLETED`
- `DECLINED_BY_MASTER`
- `CANCELLED`

Current key transitions:
- master take: `NEW -> IN_REVIEW`
- master set price: `IN_REVIEW -> AWAITING_PAYMENT`
- client mark paid + proof: `AWAITING_PAYMENT -> PAYMENT_PROOF_UPLOADED`
- master/admin confirm payment: `PAYMENT_PROOF_UPLOADED -> PAID`
- master start: `PAID -> IN_PROGRESS`
- master complete: `IN_PROGRESS -> COMPLETED`
- master decline: `IN_REVIEW|AWAITING_PAYMENT -> DECLINED_BY_MASTER`

## 4. Existing Events / Timeline Implementation

- Domain timeline model: `apps.appointments.models.AppointmentEvent`.
- Created on lifecycle actions through `apps.appointments.services.add_event` + `transition_status`.
- Timeline endpoint:
  - `GET /api/appointments/{id}/events/`
- Chat delete also emits appointment event (`message_deleted`).
- Frontend renders timeline in appointment detail.

## 5. Existing Dashboards and Admin APIs

Dashboard:
- `GET /api/dashboard/` (role-aware counts for client/master/admin).

Admin operational APIs (current):
- appointments list + actions:
  - `GET /api/admin/appointments/`
  - `POST /api/admin/appointments/{id}/confirm-payment/`
  - `POST /api/admin/appointments/{id}/set-status/`
- users/roles/ban:
  - `GET /api/admin/users/`
  - `GET /api/admin/users/all/`
  - `POST /api/admin/users/{id}/ban/`
  - `POST /api/admin/users/{id}/unban/`
  - `POST /api/admin/users/{id}/role/`
- masters:
  - `GET /api/admin/masters/`
  - `POST /api/admin/masters/{id}/activate/`
  - `POST /api/admin/masters/{id}/suspend/`
- system:
  - `GET /api/admin/system/status/`
  - `GET|PUT|PATCH /api/admin/system/settings/`
  - `POST /api/admin/system/run-action/`

## 6. Tests and Coverage Baseline

- Test framework: `pytest` + `pytest-django`.
- Config: `backend/pytest.ini`.
- Current baseline tests mostly in:
  - `backend/tests/test_api_rules.py`
- Covered areas:
  - appointment transitions and permissions
  - auth bootstrap/login
  - admin system actions/settings
  - dashboard summary
  - health endpoint
  - timeline endpoint presence

## 7. Docker / Runtime / Env Summary

## 7.1 Dev-like stack (`docker-compose.yml`)
- `postgres`
- `backend` (gunicorn, bind `8000`, healthcheck `/healthz`)
- `frontend` (Vite dev server `5173`)

## 7.2 Production stack (`docker-compose.prod.yml`)
- `postgres`
- `backend` (migrate + collectstatic + gunicorn, healthcheck `/healthz`)
- `frontend` (Nginx serving built SPA, proxying `/api`, `/healthz`, `/django-admin`, `/static`, `/media`)
- Media volume shared between backend and frontend container.

## 7.3 Health contract (must remain 200)
- `GET /healthz`
- `GET /api/health/`

## 8. Compatibility Contract (must remain intact)

Все endpoints ниже должны продолжать работать как есть:

Auth:
- `GET /api/auth/bootstrap-status/`
- `POST /api/auth/bootstrap-admin/`
- `POST /api/auth/login/`
- `POST /api/auth/telegram/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `GET /api/me/`
- `GET /api/dashboard/`

Appointments:
- `POST /api/appointments/`
- `GET /api/appointments/my/`
- `GET /api/appointments/new/`
- `GET /api/appointments/active/`
- `GET /api/appointments/{id}/`
- `GET /api/appointments/{id}/events/`
- `POST /api/appointments/{id}/take/`
- `POST /api/appointments/{id}/decline/`
- `POST /api/appointments/{id}/set-price/`
- `POST /api/appointments/{id}/upload-payment-proof/`
- `POST /api/appointments/{id}/mark-paid/`
- `POST /api/appointments/{id}/confirm-payment/`
- `POST /api/appointments/{id}/start/`
- `POST /api/appointments/{id}/complete/`

Chat:
- `GET /api/appointments/{id}/messages/`
- `POST /api/appointments/{id}/messages/`
- `DELETE /api/messages/{id}/`
- `POST /api/appointments/{id}/read/`

Reviews:
- `POST /api/appointments/{id}/review-master/`
- `POST /api/appointments/{id}/review-client/`

Admin:
- `GET /api/admin/appointments/`
- `POST /api/admin/appointments/{id}/confirm-payment/`
- `POST /api/admin/appointments/{id}/set-status/`
- `GET /api/admin/users/`
- `GET /api/admin/users/all/`
- `POST /api/admin/users/{id}/ban/`
- `POST /api/admin/users/{id}/unban/`
- `POST /api/admin/users/{id}/role/`
- `GET /api/admin/masters/`
- `POST /api/admin/masters/{id}/activate/`
- `POST /api/admin/masters/{id}/suspend/`
- `GET /api/admin/system/status/`
- `GET|PUT|PATCH /api/admin/system/settings/`
- `POST /api/admin/system/run-action/`

Health / ops:
- `GET /healthz`
- `GET /api/health/`
- `GET /django-admin/` (Django admin route)

## 9. Upgrade Strategy Overview

1. Additive foundation first:
   - `platform` app with generic events, feature flags, notifications, audit helpers.
2. Integrate platform events into existing flows without removing appointment timeline.
3. Introduce safe rule engine (JSON conditions, no `eval`).
4. Add scoring layers (client risk, master performance) as computed fields.
5. Add daily metrics aggregation and admin analytics API.
6. Add SLA fields and breach events/notifications.
7. Add granular admin sub-roles with backward default (`admin => super_admin` behavior).
8. Introduce `/api/v1/*` as canonical while keeping `/api/*` aliases.
9. Frontend integration in additive manner (notifications, metrics, risk indicators, rules UI).
10. Final hardening: tests + docs + docker verification.

## 10. Safety and Rollout Controls

- All risky features behind feature flags where practical.
- Small commits per phase.
- Backward-compatible APIs preserved.
- Existing production flows remain primary acceptance criterion.

## 11. Client Risk Formula (Phase 4)

`risk_score` (0..100, higher = riskier) is computed as:
- `cancellation_component = cancellation_rate * 45`
- `behavior_component = min(negative_behavior_flags * 8, 25)`
- `age_component = ((30 - account_age_days) / 30) * 15`, if account younger than 30 days
- `experience_component = ((5 - completed_orders) / 5) * 10`, if completed orders < 5
- `rating_component = ((5 - avg_rating) / 4) * 20`

Level thresholds:
- `0..24` => `low`
- `25..49` => `medium`
- `50..74` => `high`
- `75..100` => `critical`
