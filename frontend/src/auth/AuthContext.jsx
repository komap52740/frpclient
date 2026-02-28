import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { authApi } from "../api/client";
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

  const loginWithTelegram = useCallback(async (telegramPayload) => {
    const data = await authApi.telegramAuth(telegramPayload);
    setAccessToken(data.access);
    setUser(data.user);
    const me = await authApi.getMe();
    setUser(me.user);
    setPaymentSettings(me.payment_settings);
    return me.user;
  }, []);

  const logout = useCallback(() => {
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
      logout,
      reloadMe: loadMe,
    }),
    [user, paymentSettings, loading, loginWithTelegram, logout, loadMe]
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
