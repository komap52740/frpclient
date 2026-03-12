import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../features/auth/hooks/useAuth";
import { getApiErrorMessage } from "../../features/auth/lib/getApiErrorMessage";
import { useBootstrapStatusQuery } from "../../features/auth/model/useBootstrapStatusQuery";
import {
  useBootstrapAdminMutation,
  useOAuthStartMutation,
  usePasswordResetConfirmMutation,
  usePasswordResetRequestMutation,
} from "../../features/auth/model/useLoginMutations";
import { authInputSx, authPrimaryButtonSx } from "../../features/auth/ui/authStyles";
import BootstrapAdminCard from "../../features/auth/ui/BootstrapAdminCard";
import LoginCard from "../../features/auth/ui/LoginCard";
import LoginForm from "../../features/auth/ui/LoginForm";
import LoginLoadingScreen from "../../features/auth/ui/LoginLoadingScreen";
import LoginShell from "../../features/auth/ui/LoginShell";
import OAuthButtons from "../../features/auth/ui/OAuthButtons";
import TelegramWidget from "../../features/auth/ui/TelegramWidget";

const BOT_USERNAME_RAW = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";
const BOT_USERNAME = BOT_USERNAME_RAW.trim().replace(/^@/, "");
const TELEGRAM_WIDGET_RETRY_LIMIT = 5;
const TELEGRAM_WIDGET_BOOT_TIMEOUT_MS = 20000;
const TELEGRAM_WIDGET_POLL_MS = 450;

const AUTH_VIEW_LOGIN = "login";
const AUTH_VIEW_RESET_REQUEST = "reset-request";
const AUTH_VIEW_RESET_CONFIRM = "reset-confirm";

