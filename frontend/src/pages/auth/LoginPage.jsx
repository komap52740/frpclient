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
    script.setAttribute("data-radius", "8");
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
            "radial-gradient(70% 60% at 0% 0%, rgba(61,126,255,0.26) 0%, rgba(10,15,30,0.96) 54%, #060a18 100%)",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography color="rgba(255,255,255,0.88)">Проверяем состояние системы...</Typography>
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
        background:
          "radial-gradient(70% 60% at 0% 0%, rgba(61,126,255,0.24) 0%, rgba(10,15,30,0.95) 55%, #050914 100%)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1120,
          mx: "auto",
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "1.04fr 1fr" },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 4,
            minHeight: { xs: 200, md: "100%" },
            p: { xs: 2.4, md: 4.2 },
            border: "1px solid rgba(112,157,246,0.25)",
            background:
              "linear-gradient(145deg, rgba(14,24,48,0.92) 0%, rgba(9,16,34,0.95) 58%, rgba(8,13,28,0.98) 100%)",
            boxShadow: "0 26px 58px rgba(0,0,0,0.40)",
            "&::before": {
              content: '""',
              position: "absolute",
              top: -80,
              right: -70,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(84,154,255,0.28) 0%, rgba(84,154,255,0) 74%)",
            },
          }}
        >
          <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1 }}>
            <Chip
              label="FRP Client • удаленная разблокировка"
              sx={{
                alignSelf: "flex-start",
                color: "rgba(203,228,255,0.95)",
                bgcolor: "rgba(84,146,255,0.16)",
                border: "1px solid rgba(125,178,255,0.40)",
                fontWeight: 700,
              }}
            />
            <Typography sx={{ fontSize: { xs: 30, md: 42 }, lineHeight: 1.06, fontWeight: 800, color: "#f4f8ff" }}>
              Разблокировка без
              <Box component="span" sx={{ color: "#7ec1ff" }}>
                {" "}
                поездки в сервис
              </Box>
            </Typography>
            <Typography sx={{ color: "rgba(204,223,255,0.82)", fontSize: { xs: 14, md: 16 }, maxWidth: 560 }}>
              Подаете заявку онлайн, мастер берёт работу в чат, вы видите каждый шаг в реальном времени:
              проверка, оплата, работа, завершение.
            </Typography>

            <Box
              sx={{
                display: "grid",
                gap: 1.1,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              {[
                {
                  title: "1. Заявка",
                  text: "Модель, проблема и доступ через RuDesktop — без длинных анкет.",
                },
                {
                  title: "2. Работа мастера",
                  text: "Мастер отвечает в чате и ведет заявку по прозрачным статусам.",
                },
                {
                  title: "3. Результат",
                  text: "После завершения сразу виден итог и история действий по заявке.",
                },
              ].map((item) => (
                <Box
                  key={item.title}
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    border: "1px solid rgba(134,183,255,0.30)",
                    background: "linear-gradient(150deg, rgba(21,37,70,0.86) 0%, rgba(15,26,49,0.78) 100%)",
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: "#d8eaff", fontSize: 14 }}>{item.title}</Typography>
                  <Typography sx={{ color: "rgba(197,217,246,0.82)", fontSize: 13, mt: 0.6, lineHeight: 1.4 }}>
                    {item.text}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                border: "1px solid rgba(112,168,255,0.26)",
                background: "rgba(12,22,43,0.66)",
              }}
            >
              <Typography sx={{ fontWeight: 700, color: "#d5e7ff", mb: 0.6 }}>Что потребуется от клиента</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.3, color: "rgba(205,224,250,0.84)", fontSize: 13, lineHeight: 1.5 }}>
                <li>модель устройства и короткое описание проблемы;</li>
                <li>логин/ID и пароль RuDesktop для удаленного подключения;</li>
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
                fontWeight: 700,
                borderColor: "rgba(123,169,255,0.62)",
                color: "#a8d1ff",
                px: 2,
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
            borderRadius: 4,
            p: { xs: 2.4, md: 3.2 },
            border: "1px solid rgba(124,167,255,0.28)",
            background:
              "linear-gradient(165deg, rgba(24,36,66,0.95) 0%, rgba(17,28,54,0.94) 55%, rgba(14,23,44,0.95) 100%)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.40)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 38 }, color: "#f7fbff" }}>
              {requiresSetup ? "Первичная настройка" : "Вход в систему"}
            </Typography>
            <Typography sx={{ color: "rgba(210,225,248,0.78)", fontSize: 14 }}>
              {requiresSetup
                ? "Создайте первого администратора для запуска платформы."
                : "Вход через Google, Яндекс, Telegram или логин/пароль."}
            </Typography>

            {!requiresSetup ? (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  border: "1px solid rgba(118,168,255,0.28)",
                  background: "linear-gradient(145deg, rgba(16,29,56,0.80) 0%, rgba(11,22,44,0.74) 100%)",
                }}
              >
                <Typography sx={{ fontWeight: 700, color: "#dbe9ff", fontSize: 14, mb: 0.5 }}>
                  Зачем нужен сервис
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    m: 0,
                    pl: 2.2,
                    color: "rgba(204,223,248,0.86)",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                  }}
                >
                  <li>Удаленная разблокировка без поездок в офис и очередей.</li>
                  <li>Чат с мастером и прозрачные статусы работы по заявке.</li>
                  <li>Оплата и подтверждение в одном окне, без лишних шагов.</li>
                </Box>
              </Box>
            ) : null}

            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            {requiresSetup ? (
              <Box component="form" onSubmit={submitBootstrap}>
                <Stack spacing={1.4}>
                  <Alert severity="info">Создайте первого администратора. После этого настройка через консоль не потребуется.</Alert>
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
                      mt: 0.5,
                      borderRadius: 2,
                      py: 1.2,
                      textTransform: "none",
                      fontWeight: 700,
                      boxShadow: "0 10px 26px rgba(88,157,255,0.34)",
                    }}
                  >
                    {loading ? "Выполняется..." : "Создать администратора и войти"}
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
                      fontWeight: 700,
                      background: "linear-gradient(135deg, #66a9ff 0%, #3a7fff 100%)",
                      boxShadow: "0 10px 26px rgba(62,133,255,0.32)",
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
                      fontWeight: 700,
                      borderColor: "rgba(123,169,255,0.62)",
                      color: "#a8d1ff",
                      "&:hover": { borderColor: "rgba(145,186,255,0.88)" },
                    }}
                  >
                    Войти через Яндекс
                  </Button>
                </Stack>

                {!BOT_USERNAME ? (
                  <Alert severity="warning">Не задано значение VITE_TELEGRAM_BOT_USERNAME.</Alert>
                ) : (
                  <Stack spacing={1}>
                    <Box
                      id="telegram-login-container"
                      sx={{
                        minHeight: 48,
                        px: 1.2,
                        py: 1,
                        borderRadius: 2,
                        border: `1px solid ${alpha("#86bdff", 0.45)}`,
                        bgcolor: alpha("#0e2042", 0.46),
                        display: "flex",
                        alignItems: "center",
                      }}
                    />
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
                            sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: 1.5 }}
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
                            sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: 1.5 }}
                          >
                            Открыть @{BOT_USERNAME}
                          </Button>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                )}

                <Divider sx={{ color: "rgba(205,222,248,0.65)", fontSize: 13 }}>или</Divider>

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
                        fontWeight: 700,
                        background: "linear-gradient(135deg, #66a9ff 0%, #3a7fff 100%)",
                        boxShadow: "0 10px 24px rgba(62,133,255,0.30)",
                      }}
                    >
                      Войти
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
