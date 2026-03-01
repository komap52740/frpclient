# FRP Client: Р‘РѕРµРІР°СЏ РЎРїРµС†РёС„РёРєР°С†РёСЏ Р РµРґРёР·Р°Р№РЅР° 2026

Р”Р°С‚Р°: 2026-03-01  
Р¤РѕРєСѓСЃ: UX/UI-С‚СЂР°РЅСЃС„РѕСЂРјР°С†РёСЏ Р±РµР· РёР·РјРµРЅРµРЅРёСЏ Р±РёР·РЅРµСЃ-Р»РѕРіРёРєРё backend.

## 0. Р“СЂР°РЅРёС†С‹ РїСЂРѕРµРєС‚Р°

### Р§С‚Рѕ РќР• РјРµРЅСЏРµРј
- Р РѕР»РµРІСѓСЋ РјРѕРґРµР»СЊ (`client`, `master`, `admin`).
- РћСЃРЅРѕРІРЅС‹Рµ СЃС‚Р°С‚СѓСЃС‹ Р·Р°СЏРІРѕРє Рё РїРµСЂРµС…РѕРґС‹ backend.
- РљР»СЋС‡РµРІС‹Рµ API-СЃС†РµРЅР°СЂРёРё РѕРїР»Р°С‚С‹, С‡Р°С‚Р°, РЅР°Р·РЅР°С‡РµРЅРёР№ Рё Р°РґРјРёРЅ-РѕРїРµСЂР°С†РёР№.

### Р§С‚Рѕ РјРµРЅСЏРµРј
- РРЅС„РѕСЂРјР°С†РёРѕРЅРЅСѓСЋ Р°СЂС…РёС‚РµРєС‚СѓСЂСѓ СЌРєСЂР°РЅРѕРІ.
- Р’РёР·СѓР°Р»СЊРЅС‹Р№ СЏР·С‹Рє Рё РґРёР·Р°Р№РЅ-СЃРёСЃС‚РµРјСѓ.
- РўРµРєСЃС‚С‹ РёРЅС‚РµСЂС„РµР№СЃР° (С‡РµР»РѕРІРµС‡РµСЃРєРёР№ РјРёРєСЂРѕРєРѕРїРёСЂР°Р№С‚РёРЅРі).
- РљРѕРјРїРѕРЅРµРЅС‚РЅС‹Р№ СЃР»РѕР№ С„СЂРѕРЅС‚РµРЅРґР°.
- РџРѕРІРµРґРµРЅРёРµ UI (loading, optimistic UI, Р°РЅРёРјР°С†РёРё, mobile-first РЅР°РІРёРіР°С†РёСЏ).

---

## 1. Р¦РµР»РµРІРѕР№ РїСЂРѕРґСѓРєС‚РѕРІС‹Р№ РѕРїС‹С‚

### РџСЂРёРЅС†РёРї
РћРґРёРЅ СЌРєСЂР°РЅ = РѕРґРЅР° С†РµР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ = РѕРґРёРЅ РіР»Р°РІРЅС‹Р№ CTA.

### Р­РјРѕС†РёРѕРЅР°Р»СЊРЅР°СЏ РјРѕРґРµР»СЊ
- Р’С…РѕРґ: "РЇ РІ Р±РµР·РѕРїР°СЃРЅРѕР№ СЃРёСЃС‚РµРјРµ."
- РЎРѕР·РґР°РЅРёРµ Р·Р°СЏРІРєРё: "Р­С‚Рѕ РїСЂРѕСЃС‚Рѕ Рё РїРѕРЅСЏС‚РЅРѕ."
- РћР¶РёРґР°РЅРёРµ: "РџСЂРѕС†РµСЃСЃ РїРѕРґ РєРѕРЅС‚СЂРѕР»РµРј, РЅРµ РїСЂРѕРїР°Р»Рё."
- РћРїР»Р°С‚Р°: "РџСЂРѕР·СЂР°С‡РЅРѕ, Р·Р°С‰РёС‰РµРЅРЅРѕ, Р±РµР· СЃСЋСЂРїСЂРёР·РѕРІ."
- Р Р°Р±РѕС‚Р° РјР°СЃС‚РµСЂР°: "РЇ РІРёР¶Сѓ С…РѕРґ СЂР°Р±РѕС‚ Рё РјРѕРіСѓ РѕСЃС‚Р°РЅРѕРІРёС‚СЊ."
- Р—Р°РІРµСЂС€РµРЅРёРµ: "Р•СЃС‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚ Рё РїРѕРЅСЏС‚РЅС‹Р№ СЃР»РµРґСѓСЋС‰РёР№ С€Р°Рі."

### Р“Р»Р°РІРЅС‹Рµ UX-СЃС‚СЂР°С…Рё Рё РєР°Рє СЃРЅРёРјР°РµРј
- РЎС‚СЂР°С… СѓРґР°Р»РµРЅРЅРѕРіРѕ РґРѕСЃС‚СѓРїР°: Р±Р»РѕРє "Р§С‚Рѕ РјР°СЃС‚РµСЂ РјРѕР¶РµС‚/РЅРµ РјРѕР¶РµС‚ РґРµР»Р°С‚СЊ" + С‚Р°Р№РјРµСЂ СЃРµСЃСЃРёРё + Р¶СѓСЂРЅР°Р» РґРµР№СЃС‚РІРёР№.
- РЎС‚СЂР°С… РѕРїР»Р°С‚С‹: СЏРІРЅС‹Рµ СЂРµРєРІРёР·РёС‚С‹, СЃС‚Р°С‚СѓСЃ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ, С‡РµРєР»РёСЃС‚ "С‡С‚Рѕ РїСЂРѕРёСЃС…РѕРґРёС‚ РїРѕСЃР»Рµ РѕРїР»Р°С‚С‹".
- РЎС‚СЂР°С… С‚РёС€РёРЅС‹: С‚Р°Р№РјР»Р°Р№РЅ СЃС‚Р°С‚СѓСЃРѕРІ Рё СЃРёСЃС‚РµРјРЅС‹Рµ СЃРѕР±С‹С‚РёСЏ РІ С‡Р°С‚Рµ.
- РЎС‚СЂР°С… РїРѕС‚РµСЂРё РєРѕРЅС‚СЂРѕР»СЏ: РѕРґРЅР° РіР»Р°РІРЅР°СЏ РєРЅРѕРїРєР° "РџСЂРѕРґРѕР»Р¶РёС‚СЊ РїРѕ Р·Р°СЏРІРєРµ" РЅР° РєР»РёРµРЅС‚СЃРєРѕРј РґР°С€Р±РѕСЂРґРµ.

