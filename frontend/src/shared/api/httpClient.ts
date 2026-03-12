import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import { normalizeRuText } from "../../utils/text";
import { tokenStore } from "../auth/tokenStore";
import { createRequestId } from "../observability/requestId";
import { captureApiError } from "../observability/sentry";

type PlainRecord = Record<string, unknown>;
type RefreshSubscriber = (token: string) => void;
type RequestMetadata = {
  requestId?: string;
  cachePolicy?: "default" | "bypass";
};
type RequestConfigWithMetadata = {
  metadata?: RequestMetadata;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const BANNED_EVENT_NAME = "frp:user-banned";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

function isPlainObject(value: unknown): value is PlainRecord {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeRuPayload<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeRuText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeRuPayload(item)) as T;
  }
  if (isPlainObject(value)) {
    const normalized: PlainRecord = {};
    Object.entries(value).forEach(([key, innerValue]) => {
      normalized[key] = normalizeRuPayload(innerValue);
    });
    return normalized as T;
  }
  return value;
}

function toAxiosHeaders(config: InternalAxiosRequestConfig): AxiosHeaders {
  const headers = AxiosHeaders.from(config.headers);
  config.headers = headers;
  return headers;
}

function getHeaderValue(headers: unknown, key: string): string {
  if (!headers) {
    return "";
  }
  if (headers instanceof AxiosHeaders) {
    const value = headers.get(key);
    return typeof value === "string" ? value : "";
  }
  if (typeof headers === "object" && headers !== null) {
    const record = headers as Record<string, unknown>;
    const direct = record[key] ?? record[key.toLowerCase()];
    return typeof direct === "string" ? direct : "";
  }
  return "";
}

export function withBypassCache(): RequestConfigWithMetadata;
export function withBypassCache<TConfig extends RequestConfigWithMetadata>(
  config: TConfig
): TConfig & { metadata: RequestMetadata };
export function withBypassCache<TConfig extends RequestConfigWithMetadata>(config?: TConfig) {
  const normalizedConfig = (config ? { ...config } : {}) as TConfig & RequestConfigWithMetadata;
  normalizedConfig.metadata = {
    ...(normalizedConfig.metadata || {}),
    cachePolicy: "bypass",
  };
  return normalizedConfig;
}

export function resolveRequestCachePolicy(
  config: RequestConfigWithMetadata | undefined
): "default" | "bypass" {
  return config?.metadata?.cachePolicy === "bypass" ? "bypass" : "default";
}

let isRefreshing = false;
let refreshSubscribers: RefreshSubscriber[] = [];

function subscribeToRefresh(callback: RefreshSubscriber): void {
  refreshSubscribers.push(callback);
}

function notifyRefresh(newToken: string): void {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<{ access?: string }>(
    `${API_BASE_URL}/auth/refresh/`,
    {},
    { withCredentials: true }
  );
  const newAccess = response.data.access;
  if (!newAccess) {
    throw new Error("Refresh endpoint did not return access token");
  }
  tokenStore.set(newAccess);
  return newAccess;
}

api.interceptors.request.use((config) => {
  const headers = toAxiosHeaders(config);
  const requestId = getHeaderValue(headers, "X-Request-ID") || createRequestId();
  headers.set("X-Request-ID", requestId);
  config.metadata = { ...(config.metadata || {}), requestId };

  const token = tokenStore.get();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    (config.method || "get").toLowerCase() === "get" &&
    resolveRequestCachePolicy(config) === "bypass"
  ) {
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data !== undefined) {
      response.data = normalizeRuPayload(response.data);
    }
    return response;
  },
  async (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.data !== undefined) {
      error.response.data = normalizeRuPayload(error.response.data);
    }

    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const requestId =
      getHeaderValue(error.response?.headers, "x-request-id") ||
      getHeaderValue(originalRequest?.headers, "X-Request-ID") ||
      getHeaderValue(originalRequest?.headers, "x-request-id") ||
      originalRequest?.metadata?.requestId ||
      "";
    error.requestId = requestId;

    const detailMessage = error.response?.data?.detail;
    if (error.response?.status === 403 && typeof detailMessage === "string") {
      const normalized = detailMessage.toLowerCase();
      if (normalized.includes("р·р°р±р»рѕрєрёрѕрір°рн") || normalized.includes("р·р°р±р°рнрн")) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(BANNED_EVENT_NAME, { detail: { message: detailMessage } })
          );
        }
      }
    }

    const bypassRefresh =
      requestUrl.includes("/auth/login/") ||
      requestUrl.includes("/auth/register/") ||
      requestUrl.includes("/auth/register/resend-verification/") ||
      requestUrl.includes("/auth/telegram/") ||
      requestUrl.includes("/auth/oauth/") ||
      requestUrl.includes("/auth/logout/") ||
      requestUrl.includes("/auth/bootstrap-admin/") ||
      requestUrl.includes("/auth/bootstrap-status/") ||
      requestUrl.includes("/auth/refresh/");

    if (
      !error.response ||
      error.response.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      bypassRefresh
    ) {
      captureApiError(error, {
        tags: {
          request_id: requestId,
          http_method: originalRequest?.method || "",
          http_status: error.response?.status || "network_error",
        },
        extra: {
          url: requestUrl,
          detail: detailMessage || "",
        },
      });
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeToRefresh((token) => {
          const retryHeaders = AxiosHeaders.from(originalRequest.headers);
          retryHeaders.set("Authorization", `Bearer ${token}`);
          originalRequest.headers = retryHeaders;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const token = await refreshAccessToken();
      isRefreshing = false;
      notifyRefresh(token);
      const retryHeaders = AxiosHeaders.from(originalRequest.headers);
      retryHeaders.set("Authorization", `Bearer ${token}`);
      originalRequest.headers = retryHeaders;
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      tokenStore.clear();
      return Promise.reject(refreshError);
    }
  }
);
