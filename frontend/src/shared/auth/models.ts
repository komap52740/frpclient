import { z } from "zod";

const passthroughObjectSchema = z.object({}).passthrough();

export const authUserSchema = z
  .object({
    id: z.number(),
    username: z.string().min(1),
    role: z.string().min(1),
    is_banned: z.boolean().optional(),
    ban_reason: z.string().nullable().optional(),
  })
  .passthrough();

export const authSessionSchema = z
  .object({
    access: z.string().min(1),
    user: authUserSchema.nullish(),
  })
  .passthrough();

export const bootstrapStatusSchema = z
  .object({
    requires_setup: z.boolean().optional(),
  })
  .passthrough();

export const oauthStartSchema = z
  .object({
    auth_url: z.string().min(1),
  })
  .passthrough();

export const passwordResetDetailSchema = z
  .object({
    detail: z.string().min(1).optional(),
  })
  .passthrough();

export const meResponseSchema = z
  .object({
    user: authUserSchema.nullish(),
    payment_settings: passthroughObjectSchema.nullish(),
  })
  .passthrough();

export const wholesaleStatusSchema = passthroughObjectSchema;
export const dashboardSummarySchema = passthroughObjectSchema;
export const clientProfileSchema = passthroughObjectSchema;
export const genericObjectResponseSchema = passthroughObjectSchema;

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionSchema>;
export type BootstrapStatusResponse = z.infer<typeof bootstrapStatusSchema>;
export type OAuthStartResponse = z.infer<typeof oauthStartSchema>;
export type PasswordResetDetailResponse = z.infer<typeof passwordResetDetailSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type WholesaleStatusResponse = z.infer<typeof wholesaleStatusSchema>;
export type DashboardSummaryResponse = z.infer<typeof dashboardSummarySchema>;
export type ClientProfileResponse = z.infer<typeof clientProfileSchema>;
export type GenericObjectResponse = z.infer<typeof genericObjectResponseSchema>;

export function parseApiPayload<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw new Error(`${label} response shape is invalid`);
}