---

## 2. РќРѕРІР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° СЌРєСЂР°РЅРѕРІ (IA)

## 2.1 Client
- `C1` Р“Р»Р°РІРЅР°СЏ РєР»РёРµРЅС‚Р° (С‚РµРєСѓС‰РёР№ СЌС‚Р°Рї + РіР»Р°РІРЅС‹Р№ CTA).
- `C2` РЎРѕР·РґР°РЅРёРµ Р·Р°СЏРІРєРё (wizard, 3 С€Р°РіР°).
- `C3` РњРѕРё Р·Р°СЏРІРєРё (РєР°СЂС‚РѕС‡РєРё + С„РёР»СЊС‚СЂ СЌС‚Р°РїР°).
- `C4` Р”РµС‚Р°Р»Рё Р·Р°СЏРІРєРё (С‚Р°Р№РјР»Р°Р№РЅ + С‡РµРєРїРѕРёРЅС‚С‹ + РїР»Р°С‚РµР¶Рё + С‡Р°С‚ entry point).
- `C5` Р­РєСЂР°РЅ РѕРїР»Р°С‚С‹ (СЂРµРєРІРёР·РёС‚С‹ + Р·Р°РіСЂСѓР·РєР° С‡РµРєР° + РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ).
- `C6` Р§Р°С‚ РїРѕ Р·Р°СЏРІРєРµ (СЃРѕ СЃС‚Р°С‚СѓСЃРЅС‹РјРё СЃРѕР±С‹С‚РёСЏРјРё Рё РІР»РѕР¶РµРЅРёСЏРјРё).
- `C7` Р—Р°РІРµСЂС€РµРЅРёРµ Рё РѕС†РµРЅРєР°.

## 2.2 Master
- `M1` РќРѕРІС‹Рµ Р·Р°СЏРІРєРё (РїСЂРёРѕСЂРёС‚РµС‚РЅС‹Р№ РїРѕС‚РѕРє, Р±С‹СЃС‚СЂР°СЏ РѕР±СЂР°Р±РѕС‚РєР°).
- `M2` РђРєС‚РёРІРЅС‹Рµ Р·Р°СЏРІРєРё (kanban-lite РїРѕ СЌС‚Р°РїР°Рј).
- `M3` Р”РµС‚Р°Р»Рё Р·Р°СЏРІРєРё (С†РµРЅР°, РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РѕРїР»Р°С‚С‹, Р·Р°РїСѓСЃРє, Р·Р°РІРµСЂС€РµРЅРёРµ).
- `M4` Р§Р°С‚ Рё РІР»РѕР¶РµРЅРёСЏ.

## 2.3 Admin
- `A1` РћРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РѕР±Р·РѕСЂ (СЃРёРіРЅР°Р»С‹ Рё SLA).
- `A2` РџРѕР»СЊР·РѕРІР°С‚РµР»Рё Рё СЂРѕР»Рё.
- `A3` Р—Р°СЏРІРєРё Рё РїР»Р°С‚РµР¶Рё.
- `A4` РќР°СЃС‚СЂРѕР№РєРё СЃРёСЃС‚РµРјС‹.
- `A5` РЎРёСЃС‚РµРјРЅС‹Рµ РґРµР№СЃС‚РІРёСЏ Рё СЃС‚Р°С‚СѓСЃ.

---

## 3. User Flow v2 (РїРѕ СЌС‚Р°РїР°Рј)

## 3.1 Р’С…РѕРґ (`/login`)
- РџРµСЂРІРёС‡РЅС‹Р№ Р±Р»РѕРє: "Р’РѕР№С‚Рё С‡РµСЂРµР· Telegram".
- РђР»СЊС‚РµСЂРЅР°С‚РёРІР°: "Р›РѕРіРёРЅ/РїР°СЂРѕР»СЊ" РІС‚РѕСЂРёС‡РЅС‹Рј С‚Р°Р±РѕРј.
- Р•СЃР»Рё РїРµСЂРІС‹Р№ Р·Р°РїСѓСЃРє: РєР°СЂС‚РѕС‡РєР° bootstrap-Р°РґРјРёРЅР° СЃ С‡РµС‚РєРёРјРё РїРѕР»СЏРјРё.
- РЈСЃРїРµС… РІС…РѕРґР°: РјРіРЅРѕРІРµРЅРЅС‹Р№ СЂРµРґРёСЂРµРєС‚ РЅР° СЂРѕР»СЊ-РґР°С€Р±РѕСЂРґ.

### Р“Р»Р°РІРЅС‹Р№ CTA
- `Р’РѕР№С‚Рё`.

## 3.2 РЎРѕР·РґР°РЅРёРµ Р·Р°СЏРІРєРё (`/client/create`)
- РЁР°Рі 1: РЈСЃС‚СЂРѕР№СЃС‚РІРѕ (Р±СЂРµРЅРґ, РјРѕРґРµР»СЊ, С‚РёРї Р±Р»РѕРєРёСЂРѕРІРєРё).
- РЁР°Рі 2: РљРѕРЅС‚РµРєСЃС‚ (РѕРїРёСЃР°РЅРёРµ, РµСЃС‚СЊ Р»Рё РџРљ).
- РЁР°Рі 3: РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ Рё РѕС‚РїСЂР°РІРєР°.
- РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ С‡РµСЂРЅРѕРІРёРєР° РІ `localStorage`.

