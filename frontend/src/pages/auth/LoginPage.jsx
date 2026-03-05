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
import GoogleIcon from "@mui/icons-material/Google";
import TelegramIcon from "@mui/icons-material/Telegram";
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

const authInputSx = {
  "& .MuiInputLabel-root": {
    color: "rgba(188, 207, 232, 0.82)",
    fontWeight: 600,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#bfe0ff",
  },
  "& .MuiOutlinedInput-root": {
    borderRadius: 1.9,
    fontWeight: 600,
    color: "#f1f7ff",
    background: "rgba(9, 20, 39, 0.76)",
    transition: "all .22s ease",
    "& fieldset": {
      borderColor: "rgba(132, 169, 224, 0.36)",
      borderWidth: 1.1,
    },
    "&:hover fieldset": {
      borderColor: "rgba(148, 193, 255, 0.62)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "rgba(150, 204, 255, 0.95)",
      boxShadow: "0 0 0 3px rgba(86, 157, 255, 0.14)",
    },
  },
  "& .MuiInputBase-input": {
    py: 1.32,
  },
};

const authPrimaryButtonSx = {
  minHeight: 52,
  borderRadius: 3,
  py: 1.15,
  px: 1.7,
  textTransform: "none",
  fontWeight: 800,
  letterSpacing: 0.1,
  fontSize: 18,
  fontFamily: "'Sora', 'Manrope', sans-serif",
  background: "linear-gradient(135deg, #7fbeff 0%, #4f8dff 45%, #386de2 100%)",
  color: "#f7fcff",
  border: "1.2px solid rgba(160, 204, 255, 0.58)",
  boxShadow: "0 16px 30px rgba(45, 111, 226, 0.34), inset 0 1px 0 rgba(255,255,255,0.22)",
  transition: "all .2s ease",
  "&:hover": {
    background: "linear-gradient(135deg, #8bc4ff 0%, #5b97ff 45%, #477eef 100%)",
    boxShadow: "0 18px 36px rgba(52, 123, 241, 0.42), inset 0 1px 0 rgba(255,255,255,0.26)",
    transform: "translateY(-1px)",
  },
  "&:active": {
    transform: "translateY(0)",
    boxShadow: "0 8px 22px rgba(45, 111, 226, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  "&.Mui-disabled": {
    color: "rgba(213,230,255,0.72)",
    background: "linear-gradient(135deg, rgba(91,145,222,0.62) 0%, rgba(69,116,199,0.6) 100%)",
    borderColor: "rgba(152,188,236,0.38)",
  },
};

const AUTH_PROVIDER_BUTTON_HEIGHT = 56;

const oauthButtonBaseSx = {
  minHeight: AUTH_PROVIDER_BUTTON_HEIGHT,
  borderRadius: 2.8,
  px: 1.9,
  textTransform: "none",
  fontWeight: 800,
  letterSpacing: 0.12,
  fontSize: { xs: 16, sm: 17 },
  fontFamily: "'Sora', 'Manrope', sans-serif",
  lineHeight: 1.2,
  borderWidth: 1.3,
  justifyContent: "center",
  transition: "all .18s ease",
  boxShadow: "0 12px 24px rgba(5,12,28,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
  "& .MuiButton-startIcon": {
    mr: 1,
  },
  "&:active": {
    transform: "translateY(0)",
  },
};

const oauthGoogleButtonSx = {
  ...oauthButtonBaseSx,
  color: "#1f2328",
  borderColor: "rgba(255,255,255,0.95)",
  background: "linear-gradient(180deg, #ffffff 0%, #eef5ff 100%)",
  "&:hover": {
    borderColor: "#ffffff",
    background: "linear-gradient(180deg, #ffffff 0%, #e5efff 100%)",
    boxShadow: "0 16px 30px rgba(0,0,0,0.24)",
    transform: "translateY(-1px)",
  },
  "&.Mui-disabled": {
    color: "rgba(31,35,40,0.55)",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(255,255,255,0.45)",
  },
};

