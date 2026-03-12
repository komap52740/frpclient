import axios from "axios";

import {
  API_BASE_URL,
  api,
  BANNED_EVENT_NAME,
  withBypassCache,
} from "../../../shared/api/httpClient";
import {
  authSessionSchema,
  bootstrapStatusSchema,
  clientProfileSchema,
  dashboardSummarySchema,
  genericObjectResponseSchema,
  meResponseSchema,
  oauthStartSchema,
  parseApiPayload,
  passwordResetDetailSchema,
  wholesaleStatusSchema,
  type AuthSessionResponse,
  type BootstrapStatusResponse,
  type ClientProfileResponse,
  type DashboardSummaryResponse,
  type GenericObjectResponse,
  type MeResponse,
  type OAuthStartResponse,
  type PasswordResetDetailResponse,
  type WholesaleStatusResponse,
} from "../../../shared/auth/models";

type ObjectPayload = Record<string, unknown>;
type FormDataPayload = FormData | ObjectPayload;

function isFormDataPayload(payload: unknown): payload is FormData {
  return typeof FormData !== "undefined" && payload instanceof FormData;
}

export { BANNED_EVENT_NAME };

export const authApi = {
  async bootstrapStatus(): Promise<BootstrapStatusResponse> {
    const response = await api.get("/auth/bootstrap-status/", withBypassCache());
    return parseApiPayload(bootstrapStatusSchema, response.data, "bootstrapStatus");
  },
  async bootstrapAdmin(payload: ObjectPayload): Promise<AuthSessionResponse> {
    const response = await api.post("/auth/bootstrap-admin/", payload);
    return parseApiPayload(authSessionSchema, response.data, "bootstrapAdmin");
  },
  async passwordLogin(payload: ObjectPayload): Promise<AuthSessionResponse> {
    const response = await api.post("/auth/login/", payload);
    return parseApiPayload(authSessionSchema, response.data, "passwordLogin");
  },
  async register(payload: ObjectPayload): Promise<GenericObjectResponse> {
    const response = await api.post("/auth/register/", payload);
    return parseApiPayload(genericObjectResponseSchema, response.data, "register");
  },
  async passwordResetRequest(payload: ObjectPayload): Promise<PasswordResetDetailResponse> {
    const response = await api.post("/auth/password-reset/", payload);
    return parseApiPayload(passwordResetDetailSchema, response.data, "passwordResetRequest");
  },
  async passwordResetConfirm(payload: ObjectPayload): Promise<PasswordResetDetailResponse> {
    const response = await api.post("/auth/password-reset/confirm/", payload);
    return parseApiPayload(passwordResetDetailSchema, response.data, "passwordResetConfirm");
  },
  async resendVerification(payload: ObjectPayload): Promise<GenericObjectResponse> {
    const response = await api.post("/auth/register/resend-verification/", payload);
    return parseApiPayload(genericObjectResponseSchema, response.data, "resendVerification");
  },
  async telegramAuth(payload: ObjectPayload): Promise<AuthSessionResponse> {
    const response = await api.post("/auth/telegram/", payload);
    return parseApiPayload(authSessionSchema, response.data, "telegramAuth");
  },
  async oauthStart(provider: string): Promise<OAuthStartResponse> {
    const response = await api.get(`/auth/oauth/${provider}/start/`, withBypassCache());
    return parseApiPayload(oauthStartSchema, response.data, "oauthStart");
  },
  async logout(): Promise<GenericObjectResponse> {
    const response = await api.post("/auth/logout/");
    return parseApiPayload(genericObjectResponseSchema, response.data, "logout");
  },
  async refreshSession(): Promise<AuthSessionResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh/`,
      {},
      { withCredentials: true }
    );
    return parseApiPayload(authSessionSchema, response.data, "refreshSession");
  },
  async getMe(): Promise<MeResponse> {
    const response = await api.get("/me/", withBypassCache());
    return parseApiPayload(meResponseSchema, response.data, "getMe");
  },
  async updateProfile(payload: FormDataPayload): Promise<GenericObjectResponse> {
    const response = await api.patch(
      "/me/profile/",
      payload,
      isFormDataPayload(payload)
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined
    );
    return parseApiPayload(genericObjectResponseSchema, response.data, "updateProfile");
  },
  async wholesaleStatus(): Promise<WholesaleStatusResponse> {
    const response = await api.get("/wholesale/status/", withBypassCache());
    return parseApiPayload(wholesaleStatusSchema, response.data, "wholesaleStatus");
  },
  async requestWholesale(payload: FormDataPayload): Promise<GenericObjectResponse> {
    const response = await api.post(
      "/wholesale/request/",
      payload,
      isFormDataPayload(payload)
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined
    );
    return parseApiPayload(genericObjectResponseSchema, response.data, "requestWholesale");
  },
  async dashboardSummary(): Promise<DashboardSummaryResponse> {
    const response = await api.get("/dashboard/", withBypassCache());
    return parseApiPayload(dashboardSummarySchema, response.data, "dashboardSummary");
  },
  async clientProfile(userId: string | number): Promise<ClientProfileResponse> {
    const response = await api.get(`/clients/${userId}/profile/`, withBypassCache());
    return parseApiPayload(clientProfileSchema, response.data, "clientProfile");
  },
};