### Р“Р»Р°РІРЅС‹Р№ CTA
- `РћС‚РїСЂР°РІРёС‚СЊ Р·Р°СЏРІРєСѓ`.

## 3.3 РћР¶РёРґР°РЅРёРµ РјР°СЃС‚РµСЂР° (`/client/home` + `/appointments/:id`)
- РљСЂСѓРїРЅС‹Р№ С‚РµРєСѓС‰РёР№ СЃС‚Р°С‚СѓСЃ.
- ETA-Р±Р»РѕРє "РЎСЂРµРґРЅРµРµ РІСЂРµРјСЏ РѕС‚РєР»РёРєР°".
- РўР°Р№РјР»Р°Р№РЅ СЌС‚Р°РїРѕРІ (РІРёР·СѓР°Р»СЊРЅС‹Р№ РїСЂРѕРіСЂРµСЃСЃ).

### Р“Р»Р°РІРЅС‹Р№ CTA
- `РћС‚РєСЂС‹С‚СЊ С‡Р°С‚`.

## 3.4 РћРїР»Р°С‚Р° (`/appointments/:id` + payment block)
- Р•РґРёРЅР°СЏ РїР°РЅРµР»СЊ РѕРїР»Р°С‚С‹ СЃ РґРІСѓРјСЏ РјРµС‚РѕРґР°РјРё.
- РџРѕС€Р°РіРѕРІС‹Р№ С‚РµРєСЃС‚ "1) РћРїР»Р°С‚РёС‚Рµ 2) Р—Р°РіСЂСѓР·РёС‚Рµ С‡РµРє 3) РџРѕРґС‚РІРµСЂРґРёС‚Рµ РѕРїР»Р°С‚Сѓ".
- РџРѕСЃР»Рµ `mark-paid` РїРѕРєР°Р·С‹РІР°С‚СЊ СЃРѕСЃС‚РѕСЏРЅРёРµ "РџР»Р°С‚РµР¶ РЅР° РїСЂРѕРІРµСЂРєРµ".

### Р“Р»Р°РІРЅС‹Р№ CTA
- `РЇ РѕРїР»Р°С‚РёР»`.

## 3.5 РџРѕРґРєР»СЋС‡РµРЅРёРµ Рё СЂР°Р±РѕС‚Р°
- РЎРёСЃС‚РµРјРЅРѕРµ СЃРѕР±С‹С‚РёРµ "РњР°СЃС‚РµСЂ РЅР°С‡Р°Р» СЂР°Р±РѕС‚Сѓ".
- РўР°Р№РјРµСЂ СЃРµСЃСЃРёРё Рё Р·Р°РјРµС‚РЅС‹Р№ СЃС‚Р°С‚СѓСЃ "Р Р°Р±РѕС‚Р° РёРґРµС‚".
- РљРЅРѕРїРєР° Р°РІР°СЂРёР№РЅРѕР№ СЌСЃРєР°Р»Р°С†РёРё (СЃРѕР·РґР°РЅРёРµ admin-СЃРёРіРЅР°Р»Р° РІ UI, backend СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РЅРµ Р»РѕРјР°РµРј: РїРѕРєР° Р»РѕРєР°Р»СЊРЅС‹Р№ UI-С„Р»Р°Рі + СЃРѕРѕР±С‰РµРЅРёРµ РІ С‡Р°С‚).

### Р“Р»Р°РІРЅС‹Р№ CTA
- `РЎРІСЏР·Р°С‚СЊСЃСЏ СЃ РјР°СЃС‚РµСЂРѕРј`.

## 3.6 Р—Р°РІРµСЂС€РµРЅРёРµ Рё РѕС†РµРЅРєР°
- РћС‚РґРµР»СЊРЅС‹Р№ СЌРєСЂР°РЅ Р·Р°РІРµСЂС€РµРЅРёСЏ.
- Р§РµРєР»РёСЃС‚ РїРѕСЃС‚-РґРµР№СЃС‚РІРёР№ (Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ/РїСЂРѕРІРµСЂРєР°).
- Р РµР№С‚РёРЅРі Рё РєРѕСЂРѕС‚РєРёР№ РѕС‚Р·С‹РІ.

### Р“Р»Р°РІРЅС‹Р№ CTA
- `РџРѕРґС‚РІРµСЂРґРёС‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚`.

---

## 4. РљРѕРјРїРѕРЅРµРЅС‚РЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР° С„СЂРѕРЅС‚РµРЅРґР°

РќРѕРІС‹Р№ СЃР»РѕР№ Р±РµР· Р»РѕРјРєРё С‚РµРєСѓС‰РёС… API:

```text
frontend/src/
  design/
    tokens/
      colors.js
      spacing.js
      typography.js
      motion.js
    theme/
      lightTheme.js
      darkTheme.js
      index.js
  ui/
    Button/
    Card/
    Input/
    Select/
    Badge/
    Timeline/
    Skeleton/
    EmptyState/
    Kpi/
    Toast/
    BottomNav/
    Fab/
  domain/
    appointment/
      components/
        AppointmentStageTimeline.jsx
        AppointmentStatusHero.jsx
        AppointmentPaymentPanel.jsx
        AppointmentTrustPanel.jsx
      hooks/
        useAppointmentStage.js
        useOptimisticAppointmentActions.js
    chat/
      components/
        ChatComposer.jsx
        ChatMessageBubble.jsx
        ChatSystemEvent.jsx
        ChatTypingIndicator.jsx
      hooks/
        useChatStream.js
        useReadState.js
    dashboard/
      client/
      master/
      admin/
  features/
    auth/
    appointments/
    chat/
    reviews/
    admin/
  app/
    routing/
      roleRoutes.jsx
    providers/
      QueryProvider.jsx
      ThemeProvider.jsx
      ToastProvider.jsx
```

### РџСЂР°РІРёР»Р°
- `ui/*` РЅРµ Р·РЅР°РµС‚ Рѕ Р±РёР·РЅРµСЃ-СЃСѓС‰РЅРѕСЃС‚СЏС….
- `domain/*` Р·РЅР°РµС‚ РїСЂРѕ СЃС‚Р°С‚СѓСЃС‹ Рё API DTO.
- РЎС‚СЂР°РЅРёС†С‹ СЃРѕР±РёСЂР°СЋС‚СЃСЏ РёР· `domain` + `ui`.

