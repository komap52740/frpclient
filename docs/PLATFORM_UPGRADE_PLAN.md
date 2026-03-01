# Platform Upgrade Plan (Phase 0 Discovery)

Дата: 2026-03-01  
Статус: Discovery complete, без функциональных изменений.

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
