import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { authApi, BANNED_EVENT_NAME } from "../api/client";
import { clearTokens, getAccessToken, setAccessToken } from "../api/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.user);
      setPaymentSettings(data.payment_settings);
      return data.user;
    } catch {
      setUser(null);
      setPaymentSettings(null);
      return null;
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      await loadMe();
      setLoading(false);
    }
    bootstrap();
  }, [loadMe]);

  useEffect(() => {
    // Handles the first-login race: token is already stored but user payload
    // has not been fully loaded yet.
    if (loading || !getAccessToken()) {
      return;
    }
    if (user && user.role) {
      return;
    }

    let active = true;
    setLoading(true);
    loadMe().finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [loading, user, loadMe]);

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

  const loginWithTelegram = useCallback(async (telegramPayload) => {
    const data = await authApi.telegramAuth(telegramPayload);
    setAccessToken(data.access);
    if (data.user) {
      setUser(data.user);
    }

    // Do not fail login if /me temporarily returns an error.
    try {
      const me = await authApi.getMe();
      setUser(me.user);
      setPaymentSettings(me.payment_settings);
      return me.user;
    } catch {
      return data.user || null;
    }
  }, []);

  const loginWithPassword = useCallback(async (credentials) => {
    const data = await authApi.passwordLogin(credentials);
    setAccessToken(data.access);
    if (data.user) {
      setUser(data.user);
    }

    try {
      const me = await authApi.getMe();
      setUser(me.user);
      setPaymentSettings(me.payment_settings);
      return me.user;
    } catch {
      return data.user || null;
    }
  }, []);

  const registerWithPassword = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    setAccessToken(data.access);
    if (data.user) {
      setUser(data.user);
    }

    try {
      const me = await authApi.getMe();
      setUser(me.user);
      setPaymentSettings(me.payment_settings);
      return me.user;
    } catch {
      return data.user || null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore backend logout errors and clear local state anyway.
    }
    clearTokens();
    setUser(null);
    setPaymentSettings(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      paymentSettings,
      loading,
      loginWithTelegram,
      loginWithPassword,
      registerWithPassword,
      logout,
      reloadMe: loadMe,
    }),
    [user, paymentSettings, loading, loginWithTelegram, loginWithPassword, registerWithPassword, logout, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