const oauthYandexButtonSx = {
  ...oauthButtonBaseSx,
  color: "#f8fbff",
  borderColor: "rgba(255,86,86,0.6)",
  background: "linear-gradient(155deg, #26171f 0%, #19121a 100%)",
  "&:hover": {
    borderColor: "rgba(255,110,110,0.9)",
    background: "linear-gradient(155deg, #32202a 0%, #241722 100%)",
    boxShadow: "0 16px 30px rgba(146,44,60,0.3)",
    transform: "translateY(-1px)",
  },
  "&.Mui-disabled": {
    color: "rgba(244,248,255,0.55)",
    background: "rgba(32,23,30,0.7)",
    borderColor: "rgba(255,91,91,0.3)",
  },
};

const oauthVkButtonSx = {
  ...oauthButtonBaseSx,
  color: "#edf6ff",
  borderColor: "rgba(144,200,255,0.82)",
  background: "linear-gradient(135deg, #3282ff 0%, #215fdb 100%)",
  "&:hover": {
    borderColor: "rgba(166,214,255,0.95)",
    background: "linear-gradient(135deg, #428fff 0%, #2f6ee6 100%)",
    boxShadow: "0 16px 32px rgba(33,105,231,0.4)",
    transform: "translateY(-1px)",
  },
  "&.Mui-disabled": {
    color: "rgba(237,246,255,0.62)",
    background: "rgba(41,103,198,0.7)",
    borderColor: "rgba(122,185,255,0.35)",
  },
};

const oauthTelegramShellSx = {
  borderRadius: 2.8,
  border: `1.3px solid ${alpha("#89c7ff", 0.78)}`,
  background: "linear-gradient(140deg, rgba(33,97,177,0.5) 0%, rgba(27,72,142,0.46) 100%)",
  minHeight: AUTH_PROVIDER_BUTTON_HEIGHT,
  px: 0.75,
  py: 0.72,
  display: "flex",
  alignItems: "center",
  boxShadow: "0 12px 26px rgba(14,55,114,0.34), inset 0 1px 0 rgba(255,255,255,0.14)",
};

const oauthTelegramFallbackButtonSx = {
  ...oauthButtonBaseSx,
  minHeight: AUTH_PROVIDER_BUTTON_HEIGHT - 8,
  borderRadius: 2.5,
  fontSize: { xs: 15, sm: 16 },
  px: 1.5,
  color: "#eaf6ff",
  borderColor: "rgba(148,206,255,0.85)",
  background: "linear-gradient(135deg, #2ea3f2 0%, #247fe0 52%, #1f66cb 100%)",
  boxShadow: "0 12px 24px rgba(20,88,175,0.32)",
  "&:hover": {
    borderColor: "rgba(168,219,255,0.95)",
    background: "linear-gradient(135deg, #3ab0ff 0%, #2d8bed 52%, #2872da 100%)",
    boxShadow: "0 14px 28px rgba(26,96,188,0.42)",
    transform: "translateY(-1px)",
  },
};

