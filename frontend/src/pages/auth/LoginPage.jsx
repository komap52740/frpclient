import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const BOT_USERNAME_RAW = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";
const BOT_USERNAME = BOT_USERNAME_RAW.trim().replace(/^@/, "");
const TELEGRAM_WIDGET_RETRY_LIMIT = 5;
const TELEGRAM_WIDGET_BOOT_TIMEOUT_MS = 20000;
const TELEGRAM_WIDGET_POLL_MS = 450;

function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string" && data.detail) {
    return data.detail;
  }
  if (Array.isArray(data?.non_field_errors) && typeof data.non_field_errors[0] === "string") {
    return data.non_field_errors[0];
  }
  if (data && typeof data === "object") {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (typeof value === "string" && value) {
        return value;
      }
      if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
        return value[0];
      }
    }
  }
  if (typeof data === "string" && data) {
    return data;
  }
  return fallback;
}

export default function LoginPage() {
  const { loginWithTelegram, loginWithAccessToken, loginWithPassword } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [setupLoading, setSetupLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [telegramWidgetError, setTelegramWidgetError] = useState("");
  const [telegramWidgetReloadKey, setTelegramWidgetReloadKey] = useState(0);
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

  useEffect(() => {
    loginWithTelegramRef.current = loginWithTelegram;
  }, [loginWithTelegram]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const loadBootstrapStatus = async () => {
      setSetupLoading(true);
      try {
        const response = await authApi.bootstrapStatus();
        setRequiresSetup(Boolean(response.requires_setup));
      } catch {
        setError("Не удалось получить статус первичной настройки.");
      } finally {
        setSetupLoading(false);
      }
    };

    loadBootstrapStatus();
  }, []);

  useEffect(() => {
    if (requiresSetup) return;

    const hashValue = (window.location.hash || "").replace(/^#/, "");
    if (!hashValue) return;

    const params = new URLSearchParams(hashValue);
    const oauthAccess = params.get("oauth_access");
    const oauthError = params.get("oauth_error");

    if (!oauthAccess && !oauthError) {
      return;
    }

    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);

    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (!oauthAccess) {
      return;
    }

    setLoading(true);
    setError("");
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
  }, [loginWithAccessToken, navigate, requiresSetup]);

  useEffect(() => {
    if (requiresSetup || !BOT_USERNAME) {
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

    const container = document.getElementById("telegram-login-container");
    if (!container) {
      setTelegramWidgetError("Контейнер Telegram-входа не найден.");
      return () => {
        window.onTelegramAuth = null;
      };
    }

    const hasWidgetUi = () =>
      Boolean(
        container.querySelector("iframe") ||
          Array.from(container.children).some((node) => node.tagName && node.tagName.toLowerCase() !== "script")
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
        retryTimer = window.setTimeout(() => {
          if (!isDisposed) {
            setTelegramWidgetReloadKey((prev) => prev + 1);
          }
        }, 1000 + nextAttempt * 550);
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
  }, [requiresSetup, telegramWidgetReloadKey]);

  const startOAuthLogin = async (provider) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await authApi.oauthStart(provider);
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

  const submitBootstrap = async (event) => {
    event.preventDefault();
    setError("");

    if (setupForm.password !== setupForm.passwordConfirm) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.bootstrapAdmin({
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
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(1200px 700px at -10% -10%, rgba(64,153,255,0.24) 0%, rgba(8,16,33,0) 45%), radial-gradient(900px 620px at 110% 0%, rgba(22,191,134,0.18) 0%, rgba(8,16,33,0) 45%), linear-gradient(160deg, #050912 0%, #071025 45%, #040812 100%)",
          fontFamily: "Manrope, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography color="rgba(233,244,255,0.92)">Проверяем состояние системы...</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 1.5, md: 3.5 },
        py: { xs: 2, md: 3.5 },
        fontFamily: "Manrope, 'Segoe UI', system-ui, sans-serif",
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(64,153,255,0.24) 0%, rgba(8,16,33,0) 45%), radial-gradient(900px 620px at 110% 0%, rgba(22,191,134,0.18) 0%, rgba(8,16,33,0) 45%), linear-gradient(160deg, #050912 0%, #071025 45%, #040812 100%)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1220,
          mx: "auto",
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 5,
            minHeight: { xs: 240, md: "100%" },
            p: { xs: 2.4, md: 4.4 },
            border: "1px solid rgba(122,171,255,0.24)",
            background:
              "linear-gradient(145deg, rgba(12,21,43,0.92) 0%, rgba(8,14,30,0.95) 58%, rgba(7,12,24,0.98) 100%)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.46)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(560px 300px at 85% -10%, rgba(92,160,255,0.26) 0%, rgba(92,160,255,0) 62%), radial-gradient(420px 220px at -10% 100%, rgba(22,191,134,0.20) 0%, rgba(22,191,134,0) 60%)",
              pointerEvents: "none",
            },
          }}
        >
          <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1 }}>
            <Chip
              label="FRP Client Premium"
              sx={{
                alignSelf: "flex-start",
                color: "rgba(220,239,255,0.95)",
                bgcolor: "rgba(80,145,255,0.18)",
                border: "1px solid rgba(122,171,255,0.45)",
                fontWeight: 800,
                letterSpacing: 0.25,
              }}
            />

            <Typography sx={{ fontSize: { xs: 30, md: 46 }, lineHeight: 1.05, fontWeight: 900, color: "#f7fbff" }}>
              Разблокировка устройств
              <Box component="span" sx={{ color: "#84d4ff", display: "block" }}>
                без визита в сервис
              </Box>
            </Typography>

            <Typography sx={{ color: "rgba(210,228,250,0.84)", fontSize: { xs: 14, md: 17 }, maxWidth: 620 }}>
              Онлайн-заявка, диалог с мастером и прозрачные статусы в одном интерфейсе. Вы всегда понимаете,
              что происходит на каждом этапе: проверка, оплата, работа, завершение.
            </Typography>

            <Box
              sx={{
                display: "grid",
                gap: 1.15,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              {[
                {
                  title: "01. Заявка",
                  text: "Укажите модель, проблему и данные RuDesktop. Без лишних полей.",
                },
                {
                  title: "02. Работа",
                  text: "Мастер ведет заявку через чат и статусы, без скрытых этапов.",
                },
                {
                  title: "03. Результат",
                  text: "После завершения доступна история действий и быстрый отзыв.",
                },
              ].map((item) => (
                <Box
                  key={item.title}
                  sx={{
                    p: 1.35,
                    borderRadius: 2.2,
                    border: "1px solid rgba(126,174,255,0.32)",
                    background: "linear-gradient(150deg, rgba(20,34,67,0.84) 0%, rgba(13,24,47,0.78) 100%)",
                  }}
                >
                  <Typography sx={{ fontWeight: 800, color: "#ddedff", fontSize: 14 }}>{item.title}</Typography>
                  <Typography sx={{ color: "rgba(202,220,246,0.82)", fontSize: 13, mt: 0.65, lineHeight: 1.42 }}>
                    {item.text}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                p: 1.4,
                borderRadius: 2.2,
                border: "1px solid rgba(120,170,255,0.28)",
                background: "rgba(11,22,42,0.72)",
              }}
            >
              <Typography sx={{ fontWeight: 800, color: "#d6e9ff", mb: 0.65 }}>Что нужно для старта</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.4, color: "rgba(206,224,250,0.84)", fontSize: 13.5, lineHeight: 1.54 }}>
                <li>модель устройства и описание проблемы;</li>
                <li>логин/ID и пароль RuDesktop для подключения;</li>
                <li>подтверждение оплаты в карточке заявки.</li>
              </Box>
            </Box>

            <Button
              variant="outlined"
              onClick={() => document.getElementById("auth-login-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              sx={{
                alignSelf: "flex-start",
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 800,
                borderColor: "rgba(132,179,255,0.66)",
                color: "#b7dbff",
                px: 2,
                "&:hover": {
                  borderColor: "rgba(158,198,255,0.95)",
                  background: "rgba(86,146,255,0.10)",
                },
              }}
            >
              Перейти ко входу
            </Button>
          </Stack>
        </Paper>

        <Paper
          id="auth-login-card"
          elevation={0}
          sx={{
            borderRadius: 5,
            p: { xs: 2.4, md: 3.2 },
            border: "1px solid rgba(124,167,255,0.30)",
            background:
              "linear-gradient(165deg, rgba(23,35,64,0.95) 0%, rgba(16,27,52,0.94) 55%, rgba(12,21,42,0.95) 100%)",
            boxShadow: "0 22px 58px rgba(0,0,0,0.44)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: 32, md: 42 }, color: "#f8fbff" }}>
                {requiresSetup ? "Первичная настройка" : "Вход в систему"}
              </Typography>
              {!requiresSetup ? (
                <Chip
                  label="Безопасный вход"
                  sx={{
                    color: "#d0ebff",
                    border: "1px solid rgba(118,173,255,0.48)",
                    bgcolor: "rgba(86,147,255,0.14)",
                    fontWeight: 700,
                  }}
                />
              ) : null}
            </Stack>

            <Typography sx={{ color: "rgba(213,227,249,0.78)", fontSize: 14.5 }}>
              {requiresSetup
                ? "Создайте первого администратора для запуска платформы."
                : "Авторизация через Google, Яндекс, Telegram или логин/пароль."}
            </Typography>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}

            {requiresSetup ? (
              <Box component="form" onSubmit={submitBootstrap}>
                <Stack spacing={1.35}>
                  <Alert severity="info">После создания администратора вход будет доступен всем ролям.</Alert>
                  <TextField
                    required
                    label="Логин администратора"
                    value={setupForm.username}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, username: e.target.value }))}
                  />
                  <TextField
                    required
                    label="Пароль"
                    type="password"
                    value={setupForm.password}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <TextField
                    required
                    label="Подтверждение пароля"
                    type="password"
                    value={setupForm.passwordConfirm}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
                  />
                  <TextField
                    label="Имя"
                    value={setupForm.first_name}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  />
                  <TextField
                    label="Фамилия"
                    value={setupForm.last_name}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{
                      mt: 0.4,
                      borderRadius: 2,
                      py: 1.25,
                      textTransform: "none",
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #67adff 0%, #3e84ff 100%)",
                      boxShadow: "0 12px 30px rgba(75,145,255,0.38)",
                    }}
                  >
                    {loading ? "Создаем администратора..." : "Создать администратора и войти"}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={1.4}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    onClick={() => startOAuthLogin("google")}
                    sx={{
                      borderRadius: 2,
                      py: 1.2,
                      textTransform: "none",
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #6aaeff 0%, #3f86ff 100%)",
                      boxShadow: "0 10px 28px rgba(61,133,255,0.33)",
                    }}
                  >
                    Войти через Google
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    onClick={() => startOAuthLogin("yandex")}
                    sx={{
                      borderRadius: 2,
                      py: 1.2,
                      textTransform: "none",
                      fontWeight: 800,
                      borderColor: "rgba(129,177,255,0.68)",
                      color: "#afd6ff",
                      "&:hover": {
                        borderColor: "rgba(153,196,255,0.95)",
                        background: "rgba(93,149,255,0.10)",
                      },
                    }}
                  >
                    Войти через Яндекс
                  </Button>
                </Stack>

                {!BOT_USERNAME ? (
                  <Alert severity="warning">Не задано значение VITE_TELEGRAM_BOT_USERNAME.</Alert>
                ) : (
                  <Stack spacing={1}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.1,
                        borderRadius: 2,
                        borderColor: alpha("#8bc2ff", 0.55),
                        background: alpha("#0d1f42", 0.56),
                      }}
                    >
                      <Stack spacing={0.7}>
                        <Typography sx={{ color: "rgba(213,230,252,0.88)", fontSize: 13.5, fontWeight: 700 }}>
                          Telegram вход
                        </Typography>
                        <Box
                          id="telegram-login-container"
                          sx={{
                            minHeight: 50,
                            px: 0.7,
                            py: 0.65,
                            borderRadius: 1.6,
                            border: `1px dashed ${alpha("#86bdff", 0.48)}`,
                            bgcolor: alpha("#0e2042", 0.42),
                            display: "flex",
                            alignItems: "center",
                          }}
                        />
                      </Stack>
                    </Paper>

                    {telegramWidgetError ? (
                      <Stack spacing={1}>
                        <Alert severity="warning">{telegramWidgetError}</Alert>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              telegramWidgetRetryRef.current = 0;
                              setTelegramWidgetReloadKey((prev) => prev + 1);
                            }}
                            sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: 1.4 }}
                          >
                            Перезагрузить Telegram вход
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            component="a"
                            href={`https://t.me/${BOT_USERNAME}`}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: 1.4 }}
                          >
                            Открыть @{BOT_USERNAME}
                          </Button>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                )}

                <Divider sx={{ color: "rgba(205,222,248,0.65)", fontSize: 12.5 }}>или вход по логину/паролю</Divider>

                <Box component="form" onSubmit={submitPasswordLogin}>
                  <Stack spacing={1.2}>
                    <TextField
                      required
                      label="Логин"
                      autoComplete="username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                    <TextField
                      required
                      label="Пароль"
                      type="password"
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      sx={{
                        mt: 0.4,
                        borderRadius: 2,
                        py: 1.15,
                        textTransform: "none",
                        fontWeight: 800,
                        background: "linear-gradient(135deg, #67adff 0%, #3e84ff 100%)",
                        boxShadow: "0 10px 26px rgba(75,145,255,0.34)",
                      }}
                    >
                      {loading ? "Входим..." : "Войти"}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
