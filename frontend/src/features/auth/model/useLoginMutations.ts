import { useMutation } from "@tanstack/react-query";

import { authApi } from "../api/authApi";

export function useOAuthStartMutation() {
  return useMutation({
    mutationFn: authApi.oauthStart,
  });
}

export function useBootstrapAdminMutation() {
  return useMutation({
    mutationFn: authApi.bootstrapAdmin,
  });
}

export function usePasswordResetRequestMutation() {
  return useMutation({
    mutationFn: authApi.passwordResetRequest,
  });
}

export function usePasswordResetConfirmMutation() {
  return useMutation({
    mutationFn: authApi.passwordResetConfirm,
  });
}