function clearLoginHash() {
  if (typeof window === "undefined") {
    return;
  }
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.search}`
  );
}

export default function LoginPage() {
  const { loginWithTelegram, loginWithAccessToken, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const {
    data: bootstrapStatus,
    isLoading: setupLoading,
    isError: bootstrapStatusError,
  } = useBootstrapStatusQuery();
  const { mutateAsync: startOAuthMutation } = useOAuthStartMutation();
  const { mutateAsync: bootstrapAdminMutation } = useBootstrapAdminMutation();
  const { mutateAsync: passwordResetRequestMutation } = usePasswordResetRequestMutation();
  const { mutateAsync: passwordResetConfirmMutation } = usePasswordResetConfirmMutation();

  const requiresSetup = Boolean(bootstrapStatus?.requires_setup);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [telegramWidgetError, setTelegramWidgetError] = useState("");
  const [telegramWidgetReloadKey, setTelegramWidgetReloadKey] = useState(0);
  const [authView, setAuthView] = useState(AUTH_VIEW_LOGIN);
  const [passwordResetToken, setPasswordResetToken] = useState("");
  const telegramContainerRef = useRef(null);
  const telegramWidgetRetryRef = useRef(0);
  const loginWithTelegramRef = useRef(loginWithTelegram);
  const navigateRef = useRef(navigate);

  const [setupForm, setSetupForm] = useState({
    username: "",
    password: "",
    passwordConfirm: "",
    first_name: "",
    last_name: "",
  });

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [passwordResetRequestForm, setPasswordResetRequestForm] = useState({
    email: "",
  });

  const [passwordResetConfirmForm, setPasswordResetConfirmForm] = useState({
    password: "",
    passwordConfirm: "",
  });

  useEffect(() => {
    loginWithTelegramRef.current = loginWithTelegram;
  }, [loginWithTelegram]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (bootstrapStatusError) {
      setError((prev) => prev || "Не удалось получить статус первичной настройки.");
    }
  }, [bootstrapStatusError]);

  useEffect(() => {
    if (setupLoading || requiresSetup || typeof window === "undefined") {
      return;
    }

    const hashValue = (window.location.hash || "").replace(/^#/, "");
    if (!hashValue) {
      return;
    }

    const params = new URLSearchParams(hashValue);
    const oauthAccess = params.get("oauth_access");
    const oauthError = params.get("oauth_error");
    const emailVerified = params.get("email_verified");
    const emailError = params.get("email_error");
    const nextPasswordResetToken = params.get("password_reset_token");

    if (oauthAccess || oauthError) {
      clearLoginHash();

      if (oauthError) {
        setError(oauthError);
        setSuccess("");
        return;
      }
      if (!oauthAccess) {
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");
      loginWithAccessToken(oauthAccess)
        .then(() => {
          navigate("/", { replace: true });
        })
        .catch((err) => {
          setError(getApiErrorMessage(err, "Не удалось завершить OAuth-вход"));
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    if (emailVerified === "1") {
      clearLoginHash();
      setAuthView(AUTH_VIEW_LOGIN);
      setPasswordResetToken("");
      setSuccess("Email подтверждён. Теперь можно войти в систему.");
      setError("");
      return;
    }

    if (emailError) {
      clearLoginHash();
      setAuthView(AUTH_VIEW_LOGIN);
      setPasswordResetToken("");
      setSuccess("");
      setError(emailError);
      return;
    }

    if (nextPasswordResetToken) {
      setAuthView(AUTH_VIEW_RESET_CONFIRM);
      setPasswordResetToken(nextPasswordResetToken);
      setError("");
      setSuccess("");
    }
  }, [loginWithAccessToken, navigate, requiresSetup, setupLoading]);

  useEffect(() => {
    if (setupLoading || requiresSetup || authView !== AUTH_VIEW_LOGIN || !BOT_USERNAME) {
      return undefined;
    }

    setTelegramWidgetError("");
    window.onTelegramAuth = async (user) => {
      setLoading(true);
      setError("");
      try {
        await loginWithTelegramRef.current(user);
        navigateRef.current("/", { replace: true });
      } catch (err) {
        setError(getApiErrorMessage(err, "Ошибка авторизации Telegram"));
      } finally {
        setLoading(false);
      }
    };

    let isDisposed = false;
    let failureHandled = false;
    let retryTimer = null;
    let bootTimer = null;
    let pollTimer = null;
    let observer = null;

    const container = telegramContainerRef.current;
    if (!container) {
      retryTimer = window.setTimeout(() => {
        if (!isDisposed) {
          setTelegramWidgetReloadKey((prev) => prev + 1);
        }
      }, 200);
      return () => {
        window.clearTimeout(retryTimer);
        window.onTelegramAuth = null;
      };
    }

    const hasWidgetUi = () =>
      Boolean(
        container.querySelector("iframe") ||
          Array.from(container.children).some(
            (node) => node.tagName && node.tagName.toLowerCase() !== "script"
          )
      );

    const markWidgetReady = () => {
      telegramWidgetRetryRef.current = 0;
      setTelegramWidgetError("");
      window.clearTimeout(retryTimer);
      window.clearTimeout(bootTimer);
      window.clearInterval(pollTimer);
      retryTimer = null;
      bootTimer = null;
      pollTimer = null;
    };

    const scheduleRetry = () => {
      if (failureHandled || isDisposed) return;
      failureHandled = true;

      const nextAttempt = telegramWidgetRetryRef.current + 1;
      telegramWidgetRetryRef.current = nextAttempt;

      if (nextAttempt < TELEGRAM_WIDGET_RETRY_LIMIT) {
        setTelegramWidgetError("");
        retryTimer = window.setTimeout(
          () => {
            if (!isDisposed) {
              setTelegramWidgetReloadKey((prev) => prev + 1);
            }
          },
          1000 + nextAttempt * 550
        );
        return;
      }

      setTelegramWidgetError(
        `Виджет Telegram не загрузился автоматически. Проверьте блокировку скриптов и бота @${BOT_USERNAME}.`
      );
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");

    script.onload = () => {
      pollTimer = window.setInterval(() => {
        if (isDisposed) return;
        if (hasWidgetUi()) {
          markWidgetReady();
        }
      }, TELEGRAM_WIDGET_POLL_MS);
    };
    script.onerror = scheduleRetry;

    observer = new MutationObserver(() => {
      if (isDisposed) return;
      if (hasWidgetUi()) {
        markWidgetReady();
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    container.innerHTML = "";
    container.appendChild(script);

    bootTimer = window.setTimeout(() => {
      if (isDisposed) return;
      if (hasWidgetUi()) {
        markWidgetReady();
      } else {
        scheduleRetry();
      }
    }, TELEGRAM_WIDGET_BOOT_TIMEOUT_MS);

    return () => {
      isDisposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(bootTimer);
      window.clearInterval(pollTimer);
      if (observer) {
        observer.disconnect();
      }
      window.onTelegramAuth = null;
      if (container.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [authView, requiresSetup, setupLoading, telegramWidgetReloadKey]);

  const switchToLoginView = () => {
    clearLoginHash();
    setAuthView(AUTH_VIEW_LOGIN);
    setPasswordResetToken("");
    setPasswordResetConfirmForm({ password: "", passwordConfirm: "" });
    setError("");
  };

  const switchToResetRequestView = () => {
    clearLoginHash();
    setAuthView(AUTH_VIEW_RESET_REQUEST);
    setPasswordResetToken("");
    setSuccess("");
    setError("");
  };

  const startOAuthLogin = async (provider) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await startOAuthMutation(provider);
      if (!response?.auth_url) {
        throw new Error("OAuth URL is missing");
      }
      window.location.assign(response.auth_url);
    } catch (err) {
      setError(getApiErrorMessage(err, "Не удалось начать OAuth-вход"));
      setLoading(false);
    }
  };

  const submitPasswordLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await loginWithPassword(loginForm);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Не удалось выполнить вход. Попробуйте снова."));
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordResetRequest = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await passwordResetRequestMutation(passwordResetRequestForm);
      setSuccess(response?.detail || "Если аккаунт найден, инструкция отправлена на email.");
      setAuthView(AUTH_VIEW_LOGIN);
      setPasswordResetRequestForm({ email: "" });
    } catch (err) {
      setError(getApiErrorMessage(err, "Не удалось отправить инструкцию по смене пароля."));
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordResetConfirm = async (event) => {
    event.preventDefault();
    if (!passwordResetToken) {
      setError("Ссылка для смены пароля недействительна.");
      return;
    }
    if (passwordResetConfirmForm.password !== passwordResetConfirmForm.passwordConfirm) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await passwordResetConfirmMutation({
        token: passwordResetToken,
        password: passwordResetConfirmForm.password,
        password_confirm: passwordResetConfirmForm.passwordConfirm,
      });
      clearLoginHash();
      setPasswordResetToken("");
      setAuthView(AUTH_VIEW_LOGIN);
      setPasswordResetConfirmForm({ password: "", passwordConfirm: "" });
      setSuccess(response?.detail || "Пароль обновлён. Теперь можно войти.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Не удалось обновить пароль."));
    } finally {
      setLoading(false);
    }
  };

  const submitBootstrap = async (event) => {
    event.preventDefault();
    setError("");

    if (setupForm.password !== setupForm.passwordConfirm) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    try {
      const response = await bootstrapAdminMutation({
        username: setupForm.username,
        password: setupForm.password,
        first_name: setupForm.first_name,
        last_name: setupForm.last_name,
      });
      await loginWithAccessToken(response.access);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Не удалось завершить первичную настройку"));
    } finally {
      setLoading(false);
    }
  };

  if (setupLoading) {
    return <LoginLoadingScreen />;
  }

  const cardTitle = requiresSetup
    ? ""
    : authView === AUTH_VIEW_RESET_REQUEST
      ? "Сброс пароля"
      : authView === AUTH_VIEW_RESET_CONFIRM
        ? "Новый пароль"
        : "";

  const cardSubtitle = requiresSetup
    ? ""
    : authView === AUTH_VIEW_RESET_REQUEST
      ? "Введите email аккаунта. Если он зарегистрирован, мы отправим ссылку для безопасной смены пароля."
      : authView === AUTH_VIEW_RESET_CONFIRM
        ? "Задайте новый пароль для аккаунта. После сохранения все старые refresh-сессии будут отозваны."
        : "";

  return (
    <LoginShell>
      <LoginCard
        requiresSetup={requiresSetup}
        error={error}
        success={success}
        title={cardTitle}
        subtitle={cardSubtitle}
      >
        {requiresSetup ? (
          <BootstrapAdminCard
            form={setupForm}
            loading={loading}
            onSubmit={submitBootstrap}
            onChange={(field, value) => setSetupForm((prev) => ({ ...prev, [field]: value }))}
          />
        ) : authView === AUTH_VIEW_RESET_REQUEST ? (
          <Box component="form" onSubmit={submitPasswordResetRequest}>
            <Stack spacing={1.2}>
              <TextField
                required
                type="email"
                label="Email"
                autoComplete="email"
                value={passwordResetRequestForm.email}
                onChange={(event) =>
                  setPasswordResetRequestForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                sx={authInputSx}
              />
              <Button type="submit" variant="contained" disabled={loading} sx={authPrimaryButtonSx}>
                {loading ? "Отправляем..." : "Отправить ссылку"}
              </Button>
              <Button type="button" variant="text" disabled={loading} onClick={switchToLoginView}>
                Вернуться ко входу
              </Button>
            </Stack>
          </Box>
        ) : authView === AUTH_VIEW_RESET_CONFIRM ? (
          <Box component="form" onSubmit={submitPasswordResetConfirm}>
            <Stack spacing={1.2}>
              <TextField
                required
                label="Новый пароль"
                type="password"
                autoComplete="new-password"
                value={passwordResetConfirmForm.password}
                onChange={(event) =>
                  setPasswordResetConfirmForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                sx={authInputSx}
              />
              <TextField
                required
                label="Повторите пароль"
                type="password"
                autoComplete="new-password"
                value={passwordResetConfirmForm.passwordConfirm}
                onChange={(event) =>
                  setPasswordResetConfirmForm((prev) => ({
                    ...prev,
                    passwordConfirm: event.target.value,
                  }))
                }
                sx={authInputSx}
              />
              <Typography sx={{ color: "rgba(204,221,244,0.72)", fontSize: 13.4 }}>
                Используйте пароль не короче 10 символов и не повторяйте старые или слишком простые
                комбинации.
              </Typography>
              <Button type="submit" variant="contained" disabled={loading} sx={authPrimaryButtonSx}>
                {loading ? "Сохраняем..." : "Сменить пароль"}
              </Button>
              <Button type="button" variant="text" disabled={loading} onClick={switchToLoginView}>
                Вернуться ко входу
              </Button>
            </Stack>
          </Box>
        ) : (
          <LoginForm
            form={loginForm}
            loading={loading}
            onSubmit={submitPasswordLogin}
            onChange={(field, value) => setLoginForm((prev) => ({ ...prev, [field]: value }))}
            footer={
              <Button
                type="button"
                variant="text"
                disabled={loading}
                onClick={switchToResetRequestView}
              >
                Забыли пароль?
              </Button>
            }
          >
            <OAuthButtons loading={loading} onOAuthLogin={startOAuthLogin} />
            <TelegramWidget
              botUsername={BOT_USERNAME}
              containerRef={telegramContainerRef}
              loading={loading}
              widgetError={telegramWidgetError}
              onRetry={() => {
                telegramWidgetRetryRef.current = 0;
                setTelegramWidgetReloadKey((prev) => prev + 1);
              }}
            />
          </LoginForm>
        )}
      </LoginCard>
    </LoginShell>
  );
}