const providerBadgeSx = {
  width: 27,
  height: 27,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
  flexShrink: 0,
  border: "1px solid rgba(255,255,255,0.28)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 14px rgba(0,0,0,0.28)",
};

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
    if (setupLoading || requiresSetup || !BOT_USERNAME) {
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
  }, [setupLoading, requiresSetup, telegramWidgetReloadKey]);

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
            position: "relative",
            overflow: "hidden",
            borderRadius: 3.5,
            p: { xs: 2.1, md: 3.1 },
            border: "1px solid rgba(126,171,232,0.34)",
            background:
              "linear-gradient(165deg, rgba(24,37,69,0.97) 0%, rgba(15,27,53,0.96) 55%, rgba(9,18,39,0.98) 100%)",
            boxShadow: "0 24px 56px rgba(0,0,0,0.42)",
            backdropFilter: "blur(10px)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(360px 220px at 100% -15%, rgba(92,163,255,0.24) 0%, rgba(92,163,255,0) 62%), radial-gradient(320px 180px at -5% 110%, rgba(26,169,127,0.16) 0%, rgba(26,169,127,0) 66%)",
              pointerEvents: "none",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: "linear-gradient(90deg, rgba(138,192,255,0.14) 0%, rgba(167,212,255,0.62) 50%, rgba(138,192,255,0.14) 100%)",
              pointerEvents: "none",
            },
          }}
        >
          <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 30, md: 40 },
                  lineHeight: 1.05,
                  letterSpacing: -0.4,
                  fontFamily: "'Sora', 'Manrope', sans-serif",
                  color: "#f2f8ff",
                }}
              >
                {requiresSetup ? "Первичная настройка" : "Вход в систему"}
              </Typography>
              {!requiresSetup ? (
                <Chip
                  label="Безопасный вход"
                  sx={{
                    color: "#d9ecff",
                    border: "1px solid rgba(118,173,255,0.52)",
                    bgcolor: "rgba(79,138,235,0.18)",
                    fontWeight: 700,
                    borderRadius: 1.2,
                  }}
                />
              ) : null}
            </Stack>

            <Typography sx={{ color: "rgba(204,221,244,0.82)", fontSize: 14.2 }}>
              {requiresSetup
                ? "Создайте первого администратора для запуска платформы."
                : "Авторизация через Google, Яндекс, VK, Telegram или логин/пароль."}
            </Typography>

            {error ? (
              <Alert
                severity="error"
                sx={{
                  borderRadius: 1.6,
                  border: "1px solid rgba(255, 129, 129, 0.28)",
                  bgcolor: "rgba(78, 25, 26, 0.78)",
                }}
              >
                {error}
              </Alert>
            ) : null}
            {success ? (
              <Alert
                severity="success"
                sx={{
                  borderRadius: 1.6,
                  border: "1px solid rgba(116, 220, 165, 0.28)",
                  bgcolor: "rgba(17, 56, 39, 0.76)",
                }}
              >
                {success}
              </Alert>
            ) : null}

            {requiresSetup ? (
              <Box component="form" onSubmit={submitBootstrap}>
                <Stack spacing={1.35}>
                  <Alert severity="info">После создания администратора вход будет доступен всем ролям.</Alert>
                  <TextField
                    required
                    label="Логин администратора"
                    value={setupForm.username}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, username: e.target.value }))}
                    sx={authInputSx}
                  />
                  <TextField
                    required
                    label="Пароль"
                    type="password"
                    value={setupForm.password}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, password: e.target.value }))}
                    sx={authInputSx}
                  />
                  <TextField
                    required
                    label="Подтверждение пароля"
                    type="password"
                    value={setupForm.passwordConfirm}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
                    sx={authInputSx}
                  />
                  <TextField
                    label="Имя"
                    value={setupForm.first_name}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    sx={authInputSx}
                  />
                  <TextField
                    label="Фамилия"
                    value={setupForm.last_name}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    sx={authInputSx}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ mt: 0.5, ...authPrimaryButtonSx }}
                  >
                    {loading ? "Создаем администратора..." : "Создать администратора и войти"}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={1.4}>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.2,
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    onClick={() => startOAuthLogin("google")}
                    sx={oauthGoogleButtonSx}
                    startIcon={
                      <Box sx={{ ...providerBadgeSx, color: "#4285f4", bgcolor: "rgba(255,255,255,0.98)" }}>
                        <GoogleIcon sx={{ fontSize: 19 }} />
                      </Box>
                    }
                  >
                    Войти через Google
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    onClick={() => startOAuthLogin("yandex")}
                    sx={oauthYandexButtonSx}
                    startIcon={
                      <Box
                        sx={{
                          ...providerBadgeSx,
                          color: "#ff3d3d",
                          bgcolor: "rgba(255,255,255,0.96)",
                          borderColor: "rgba(255,95,95,0.46)",
                          fontSize: 16,
                          fontWeight: 900,
                        }}
                      >
                        Я
                      </Box>
                    }
                  >
                    Войти через Яндекс
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    onClick={() => startOAuthLogin("vk")}
                    sx={{ ...oauthVkButtonSx, gridColumn: { xs: "1", sm: "1 / -1" } }}
                    startIcon={
                      <Box
                        sx={{
                          ...providerBadgeSx,
                          color: "#ffffff",
                          bgcolor: "rgba(17,77,173,0.9)",
                          borderColor: "rgba(174,214,255,0.45)",
                        }}
                      >
                        VK
                      </Box>
                    }
                  >
                    Войти через VK
                  </Button>
                </Box>

                {!BOT_USERNAME ? (
                  <Typography
                    variant="caption"
                    color="rgba(196,219,246,0.88)"
                    sx={{ px: 0.2 }}
                  >
                    Telegram-вход временно недоступен: не задано имя бота.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    <Box sx={oauthTelegramShellSx}>
                      <Box
                        id="telegram-login-container"
                        ref={telegramContainerRef}
                        sx={{
                          width: "100%",
                          minHeight: AUTH_PROVIDER_BUTTON_HEIGHT - 8,
                          display: "flex",
                          alignItems: "center",
                          borderRadius: 2.2,
                          overflow: "hidden",
                          "& > *": {
                            width: "100% !important",
                            maxWidth: "100% !important",
                          },
                          "& iframe": {
                            width: "100% !important",
                            minWidth: "100% !important",
                            maxWidth: "100% !important",
                            minHeight: `${AUTH_PROVIDER_BUTTON_HEIGHT - 8}px !important`,
                          },
                          "& a": {
                            width: "100% !important",
                            maxWidth: "100% !important",
                          },
                        }}
                      />
                    </Box>

                    {telegramWidgetError ? (
                      <Stack spacing={1}>
                        <Typography variant="caption" color="rgba(205,223,245,0.9)" sx={{ px: 0.25 }}>
                          {telegramWidgetError}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TelegramIcon sx={{ fontSize: 18 }} />}
                            onClick={() => {
                              telegramWidgetRetryRef.current = 0;
                              setTelegramWidgetReloadKey((prev) => prev + 1);
                            }}
                            sx={{ ...oauthTelegramFallbackButtonSx, minHeight: 44, flex: 1 }}
                          >
                            Перезагрузить Telegram вход
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TelegramIcon sx={{ fontSize: 18 }} />}
                            component="a"
                            href={`https://t.me/${BOT_USERNAME}`}
                            target="_blank"
                            rel="noreferrer"
                            sx={{
                              flex: 1,
                              minHeight: 44,
                              borderRadius: 2.2,
                              px: 1.4,
                              fontWeight: 700,
                              borderColor: "rgba(121,195,255,0.72)",
                              color: "#b6e2ff",
                              background: "linear-gradient(145deg, rgba(17,45,82,0.45) 0%, rgba(12,33,63,0.45) 100%)",
                              "&:hover": {
                                borderColor: "rgba(150,214,255,0.94)",
                                background: "linear-gradient(145deg, rgba(25,62,108,0.65) 0%, rgba(16,46,84,0.65) 100%)",
                              },
                            }}
                          >
                            Открыть @{BOT_USERNAME}
                          </Button>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                )}

                <Divider sx={{ color: "rgba(194,214,243,0.66)", fontSize: 12, "&::before, &::after": { borderColor: "rgba(140,177,229,0.34)" } }}>
                  или вход по логину/паролю
                </Divider>

                <Box component="form" onSubmit={submitPasswordLogin}>
                  <Stack spacing={1.2}>
                    <TextField
                      required
                      label="Логин"
                      autoComplete="username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                      sx={authInputSx}
                    />
                    <TextField
                      required
                      label="Пароль"
                      type="password"
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      sx={authInputSx}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      sx={{ mt: 0.5, ...authPrimaryButtonSx }}
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