---

## 5. API-РєРѕРЅС‚СЂР°РєС‚С‹ РЅР° СЌРєСЂР°РЅС‹ (РЅР° Р±Р°Р·Рµ С‚РµРєСѓС‰РµРіРѕ backend)

## 5.1 Auth
- `GET /api/auth/bootstrap-status/`
- `POST /api/auth/bootstrap-admin/`
- `POST /api/auth/login/`
- `POST /api/auth/telegram/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `GET /api/me/`

## 5.2 Dashboard
- `GET /api/dashboard/` РґР»СЏ РІСЃРµС… СЂРѕР»РµР№.

## 5.3 Appointments
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

## 5.4 Chat
- `GET /api/appointments/{id}/messages/?after_id=`
- `POST /api/appointments/{id}/messages/`
- `DELETE /api/messages/{message_id}/`
- `POST /api/appointments/{id}/read/`

## 5.5 Admin
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

---

## 6. РЎС‚Р°РЅРґР°СЂС‚С‹ UI-СЃРѕСЃС‚РѕСЏРЅРёР№

Р”Р»СЏ РєР°Р¶РґРѕР№ СЃРµСЂРІРµСЂРЅРѕР№ РѕРїРµСЂР°С†РёРё РѕР±СЏР·Р°С‚РµР»СЊРЅС‹ 4 СЃРѕСЃС‚РѕСЏРЅРёСЏ:
- `default`
- `loading` (СЃРєРµР»РµС‚РѕРЅ/СЃРїРёРЅРЅРµСЂ РІ РєРЅРѕРїРєРµ)
- `success` (toast + РѕРїС‚РёРјРёСЃС‚РёС‡РµСЃРєРѕРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ)
- `error` (С‡РµР»РѕРІРµС‡РµСЃРєРёР№ С‚РµРєСЃС‚ + next step)

### РњРёРєСЂРѕРєРѕРїРёСЂР°Р№С‚РёРЅРі СЃС‚Р°С‚СѓСЃРѕРІ Р·Р°СЏРІРѕРє
- `NEW`: "Р—Р°СЏРІРєР° РїСЂРёРЅСЏС‚Р°. РџРѕРґР±РёСЂР°РµРј РјР°СЃС‚РµСЂР°."
- `IN_REVIEW`: "РњР°СЃС‚РµСЂ РїСЂРѕРІРµСЂСЏРµС‚ РґРµС‚Р°Р»Рё СѓСЃС‚СЂРѕР№СЃС‚РІР°."
- `AWAITING_PAYMENT`: "РћСЃС‚Р°Р»РѕСЃСЊ РїРѕРґС‚РІРµСЂРґРёС‚СЊ РѕРїР»Р°С‚Сѓ РґР»СЏ СЃС‚Р°СЂС‚Р°."
- `PAYMENT_PROOF_UPLOADED`: "Р§РµРє РїРѕР»СѓС‡РµРЅ, РїРѕРґС‚РІРµСЂР¶РґР°РµРј РїР»Р°С‚РµР¶."
- `PAID`: "РћРїР»Р°С‚Р° РїРѕРґС‚РІРµСЂР¶РґРµРЅР°. РњРѕР¶РЅРѕ РЅР°С‡РёРЅР°С‚СЊ."
- `IN_PROGRESS`: "РРґРµС‚ СЂР°Р±РѕС‚Р°. РњС‹ РїРѕРєР°Р¶РµРј СЌС‚Р°РїС‹."
- `COMPLETED`: "Р Р°Р±РѕС‚Р° Р·Р°РІРµСЂС€РµРЅР°. РџСЂРѕРІРµСЂСЊС‚Рµ СЂРµР·СѓР»СЊС‚Р°С‚."
- `DECLINED_BY_MASTER`: "РњР°СЃС‚РµСЂ РЅРµ СЃРјРѕРі РІР·СЏС‚СЊ Р·Р°СЏРІРєСѓ. РџРѕРґР±РёСЂР°РµРј Р·Р°РјРµРЅСѓ."
- `CANCELLED`: "Р—Р°СЏРІРєР° РѕС‚РјРµРЅРµРЅР°."

---

## 7. Р”РёР·Р°Р№РЅ-СЃРёСЃС‚РµРјР° 2026

## 7.1 РўРѕРєРµРЅС‹
- `primary`: `#0B57F0`
- `accent`: `#00BFA5`
- `success`: `#1AAE6F`
- `danger`: `#E5484D`
- `warning`: `#F59E0B`
- `bg`: `#F6F8FC`
- `surface`: `#FFFFFF`
- `text`: `#0F172A`
- `text-muted`: `#475569`

## 7.2 РўРёРїРѕРіСЂР°С„РёРєР°
- РЁСЂРёС„С‚: `Manrope`.
- Р‘Р°Р·РѕРІС‹Р№ СЂР°Р·РјРµСЂ: `16px`.
- Р›РёРЅРµР№РєР°: `12/14/16/20/24/32`.
- РџР»РѕС‚РЅРѕСЃС‚СЊ: РєРѕРјРїР°РєС‚РЅР°СЏ, Р±РµР· РІРёР·СѓР°Р»СЊРЅРѕРіРѕ С€СѓРјР°.

## 7.3 Р“РµРѕРјРµС‚СЂРёСЏ
- РРЅРїСѓС‚С‹: СЂР°РґРёСѓСЃ `10`.
- РљР°СЂС‚РѕС‡РєРё: СЂР°РґРёСѓСЃ `14`.
- РњРѕРґР°Р»РєРё: СЂР°РґРёСѓСЃ `18`.
- РћС‚СЃС‚СѓРїС‹ РїРѕ С€РєР°Р»Рµ `4/8/12/16/24/32`.

