import * as Sentry from "@sentry/react";

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN || "").trim();
const SENTRY_ENVIRONMENT = (
  import.meta.env.VITE_SENTRY_ENVIRONMENT ||
  import.meta.env.MODE ||
  "development"
).trim();
const SENTRY_RELEASE = (import.meta.env.VITE_SENTRY_RELEASE || "").trim();
const SENTRY_TRACES_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0");
const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "access",
  "access_token",
  "authorization",
  "client_secret",
  "cookie",
  "password",
  "password_confirm",
  "refresh",
  "refresh_token",
  "rustdesk_password",
  "sessionid",
  "set-cookie",
  "token",
]);

let sentryEnabled = false;

function redactValue(value) {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => {
        const normalizedKey = String(key).trim().toLowerCase();
        if (SENSITIVE_KEYS.has(normalizedKey)) {
          return [key, REDACTED_VALUE];
        }
        return [key, redactValue(innerValue)];
      })
    );
  }
  return value;
}

function beforeSend(event) {
  return redactValue(event);
}

export function initFrontendObservability() {
  if (!SENTRY_DSN || sentryEnabled) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT || "production",
    release: SENTRY_RELEASE || undefined,
    tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE)
      ? Math.min(Math.max(SENTRY_TRACES_SAMPLE_RATE, 0), 1)
      : 0,
    beforeSend,
  });
  sentryEnabled = true;
}

export function captureClientError(error, context = {}) {
  if (!sentryEnabled) {
    return;
  }
  Sentry.withScope((scope) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          scope.setTag(key, String(value));
        }
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, redactValue(value));
      });
    }
    Sentry.captureException(error);
  });
}

export function captureApiError(error, context = {}) {
  const status = Number(error?.response?.status || 0);
  if (status > 0 && status < 500) {
    return;
  }
  captureClientError(error, context);
}
