import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { authApi, BANNED_EVENT_NAME } from "../../features/auth/api/authApi";
import { tokenStore, useAccessToken } from "../../shared/auth/tokenStore";

export const AuthContext = createContext(null);
const AUTH_ME_QUERY_KEY = ["auth", "me"];

function normalizeSessionPayload(payload) {
  return {
    user: payload?.user || null,
    paymentSettings: payload?.payment_settings || null,
  };
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const accessToken = useAccessToken();
  const [user, setUser] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const { mutateAsync: refreshSession } = useMutation({
    mutationFn: authApi.refreshSession,
  });
  const { mutateAsync: passwordLogin } = useMutation({
    mutationFn: authApi.passwordLogin,
  });
  const { mutateAsync: telegramLogin } = useMutation({
    mutationFn: authApi.telegramAuth,
  });
  const { mutateAsync: performLogout } = useMutation({
    mutationFn: authApi.logout,
  });

  const clearSession = useCallback(() => {
    tokenStore.clear();
    queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    setUser(null);
    setPaymentSettings(null);
  }, [queryClient]);

  const syncSession = useCallback(
    async ({ fallbackUser = null } = {}) => {
      try {
        const payload = await queryClient.fetchQuery({
          queryKey: AUTH_ME_QUERY_KEY,
          queryFn: authApi.getMe,
          staleTime: 0,
        });
        const normalized = normalizeSessionPayload(payload);
        setUser(normalized.user);
        setPaymentSettings(normalized.paymentSettings);
        return normalized.user;
      } catch (error) {
        if (fallbackUser) {
          setUser(fallbackUser);
          setPaymentSettings(null);
          return fallbackUser;
        }
        throw error;
      }
    },
    [queryClient]
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      try {
        const payload = await refreshSession();
        if (!active) {
          return;
        }
        tokenStore.set(payload.access);
        await syncSession();
      } catch {
        if (!active) {
          return;
        }
        if (!tokenStore.get()) {
          clearSession();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [clearSession, refreshSession, syncSession]);

  useEffect(() => {
    const onBanned = (event) => {
      const message = event?.detail?.message || "Ваш аккаунт заблокирован администратором.";
      setUser((prev) => {
        if (!prev) return prev;
        const hasReason = Boolean((prev.ban_reason || "").trim());
        return {
          ...prev,
          is_banned: true,
          ban_reason: hasReason ? prev.ban_reason : message,
        };
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener(BANNED_EVENT_NAME, onBanned);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(BANNED_EVENT_NAME, onBanned);
      }
    };
  }, []);

  const loginWithTelegram = useCallback(
    async (telegramPayload) => {
      const data = await telegramLogin(telegramPayload);
      tokenStore.set(data.access);
      try {
        return await syncSession({ fallbackUser: data.user || null });
      } catch (error) {
        clearSession();
        throw error;
      }
    },
    [clearSession, syncSession, telegramLogin]
  );

  const loginWithPassword = useCallback(
    async (credentials) => {
      const data = await passwordLogin(credentials);
      tokenStore.set(data.access);
      try {
        return await syncSession({ fallbackUser: data.user || null });
      } catch (error) {
        clearSession();
        throw error;
      }
    },
    [clearSession, passwordLogin, syncSession]
  );

  const loginWithAccessToken = useCallback(
    async (nextAccessToken) => {
      tokenStore.set(nextAccessToken);
      try {
        return await syncSession();
      } catch {
        clearSession();
        throw new Error("Не удалось завершить OAuth-вход.");
      }
    },
    [clearSession, syncSession]
  );

  const logout = useCallback(async () => {
    try {
      await performLogout();
    } catch {
      // Ignore backend logout errors and clear local state anyway.
    }
    clearSession();
  }, [clearSession, performLogout]);

  const reloadMe = useCallback(async () => {
    if (!accessToken) {
      return null;
    }
    queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    try {
      return await syncSession();
    } catch {
      clearSession();
      return null;
    }
  }, [accessToken, clearSession, queryClient, syncSession]);

  const value = useMemo(
    () => ({
      user,
      paymentSettings,
      loading,
      loginWithTelegram,
      loginWithPassword,
      loginWithAccessToken,
      logout,
      reloadMe,
    }),
    [
      user,
      paymentSettings,
      loading,
      loginWithTelegram,
      loginWithPassword,
      loginWithAccessToken,
      logout,
      reloadMe,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