## 7.4 РђРЅРёРјР°С†РёРё
- Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ `200-300ms`.
- РЎРєРµР»РµС‚РѕРЅС‹ РґР»СЏ С‚Р°Р±Р»РёС†/РєР°СЂС‚РѕС‡РµРє/С‡Р°С‚Р°.
- Hover: Р»РµРіРєРёР№ РїРѕРґСЉРµРј РєР°СЂС‚РѕС‡РєРё + РєРѕРЅС‚СѓСЂ Р°РєС†РµРЅС‚Р°.

---

## 8. РџРµСЂРµСЂР°Р±РѕС‚РєР° С‡Р°С‚Р° (РґРµС‚Р°Р»СЊРЅРѕ)

### Р’РёР·СѓР°Р»СЊРЅС‹Р№ РєР°СЂРєР°СЃ
- Р›РµРЅС‚Р° СЃРѕРѕР±С‰РµРЅРёР№ РІ РєР°СЂС‚РѕС‡РєРµ СЃ С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹Рј composer РІРЅРёР·Сѓ.
- РџСѓР·С‹СЂСЊРєРё: РєР»РёРµРЅС‚ СЃРїСЂР°РІР°, РјР°СЃС‚РµСЂ СЃР»РµРІР°.
- РЎРёСЃС‚РµРјРЅС‹Рµ СЃРѕР±С‹С‚РёСЏ: С†РµРЅС‚СЂРёСЂРѕРІР°РЅРЅС‹Рµ РїР»Р°С€РєРё СЌС‚Р°РїРѕРІ.

### РћР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїР°С‚С‚РµСЂРЅС‹
- РћРїС‚РёРјРёСЃС‚РёС‡РЅР°СЏ РѕС‚РїСЂР°РІРєР° С‚РµРєСЃС‚Р°.
- РРЅРґРёРєР°С‚РѕСЂ Р·Р°РіСЂСѓР·РєРё РІР»РѕР¶РµРЅРёСЏ (progress bar).
- РЎС‚Р°С‚СѓСЃ РґРѕСЃС‚Р°РІРєРё/РїСЂРѕС‡С‚РµРЅРёСЏ.
- РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ СЃРѕРѕР±С‰РµРЅРёСЏ: "РЈРґР°Р»РёС‚СЊ" РґР»СЏ РґРѕСЃС‚СѓРїРЅС‹С… СЂРѕР»РµР№.

### Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ
- Р—Р°РєСЂРµРїР»РµРЅРЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ (Р»РѕРєР°Р»СЊРЅРѕ РЅР° РєР»РёРµРЅС‚Рµ v1).
- Р Р°Р·РґРµР»РёС‚РµР»Рё СЌС‚Р°РїРѕРІ "РћРїР»Р°С‚Р°", "РџРѕРґРєР»СЋС‡РµРЅРёРµ", "Р—Р°РІРµСЂС€РµРЅРёРµ".

---

## 9. Mobile-first СЃРїРµС†РёС„РёРєР°С†РёСЏ

- РќРёР¶РЅСЏСЏ РЅР°РІРёРіР°С†РёСЏ РґР»СЏ `client` Рё `master`.
- FAB РґР»СЏ РіР»Р°РІРЅРѕРіРѕ РґРµР№СЃС‚РІРёСЏ:
  - РєР»РёРµРЅС‚: "РќРѕРІР°СЏ Р·Р°СЏРІРєР°";
  - РјР°СЃС‚РµСЂ: "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё".
- РљСЂРёС‚РёС‡РµСЃРєРёРµ CTA РІ Р·РѕРЅРµ Р±РѕР»СЊС€РѕРіРѕ РїР°Р»СЊС†Р° (РЅРёР¶РЅСЏСЏ С‚СЂРµС‚СЊ).
- Р”РµС‚Р°Р»Рё Р·Р°СЏРІРєРё: РІРµСЂС‚РёРєР°Р»СЊРЅС‹Рµ РєР°СЂС‚РѕС‡РєРё, Р±РµР· С‚Р°Р±Р»РёС†.
- Р§Р°С‚: РїРѕР»РЅРѕСЌРєСЂР°РЅРЅС‹Р№, composer РІСЃРµРіРґР° РґРѕСЃС‚СѓРїРµРЅ.

---

## 10. РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ Рё РѕС‰СѓС‰РµРЅРёРµ СЃРєРѕСЂРѕСЃС‚Рё

### Optimistic UI
- РћС‚РїСЂР°РІРєР°/СѓРґР°Р»РµРЅРёРµ СЃРѕРѕР±С‰РµРЅРёР№.
- РћР±РЅРѕРІР»РµРЅРёРµ read-state.
- Р”РµР№СЃС‚РІРёСЏ РјР°СЃС‚РµСЂР° `take/start/complete`.
- Р”РµР№СЃС‚РІРёСЏ РєР»РёРµРЅС‚Р° `mark-paid`.

### РўРµС…РЅРёРєРё
- РњРµРјРѕРёР·Р°С†РёСЏ С‚СЏР¶РµР»С‹С… СЃРїРёСЃРєРѕРІ РєР°СЂС‚РѕС‡РµРє.
- Р”РµР±Р°СѓРЅСЃ С„РёР»СЊС‚СЂРѕРІ Р°РґРјРёРЅ-С‚Р°Р±Р»РёС†.
- РРЅРєСЂРµРјРµРЅС‚Р°Р»СЊРЅР°СЏ РїРѕРґРіСЂСѓР·РєР° СЃРѕРѕР±С‰РµРЅРёР№ РїРѕ `after_id`.
- РР·Р±РµРіР°С‚СЊ РіР»РѕР±Р°Р»СЊРЅС‹С… СЂРµСЂРµРЅРґРµСЂРѕРІ РІ `AuthContext` (СЃРµР»РµРєС‚РѕСЂС‹/СЂР°Р·РґРµР»РµРЅРёРµ РєРѕРЅС‚РµРєСЃС‚Р°).

---

## 11. РљРѕРЅРєСЂРµС‚РЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ РІ С‚РµРєСѓС‰РµРј РєРѕРґРµ

