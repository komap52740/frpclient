import axios from "axios";
import { clearTokens, getAccessToken, setAccessToken } from "./authStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
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
  async telegramAuth(payload) {
    const response = await api.post("/auth/telegram/", payload);
    return response.data;
  },
  async getMe() {
    const response = await api.get("/me/");
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
  newList() {
    return api.get("/appointments/new/");
  },
  activeList() {
    return api.get("/appointments/active/");
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
  uploadPaymentProof(id, formData) {
    return api.post(`/appointments/${id}/upload-payment-proof/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  markPaid(id, payment_method) {
    return api.post(`/appointments/${id}/mark-paid/`, { payment_method });
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
};

export const reviewsApi = {
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
  setStatus(id, payload) {
    return api.post(`/admin/appointments/${id}/set-status/`, payload);
  },
  clients() {
    return api.get("/admin/users/");
  },
  ban(userId, reason) {
    return api.post(`/admin/users/${userId}/ban/`, { reason });
  },
  unban(userId) {
    return api.post(`/admin/users/${userId}/unban/`);
  },
  masters() {
    return api.get("/admin/masters/");
  },
  activateMaster(userId) {
    return api.post(`/admin/masters/${userId}/activate/`);
  },
  suspendMaster(userId) {
    return api.post(`/admin/masters/${userId}/suspend/`);
  },
};
