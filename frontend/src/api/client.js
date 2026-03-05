import axios from "axios";
import { clearTokens, getAccessToken, setAccessToken } from "./authStorage";
import { normalizeRuText } from "../utils/text";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const BANNED_EVENT_NAME = "frp:user-banned";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

function normalizeRuPayload(value) {
  if (typeof value === "string") {
    return normalizeRuText(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeRuPayload);
  }
  if (value && typeof value === "object") {
    const normalized = {};
    Object.entries(value).forEach(([key, innerValue]) => {
      normalized[key] = normalizeRuPayload(innerValue);
    });
    return normalized;
  }
  return value;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if ((config.method || "get").toLowerCase() === "get") {
    config.params = { ...(config.params || {}), _t: Date.now() };
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeToRefresh(callback) {
  refreshSubscribers.push(callback);
}

function notifyRefresh(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

async function refreshAccessToken() {
  const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {}, { withCredentials: true });
  const newAccess = response.data.access;
  if (!newAccess) {
    throw new Error("Refresh endpoint did not return access token");
  }
  setAccessToken(newAccess);
  return newAccess;
}

api.interceptors.response.use(
  (response) => {
    if (response?.data !== undefined) {
      response.data = normalizeRuPayload(response.data);
    }
    return response;
  },
  async (error) => {
    if (error?.response?.data !== undefined) {
      error.response.data = normalizeRuPayload(error.response.data);
    }
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const detailMessage = error?.response?.data?.detail;
    if (error?.response?.status === 403 && typeof detailMessage === "string") {
      const normalized = detailMessage.toLowerCase();
      if (normalized.includes("заблокирован") || normalized.includes("забанен")) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(BANNED_EVENT_NAME, { detail: { message: detailMessage } }));
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

    if (!error.response || error.response.status !== 401 || originalRequest._retry || bypassRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeToRefresh((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const token = await refreshAccessToken();
      isRefreshing = false;
      notifyRefresh(token);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      clearTokens();
      return Promise.reject(refreshError);
    }
  }
);

export const authApi = {
  async bootstrapStatus() {
    const response = await api.get("/auth/bootstrap-status/");
    return response.data;
  },
  async bootstrapAdmin(payload) {
    const response = await api.post("/auth/bootstrap-admin/", payload);
    return response.data;
  },
  async passwordLogin(payload) {
    const response = await api.post("/auth/login/", payload);
    return response.data;
  },
  async register(payload) {
    const response = await api.post("/auth/register/", payload);
    return response.data;
  },
  async resendVerification(payload) {
    const response = await api.post("/auth/register/resend-verification/", payload);
    return response.data;
  },
  async telegramAuth(payload) {
    const response = await api.post("/auth/telegram/", payload);
    return response.data;
  },
  async oauthStart(provider) {
    const response = await api.get(`/auth/oauth/${provider}/start/`);
    return response.data;
  },
  async logout() {
    const response = await api.post("/auth/logout/");
    return response.data;
  },
  async getMe() {
    const response = await api.get("/me/");
    return response.data;
  },
  async updateProfile(payload) {
    const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
    const response = await api.patch(
      "/me/profile/",
      payload,
      isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
    );
    return response.data;
  },
  async wholesaleStatus() {
    const response = await api.get("/wholesale/status/");
    return response.data;
  },
  async requestWholesale(payload) {
    const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
    const response = await api.post(
      "/wholesale/request/",
      payload,
      isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
    );
    return response.data;
  },
  async dashboardSummary() {
    const response = await api.get("/dashboard/");
    return response.data;
  },
  async clientProfile(userId) {
    const response = await api.get(`/clients/${userId}/profile/`);
    return response.data;
  },
};

export const appointmentsApi = {
  create(payload) {
    return api.post("/appointments/", payload, { headers: { "Content-Type": "multipart/form-data" } });
  },
  my() {
    return api.get("/appointments/my/");
  },
  detail(id) {
    return api.get(`/appointments/${id}/`);
  },
  updateClientAccess(id, payload) {
    return api.post(`/appointments/${id}/client-access/`, payload);
  },
  repeat(id) {
    return api.post(`/appointments/${id}/repeat/`);
  },
  events(id, params = {}) {
    return api.get(`/appointments/${id}/events/`, { params });
  },
  clientSignal(id, payload) {
    return api.post(`/appointments/${id}/client-signal/`, payload);
  },
  newList() {
    return api.get("/appointments/new/");
  },
  activeList() {
    return api.get("/appointments/active/");
  },
  bulkAction(payload) {
    return api.post("/appointments/bulk-action/", payload);
  },
  take(id) {
    return api.post(`/appointments/${id}/take/`);
  },
  decline(id) {
    return api.post(`/appointments/${id}/decline/`);
  },
  setPrice(id, total_price) {
    return api.post(`/appointments/${id}/set-price/`, { total_price });
  },
  uploadPaymentProof(id, formData, options = {}) {
    return api.post(`/appointments/${id}/upload-payment-proof/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: options.onUploadProgress,
      signal: options.signal,
    });
  },
  markPaid(id, payment_method, payment_requisites_note) {
    return api.post(`/appointments/${id}/mark-paid/`, { payment_method, payment_requisites_note });
  },
  confirmPayment(id) {
    return api.post(`/appointments/${id}/confirm-payment/`);
  },
  start(id) {
    return api.post(`/appointments/${id}/start/`);
  },
  complete(id) {
    return api.post(`/appointments/${id}/complete/`);
  },
};

export const chatApi = {
  listMessages(appointmentId, afterId = 0) {
    return api.get(`/appointments/${appointmentId}/messages/`, { params: { after_id: afterId } });
  },
  sendMessage(appointmentId, formData) {
    return api.post(`/appointments/${appointmentId}/messages/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteMessage(messageId) {
    return api.delete(`/messages/${messageId}/`);
  },
  read(appointmentId, last_read_message_id) {
    return api.post(`/appointments/${appointmentId}/read/`, { last_read_message_id });
  },
  listQuickReplies() {
    return api.get("/chat/quick-replies/");
  },
  createQuickReply(payload) {
    const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
    return api.post("/chat/quick-replies/", payload, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined);
  },
  updateQuickReply(replyId, payload) {
    const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
    return api.patch(
      `/chat/quick-replies/${replyId}/`,
      payload,
      isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
    );
  },
  deleteQuickReply(replyId) {
    return api.delete(`/chat/quick-replies/${replyId}/`);
  },
};

export const reviewsApi = {
  my(params = {}) {
    return api.get("/reviews/my/", { params });
  },
  reviewMaster(id, payload) {
    return api.post(`/appointments/${id}/review-master/`, payload);
  },
  reviewClient(id, payload) {
    return api.post(`/appointments/${id}/review-client/`, payload);
  },
};

export const adminApi = {
  appointments(params = {}) {
    return api.get("/admin/appointments/", { params });
  },
  confirmPayment(id) {
    return api.post(`/admin/appointments/${id}/confirm-payment/`);
  },
  deleteAppointment(id) {
    return api.delete(`/admin/appointments/${id}/`);
  },
  setStatus(id, payload) {
    return api.post(`/admin/appointments/${id}/set-status/`, payload);
  },
  clients() {
    return api.get("/admin/users/");
  },
  wholesaleRequests(params = {}) {
    return api.get("/admin/wholesale-requests/", { params });
  },
  reviewWholesale(userId, payload) {
    return api.post(`/admin/wholesale-requests/${userId}/review/`, payload);
  },
  financeSummary(params = {}) {
    return api.get("/admin/finance/summary/", { params });
  },
  paymentRegistry(params = {}) {
    return api.get("/admin/payments/registry/", { params });
  },
  paymentRegistryExport(params = {}) {
    return api.get("/admin/payments/registry/export/", { params, responseType: "blob" });
  },
  weeklyReport(params = {}) {
    return api.get("/admin/reports/weekly/", { params });
  },
  updateWholesalePriority(userId, payload) {
    return api.post(`/admin/users/${userId}/wholesale-priority/`, payload);
  },
  sendClientEmail(payload) {
    return api.post("/admin/clients/send-email/", payload);
  },
  users(params = {}) {
    return api.get("/admin/users/all/", { params });
  },
  ban(userId, reason) {
    return api.post(`/admin/users/${userId}/ban/`, { reason });
  },
  unban(userId) {
    return api.post(`/admin/users/${userId}/unban/`);
  },
  updateUserRole(userId, payload) {
    return api.post(`/admin/users/${userId}/role/`, payload);
  },
  masters(params = {}) {
    return api.get("/admin/masters/", { params });
  },
  activateMaster(userId) {
    return api.post(`/admin/masters/${userId}/activate/`);
  },
  suspendMaster(userId) {
    return api.post(`/admin/masters/${userId}/suspend/`);
  },
  updateMasterQuality(userId, payload) {
    return api.post(`/admin/masters/${userId}/quality/`, payload);
  },
  systemStatus() {
    return api.get("/admin/system/status/");
  },
  systemSettings() {
    return api.get("/admin/system/settings/");
  },
  updateSystemSettings(payload) {
    return api.put("/admin/system/settings/", payload);
  },
  runSystemAction(action) {
    return api.post("/admin/system/run-action/", { action });
  },
  dailyMetrics(params = {}) {
    return api.get("/v1/admin/metrics/daily/", { params });
  },
  rules() {
    return api.get("/v1/admin/rules/");
  },
  reviews(params = {}) {
    return api.get("/admin/reviews/", { params });
  },
  createRule(payload) {
    return api.post("/v1/admin/rules/", payload);
  },
  updateRule(ruleId, payload) {
    return api.patch(`/v1/admin/rules/${ruleId}/`, payload);
  },
  deleteRule(ruleId) {
    return api.delete(`/v1/admin/rules/${ruleId}/`);
  },
};

export const notificationsApi = {
  list(params = {}) {
    return api.get("/notifications/", { params });
  },
  unreadCount() {
    return api.get("/notifications/unread-count/");
  },
  markRead(notificationIds = []) {
    return api.post("/notifications/mark-read/", { notification_ids: notificationIds });
  },
  markAllRead() {
    return api.post("/notifications/mark-read/", { mark_all: true });
  },
};