## 11.1 РћР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ (P0)
- РќРѕСЂРјР°Р»РёР·РѕРІР°С‚СЊ UI-РєРѕРїРёСЂР°Р№С‚РёРЅРі СЃС‚Р°С‚СѓСЃРѕРІ РІ РѕРґРЅРѕРј СЃР»РѕРІР°СЂРµ.
- Р’РЅРµРґСЂРёС‚СЊ `AppointmentStageTimeline` РЅР°:
  - `ClientHomePage`
  - `AppointmentDetailPage`
  - `MasterActivePage`
- РџРµСЂРµСЃРѕР±СЂР°С‚СЊ РєР»РёРµРЅС‚СЃРєСѓСЋ РіР»Р°РІРЅСѓСЋ РїРѕРґ "1 РіР»Р°РІРЅС‹Р№ CTA".
- Р РµРґРёР·Р°Р№РЅ `ChatPanel` СЃ СЃРёСЃС‚РµРјРЅС‹РјРё СЃРѕР±С‹С‚РёСЏРјРё Рё С‡РµС‚РєРѕР№ РёРµСЂР°СЂС…РёРµР№.
- Р”РѕР±Р°РІРёС‚СЊ РіР»РѕР±Р°Р»СЊРЅС‹Рµ skeleton-РєРѕРјРїРѕРЅРµРЅС‚С‹ Р·Р°РіСЂСѓР·РєРё.

## 11.2 Р’С‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚ (P1)
- Bottom navigation РґР»СЏ mobile.
- Р‘С‹СЃС‚СЂС‹Рµ С„РёР»СЊС‚СЂС‹ Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё РЅР° РјР°СЃС‚РµСЂ/Р°РґРјРёРЅ СЃС‚СЂР°РЅРёС†Р°С….
- Р‘Р»РѕРє РґРѕРІРµСЂРёСЏ РІ РґРµС‚Р°Р»СЏС… Р·Р°СЏРІРєРё: РіР°СЂР°РЅС‚РёРё, СЌС‚Р°РїС‹, РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ.
- Р­РєСЂР°РЅ С„РёРЅР°Р»РёР·Р°С†РёРё Рё РѕС†РµРЅРєРё РїРѕСЃР»Рµ `COMPLETED`.

## 11.3 РЎСЂРµРґРЅРёР№ РїСЂРёРѕСЂРёС‚РµС‚ (P2)
- РўРµРјРЅР°СЏ С‚РµРјР°.
- Р Р°СЃС€РёСЂРµРЅРЅС‹Р№ trust-Р±Р»РѕРє (РёСЃС‚РѕСЂРёСЏ РјР°СЃС‚РµСЂР°, СЃРѕС†РёР°Р»СЊРЅРѕРµ РґРѕРєР°Р·Р°С‚РµР»СЊСЃС‚РІРѕ).
- РЈР»СѓС‡С€РµРЅРЅС‹Рµ motion-РїРµСЂРµС…РѕРґС‹ РјРµР¶РґСѓ СЌС‚Р°РїР°РјРё.

---

## 12. РџР»Р°РЅ РІРЅРµРґСЂРµРЅРёСЏ РЅР° 3 СЃРїСЂРёРЅС‚Р°

## Sprint 1 (2 РЅРµРґРµР»Рё): Foundation + Client Critical Path
Р¦РµР»СЊ: РЅРѕРІС‹Р№ UX РєР»РёРµРЅС‚Р° РѕС‚ РІС…РѕРґР° РґРѕ РѕРїР»Р°С‚С‹.

Р—Р°РґР°С‡Рё:
- РўРѕРєРµРЅС‹ Рё С‚РµРјР° (Р±РµР· РјР°СЃСЃРѕРІРѕРіРѕ СЂРµС„Р°РєС‚РѕСЂРёРЅРіР° РІСЃРµС… СЃС‚СЂР°РЅРёС†).
- РњРёРєСЂРѕРєРѕРїРёСЂР°Р№С‚РёРЅРі СЃС‚Р°С‚СѓСЃРѕРІ Рё СЃРѕР±С‹С‚РёР№.
- РќРѕРІС‹Р№ `ClientHomePage`.
- РќРѕРІС‹Р№ Р±Р»РѕРє РѕРїР»Р°С‚С‹ РІ `AppointmentDetailPage`.
- РЎРєРµР»РµС‚РѕРЅС‹ + Toast-РїР°С‚С‚РµСЂРЅ.
- РўРµР»РµРјРµС‚СЂРёСЏ: РІСЂРµРјСЏ РґРѕ РїРµСЂРІРѕРіРѕ РїРѕРЅСЏС‚РЅРѕРіРѕ РґРµР№СЃС‚РІРёСЏ (TTFA).

DoD:
- РљР»РёРµРЅС‚ РјРѕР¶РµС‚ РїСЂРѕР№С‚Рё РїСѓС‚СЊ "РІС…РѕРґ -> Р·Р°СЏРІРєР° -> РѕРїР»Р°С‚Р°" Р±РµР· С‚СѓРїРёРєРѕРІ.
- РќР° РєР°Р¶РґРѕРј СЌРєСЂР°РЅРµ РѕРґРёРЅ РіР»Р°РІРЅС‹Р№ CTA.

## Sprint 2 (2 РЅРµРґРµР»Рё): Chat + Master UX
Р¦РµР»СЊ: СЃРёР»СЊРЅС‹Р№ realtime-РѕРїС‹С‚ Рё СЃРєРѕСЂРѕСЃС‚СЊ СЂР°Р±РѕС‚С‹ РјР°СЃС‚РµСЂР°.

Р—Р°РґР°С‡Рё:
- Р РµРґРёР·Р°Р№РЅ `ChatPanel` + СЃРёСЃС‚РµРјРЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ.
- Optimistic updates РґР»СЏ С‡Р°С‚Р° Рё РґРµР№СЃС‚РІРёР№ РјР°СЃС‚РµСЂР°.
- РќРѕРІС‹Р№ `MasterNewPage` Рё `MasterActivePage`.
- Р›РѕРєР°Р»СЊРЅС‹Рµ С„РёР»СЊС‚СЂС‹ Рё СЃРѕСЂС‚РёСЂРѕРІРєРё Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё.

