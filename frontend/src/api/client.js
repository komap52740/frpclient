import { authApi, BANNED_EVENT_NAME } from "../features/auth/api/authApi";
import { api, withBypassCache } from "../shared/api/httpClient";

export { authApi, BANNED_EVENT_NAME };

export const appointmentsApi = {
  create(payload) {
    return api.post("/appointments/", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  my() {
    return api.get("/appointments/my/", withBypassCache());
  },
  detail(id) {
    return api.get(`/appointments/${id}/`, withBypassCache());
  },
  updateClientAccess(id, payload) {
    return api.post(`/appointments/${id}/client-access/`, payload);
  },
  repeat(id) {
    return api.post(`/appointments/${id}/repeat/`);
  },
  events(id, params = {}) {
    return api.get(`/appointments/${id}/events/`, withBypassCache({ params }));
  },
  clientSignal(id, payload) {
    return api.post(`/appointments/${id}/client-signal/`, payload);
  },
  newList() {
    return api.get("/appointments/new/", withBypassCache());
  },
  activeList() {
    return api.get("/appointments/active/", withBypassCache());
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
    return api.get(
      `/appointments/${appointmentId}/messages/`,
      withBypassCache({ params: { after_id: afterId } })
    );
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
    return api.get("/chat/quick-replies/", withBypassCache());
  },
  createQuickReply(payload) {
    const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
    return api.post(
      "/chat/quick-replies/",
      payload,
      isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
    );
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
  rulesSchema() {
    return api.get("/v1/admin/rules/schema/");
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

export const wholesalePortalApi = {
  summary() {
    return api.get("/wholesale/portal/summary/", withBypassCache());
  },
  orders(params = {}) {
    return api.get("/wholesale/portal/orders/", withBypassCache({ params }));
  },
  profile() {
    return api.get("/wholesale/portal/profile/", withBypassCache());
  },
};

export const notificationsApi = {
  list(params = {}) {
    return api.get("/notifications/", withBypassCache({ params }));
  },
  unreadCount() {
    return api.get("/notifications/unread-count/", withBypassCache());
  },
  markRead(notificationIds = []) {
    return api.post("/notifications/mark-read/", { notification_ids: notificationIds });
  },
  markAllRead() {
    return api.post("/notifications/mark-read/", { mark_all: true });
  },
};