DoD:
- Р’СЂРµРјСЏ РїСЂРёРЅСЏС‚РёСЏ Р·Р°СЏРІРєРё РјР°СЃС‚РµСЂРѕРј СЃРѕРєСЂР°С‰РµРЅРѕ.
- Р§Р°С‚ С‡РёС‚Р°РµС‚СЃСЏ РєР°Рє РѕСЃРЅРѕРІРЅР°СЏ СЂР°Р±РѕС‡Р°СЏ РєРѕРЅСЃРѕР»СЊ.

## Sprint 3 (2 РЅРµРґРµР»Рё): Admin Ops + Mobile Polish + Trust
Р¦РµР»СЊ: РѕРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РєРѕРЅС‚СЂРѕР»СЊ Рё С„РёРЅР°Р»СЊРЅР°СЏ РїРѕР»РёСЂРѕРІРєР°.

Р—Р°РґР°С‡Рё:
- РќРѕРІС‹Р№ `AdminSystemPage` СЃ СЃРёРіРЅР°Р»СЊРЅРѕР№ РјРѕРґРµР»СЊСЋ.
- РЈРЅРёС„РёРєР°С†РёСЏ `AdminUsersPage`, `AdminAppointmentsPage`.
- Bottom nav + FAB РґР»СЏ mobile.
- Trust-Р±Р»РѕРєРё, FAQ, РіР°СЂР°РЅС‚РёР№РЅС‹Рµ СЃС†РµРЅР°СЂРёРё.
- Accessibility-pass (РєРѕРЅС‚СЂР°СЃС‚, С„РѕРєСѓСЃ, РєР»Р°РІРёР°С‚СѓСЂР°).

DoD:
- РђРґРјРёРЅ Р·Р° <30 СЃРµРєСѓРЅРґ РІРёРґРёС‚ РѕРїРµСЂР°С†РёРѕРЅРЅС‹Рµ СЂРёСЃРєРё.
- Mobile UX РїСЂРѕС…РѕРґРёС‚ СЃС†РµРЅР°СЂРёР№ Р±РµР· РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕРіРѕ СЃРєСЂРѕР»Р»Р° Рё С„СЂСѓСЃС‚СЂР°С†РёРё.

---

## 13. РўРµС…РЅРёС‡РµСЃРєРёР№ backlog (РїРѕ С„Р°Р№Р»Р°Рј)

Frontend:
- `frontend/src/theme.js`
- `frontend/src/constants/labels.js`
- `frontend/src/components/ChatPanel.jsx`
- `frontend/src/components/AppointmentCard.jsx`
- `frontend/src/pages/client/ClientHomePage.jsx`
- `frontend/src/pages/AppointmentDetailPage.jsx`
- `frontend/src/pages/master/MasterNewPage.jsx`
- `frontend/src/pages/master/MasterActivePage.jsx`
- `frontend/src/pages/admin/AdminSystemPage.jsx`
- `frontend/src/layouts/MainLayout.jsx`

New files:
- `frontend/src/components/AppointmentStageTimeline.jsx`
- `frontend/src/components/StatusHero.jsx`
- `frontend/src/components/AppBottomNav.jsx`
- `frontend/src/components/AppFab.jsx`
- `frontend/src/components/skeletons/*.jsx`

Backend (РјРёРЅРёРјР°Р»СЊРЅРѕ, С‚РѕР»СЊРєРѕ РµСЃР»Рё РЅСѓР¶РЅРѕ РґР»СЏ UX):
- Р‘РµР· РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РёР·РјРµРЅРµРЅРёР№ Р±РёР·РЅРµСЃ-Р»РѕРіРёРєРё.
- РћРїС†РёРѕРЅР°Р»СЊРЅРѕ: endpoint typing indicator Рё pinned messages РІ РѕС‚РґРµР»СЊРЅРѕР№ С„Р°Р·Рµ.

---

## 14. KPI Рё РїСЂРѕРґСѓРєС‚РѕРІС‹Рµ РјРµС‚СЂРёРєРё СЂРµРґРёР·Р°Р№РЅР°

- РЎРЅРёР¶РµРЅРёРµ РІСЂРµРјРµРЅРё РґРѕ РїРµСЂРІРѕРіРѕ РѕСЃРјС‹СЃР»РµРЅРЅРѕРіРѕ РґРµР№СЃС‚РІРёСЏ РїРѕСЃР»Рµ РІС…РѕРґР°.
- РЎРЅРёР¶РµРЅРёРµ Р±СЂРѕС€РµРЅРЅС‹С… Р·Р°СЏРІРѕРє РЅР° СЌС‚Р°РїРµ РѕРїР»Р°С‚С‹.
- Р РѕСЃС‚ РґРѕР»Рё Р·Р°СЏРІРѕРє, Р·Р°РІРµСЂС€РµРЅРЅС‹С… Р±РµР· СЌСЃРєР°Р»Р°С†РёРё.
- Р РѕСЃС‚ CSAT/NPS РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ.
- РЎРЅРёР¶РµРЅРёРµ РґРѕР»Рё "РіРґРµ РјРѕР№ РјР°СЃС‚РµСЂ?" РѕР±СЂР°С‰РµРЅРёР№ РІ С‡Р°С‚.

---

## 15. Р РёСЃРєРё Рё РєРѕРЅС‚СЂРѕР»СЊ

- Р РёСЃРє "РІРёР·СѓР°Р» СЃРґРµР»Р°Р»Рё, UX РЅРµ СѓСЃРєРѕСЂРёР»СЃСЏ":
  - РљРѕРЅС‚СЂРѕР»СЊ С‡РµСЂРµР· РјРµС‚СЂРёРєРё Рё СЃС†РµРЅР°СЂРЅС‹Рµ С‚РµСЃС‚С‹.
- Р РёСЃРє СЂРµРіСЂРµСЃСЃРёР№ РІ СЂРѕР»СЏС…:
  - E2E smoke РїРѕ 3 СЂРѕР»СЏРј РЅР° РєР°Р¶РґСѓСЋ РїРѕСЃС‚Р°РІРєСѓ.
- Р РёСЃРє РїРµСЂРµРіСЂСѓР·РєРё РёРЅС‚РµСЂС„РµР№СЃР°:
  - Р–РµСЃС‚РєРѕРµ РїСЂР°РІРёР»Рѕ РѕРґРЅРѕРіРѕ РіР»Р°РІРЅРѕРіРѕ CTA.

---

## 16. Р РµС€РµРЅРёРµ Рѕ Р·Р°РїСѓСЃРєРµ (Go/No-Go)

Go, РµСЃР»Рё:
- `P0` Р·Р°РІРµСЂС€РµРЅ Рё Р·Р°РєСЂС‹С‚С‹ РєСЂРёС‚РёС‡РµСЃРєРёРµ СЃС†РµРЅР°СЂРёРё РєР»РёРµРЅС‚Р°.
- РќРµС‚ blocker-Р±Р°РіРѕРІ РІ РѕРїР»Р°С‚Рµ/С‡Р°С‚Рµ/СЃС‚Р°С‚СѓСЃР°С….
- Mobile-РїСѓС‚СЊ РєР»РёРµРЅС‚Р° РѕС‚ РІС…РѕРґР° РґРѕ С‡Р°С‚Р° СЃС‚Р°Р±РёР»РµРЅ.

No-Go, РµСЃР»Рё:
- РќРµС‚ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚Рё СЃС‚Р°С‚СѓСЃРѕРІ.
- РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РїРѕРЅРёРјР°РµС‚ СЃР»РµРґСѓСЋС‰РёР№ С€Р°Рі.
- Р§Р°С‚ РЅРµ РґР°РµС‚ РѕС‰СѓС‰РµРЅРёРµ РєРѕРЅС‚СЂРѕР»СЏ.

---

## 17. Progress Log

### 2026-03-01 (Phase 10, Step 1)
- Added a new design system layer in `frontend/src/theme/`:
  - `tokens.js` (spacing, radius, typography scale, shadows, brand colors).
  - `status.js` (status color mapping for all appointment states + SLA breach state).
  - `index.js` (MUI theme with component overrides and consistent visual rules).
- Kept app compatibility by using `frontend/src/theme/` as the canonical theme import path.
- Validated by production build:
  - `cd frontend && npm run build` (passed).
### 2026-03-01 (Phase 10, Step 2)
- Added shared UI components:
  - `frontend/src/components/ui/StatusStepper.jsx`
  - `frontend/src/components/ui/PrimaryCTA.jsx`
  - `frontend/src/components/ui/AppointmentCard.jsx`
- Updated list pages (`client` + `master`) to use the new appointment card presentation with compact status progress.
- Unified status labels with theme status mapping in `frontend/src/constants/labels.js`.
### 2026-03-01 (Phase 10, Step 3)
- Refactored `AppointmentDetailPage` into a central control screen:
  - top status progress (`StatusStepper`)
  - single main action (`PrimaryCTA`)
  - action panels for role-specific operations
  - trust sidebar with SLA and guidance
- Upgraded chat UX:
  - optimistic send
  - inline system events in chat stream
  - shared renderer `frontend/src/components/ui/ChatThread.jsx`
### 2026-03-01 (Phase 10, Step 5)
- Added global notifications UX:
  - `NotificationBell` in app shell (`MainLayout`)
  - `NotificationsDrawer` with list, mark read, mark all read
- Connected frontend API methods for notifications:
  - `/api/notifications/`
  - `/api/notifications/unread-count/`
  - `/api/notifications/mark-read/`
### 2026-03-01 (Phase 10, Step 6)
- Admin metrics UX added on `AdminSystemPage`:
  - daily KPI tiles from `/api/v1/admin/metrics/daily`
  - simple trend bars without extra heavy chart libraries
  - critical unread notifications block on top
- Added admin rules UI (`/admin/rules`) with safe form builder:
  - trigger event select
  - condition builder (field/op/value)
  - guarded action builder (notification / status change / tag / admin attention)
  - active toggle + delete for existing rules
### 2026-03-01 (Phase 10, Step 7)
- Added skeleton loaders to reduce perceived wait and layout shifts:
  - `AppointmentCardSkeleton`
  - `AppointmentDetailSkeleton`
- Integrated skeleton states into:
  - ClientHome
  - MyAppointments
  - MasterNew
  - MasterActive
  - AppointmentDetail
- Continued copy polish in main journey blocks with “Что делать дальше” and reassurance microcopy.
### 2026-03-01 (Phase 10, Step 8)
- Mobile-first shell improvements:
  - added bottom navigation (`AppBottomNav`) for client/master/admin on small screens
  - added floating primary action button (`AppFab`) for client/master
- Master active queue now sorted by urgency:
  - SLA breach first
  - nearest deadline next
  - unread chat count as priority signal
### 2026-03-01 (Phase 10, Step 9)
- Optimized initial frontend loading by switching route pages in `frontend/src/App.jsx` to lazy loading (`React.lazy + Suspense`).
- Added a shared route fallback state (`Загружаем экран...`) to keep perceived performance stable while chunks are loading.
- Kept all existing routes and protected-role flows unchanged.
### 2026-03-01 (Phase 10, Step 10)
- Added manual vendor chunk strategy in `frontend/vite.config.js`:
  - `vendor-core`, `vendor-axios`, `vendor-dayjs`.
- Goal: reduce startup pressure on the main app chunk and improve initial route responsiveness in production.
- Set `chunkSizeWarningLimit` to `700` to align warning threshold with the new vendor split profile.
### 2026-03-01 (Phase 10, Step 11)
- Improved live updates on appointment details:
  - backend `/api/appointments/{id}/events/` now supports optional `after_id` for incremental polling (backward compatible).
  - frontend appointment details now poll events incrementally every 3.5 seconds and merge them without full list reload.
- Added API test coverage for `after_id` behavior and validation.
