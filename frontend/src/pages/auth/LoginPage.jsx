import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

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
  const { loginWithTelegram, loginWithPassword, loginWithAccessToken } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [setupLoading, setSetupLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [authMode, setAuthMode] = useState("password");

  const [passwordForm, setPasswordForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [setupForm, setSetupForm] = useState({
    username: "",
    password: "",
    passwordConfirm: "",
    first_name: "",
    last_name: "",
  });

  const modeSubtitle = useMemo(() => {
    if (authMode === "oauth") {
      return "Один клик через Google или Яндекс.";
    }
    if (authMode === "register") {
      return "Создайте клиентский аккаунт. Подтверждение придет на email.";
    }
    if (authMode === "telegram") {
      return "Авторизация через Telegram-виджет.";
    }
    return "Вход по логину и паролю.";
  }, [authMode]);

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
    if (requiresSetup) {
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

    if (!oauthAccess && !oauthError && !emailVerified && !emailError) {
      return;
    }

    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);

    if (emailVerified) {
      setSuccess("Email успешно подтвержден. Теперь можно войти.");
      setAuthMode("password");
    }

    if (emailError) {
      setError(emailError);
    }

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
    if (requiresSetup || authMode !== "telegram" || !BOT_USERNAME) {
      return undefined;
    }

    window.onTelegramAuth = async (user) => {
      setLoading(true);
      setError("");
      try {
        await loginWithTelegram(user);
        navigate("/", { replace: true });
      } catch (err) {
        setError(getApiErrorMessage(err, "Ошибка авторизации Telegram"));
      } finally {
        setLoading(false);
      }
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

    const container = document.getElementById("telegram-login-container");
    if (container) {
      container.innerHTML = "";
      container.appendChild(script);
    }

    return () => {
      window.onTelegramAuth = null;
      if (container?.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [authMode, loginWithTelegram, navigate, requiresSetup]);

  const submitPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await loginWithPassword(passwordForm);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Ошибка входа по логину и паролю"));
    } finally {
      setLoading(false);
    }
  };

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

  const submitRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        username: registerForm.username.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
        password_confirm: registerForm.passwordConfirm,
      };
      const response = await authApi.register(payload);
      setSuccess(response?.detail || "Аккаунт создан. Проверьте email и подтвердите регистрацию.");
      setAuthMode("password");
      setRegisterForm({ username: "", email: "", password: "", passwordConfirm: "" });
    } catch (err) {
      setError(getApiErrorMessage(err, "Не удалось зарегистрироваться"));
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
      await authApi.bootstrapAdmin({
        username: setupForm.username,
        password: setupForm.password,
        first_name: setupForm.first_name,
        last_name: setupForm.last_name,
      });
      await loginWithPassword({ username: setupForm.username, password: setupForm.password });
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
            "radial-gradient(75% 60% at 0% 0%, rgba(42, 92, 255, 0.30) 0%, rgba(11, 17, 36, 0.95) 56%, #070c1b 100%)",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography color="rgba(255,255,255,0.88)">Проверка состояния системы...</Typography>
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
          "radial-gradient(75% 60% at 0% 0%, rgba(42, 92, 255, 0.28) 0%, rgba(12, 18, 38, 0.94) 56%, #070c1b 100%)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1100,
          mx: "auto",
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 5,
            minHeight: { xs: 220, md: "100%" },
            p: { xs: 2.5, md: 4.5 },
            border: "1px solid rgba(123, 162, 255, 0.25)",
            background:
              "linear-gradient(155deg, rgba(15,26,53,0.90) 0%, rgba(8,16,36,0.95) 55%, rgba(8,13,28,0.98) 100%)",
            boxShadow: "0 34px 70px rgba(0,0,0,0.42)",
            "&::before": {
              content: "\"\"",
              position: "absolute",
              top: -90,
              right: -70,
              width: 230,
              height: 230,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(84,154,255,0.34) 0%, rgba(84,154,255,0) 72%)",
            },
          }}
        >
          <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1 }}>
            <Chip
              label="FRP Client Platform"
              sx={{
                alignSelf: "flex-start",
                color: "rgba(201,228,255,0.95)",
                bgcolor: "rgba(91,151,255,0.17)",
                border: "1px solid rgba(130,183,255,0.4)",
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
            />
            <Typography
              sx={{
                fontSize: { xs: 32, md: 42 },
                lineHeight: 1.08,
                fontWeight: 800,
                letterSpacing: -0.5,
                color: "#f4f8ff",
                maxWidth: 580,
              }}
            >
              Профессиональный кабинет
              <Box component="span" sx={{ color: "#7ec1ff" }}>
                {" "}
                для удаленной разблокировки
              </Box>
            </Typography>
            <Typography sx={{ color: "rgba(204,223,255,0.80)", fontSize: { xs: 14, md: 16 }, maxWidth: 560 }}>
              Без лишнего шума: вход в 1 шаг, прозрачный статус работ и быстрый диалог с мастером.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {["Google / Яндекс / Telegram", "Безопасный вход", "Мобильный формат 2026"].map((label) => (
                <Chip
                  key={label}
                  label={label}
                  sx={{
                    borderRadius: 2.4,
                    color: "rgba(222,235,255,0.95)",
                    border: "1px solid rgba(137,176,255,0.38)",
                    bgcolor: "rgba(19,36,69,0.76)",
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 5,
            p: { xs: 2.5, md: 3.4 },
            border: "1px solid rgba(132,172,255,0.3)",
            background:
              "linear-gradient(170deg, rgba(27,39,69,0.95) 0%, rgba(18,29,56,0.94) 55%, rgba(15,24,45,0.95) 100%)",
            boxShadow: "0 26px 60px rgba(0,0,0,0.44)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Stack spacing={2.1}>
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 34, md: 38 }, color: "#f7fbff" }}>
              {requiresSetup ? "Первичная настройка" : "Вход в систему"}
            </Typography>
            <Typography sx={{ color: "rgba(210,225,248,0.76)", fontSize: 14 }}>
              {requiresSetup ? "Создайте первого администратора для запуска платформы." : modeSubtitle}
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            {requiresSetup ? (
              <Box component="form" onSubmit={submitBootstrap}>
                <Stack spacing={1.5}>
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
                      borderRadius: 2.2,
                      py: 1.3,
                      textTransform: "none",
                      fontWeight: 700,
                      boxShadow: "0 12px 32px rgba(88,157,255,0.36)",
                    }}
                  >
                    {loading ? "Выполняется..." : "Создать администратора и войти"}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    borderRadius: 2.8,
                    p: 0.6,
                    border: "1px solid rgba(120,164,255,0.28)",
                    bgcolor: "rgba(12,20,40,0.64)",
                  }}
                >
                  <Tabs
                    value={authMode}
                    onChange={(_, value) => setAuthMode(value)}
                    variant="fullWidth"
                    sx={{
                      minHeight: 44,
                      "& .MuiTabs-indicator": {
                        height: "100%",
                        borderRadius: 2,
                        bgcolor: "rgba(99,162,255,0.22)",
                        border: "1px solid rgba(139,188,255,0.46)",
                      },
                    }}
                  >
                    <Tab sx={{ zIndex: 1, minHeight: 44, textTransform: "none", fontWeight: 700 }} value="oauth" label="Google / Яндекс" />
                    <Tab sx={{ zIndex: 1, minHeight: 44, textTransform: "none", fontWeight: 700 }} value="register" label="Регистрация" />
                    <Tab sx={{ zIndex: 1, minHeight: 44, textTransform: "none", fontWeight: 700 }} value="password" label="Логин" />
                    <Tab sx={{ zIndex: 1, minHeight: 44, textTransform: "none", fontWeight: 700 }} value="telegram" label="Telegram" />
                  </Tabs>
                </Box>

                {authMode === "oauth" ? (
                  <Stack spacing={1.4}>
                    <Button
                      variant="contained"
                      disabled={loading}
                      onClick={() => startOAuthLogin("google")}
                      sx={{
                        borderRadius: 2.2,
                        py: 1.25,
                        textTransform: "none",
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        background: "linear-gradient(135deg, #66a9ff 0%, #3a7fff 100%)",
                        boxShadow: "0 10px 30px rgba(62,133,255,0.34)",
                      }}
                    >
                      Войти через Google
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={loading}
                      onClick={() => startOAuthLogin("yandex")}
                      sx={{
                        borderRadius: 2.2,
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
                ) : authMode === "register" ? (
                  <Box component="form" onSubmit={submitRegister}>
                    <Stack spacing={1.5}>
                      <TextField
                        required
                        label="Ник"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
                      />
                      <TextField
                        required
                        type="email"
                        label="Email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                      <TextField
                        required
                        type="password"
                        label="Пароль"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                      />
                      <TextField
                        required
                        type="password"
                        label="Подтверждение пароля"
                        value={registerForm.passwordConfirm}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        sx={{
                          borderRadius: 2.2,
                          py: 1.25,
                          textTransform: "none",
                          fontWeight: 700,
                          background: "linear-gradient(135deg, #66a9ff 0%, #3a7fff 100%)",
                          boxShadow: "0 10px 30px rgba(62,133,255,0.34)",
                        }}
                      >
                        {loading ? "Выполняется..." : "Зарегистрироваться"}
                      </Button>
                    </Stack>
                  </Box>
                ) : authMode === "password" ? (
                  <Box component="form" onSubmit={submitPassword}>
                    <Stack spacing={1.5}>
                      <TextField
                        required
                        label="Логин"
                        value={passwordForm.username}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, username: e.target.value }))}
                      />
                      <TextField
                        required
                        type="password"
                        label="Пароль"
                        value={passwordForm.password}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        sx={{
                          borderRadius: 2.2,
                          py: 1.25,
                          textTransform: "none",
                          fontWeight: 700,
                          background: "linear-gradient(135deg, #66a9ff 0%, #3a7fff 100%)",
                          boxShadow: "0 10px 30px rgba(62,133,255,0.34)",
                        }}
                      >
                        {loading ? "Выполняется..." : "Войти"}
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {!BOT_USERNAME ? (
                      <Alert severity="warning">Не задано значение `VITE_TELEGRAM_BOT_USERNAME`.</Alert>
                    ) : (
                      <Box
                        id="telegram-login-container"
                        sx={{
                          minHeight: 48,
                          p: 1.2,
                          borderRadius: 2,
                          border: `1px solid ${alpha("#86bdff", 0.45)}`,
                          bgcolor: alpha("#0e2042", 0.46),
                        }}
                      />
                    )}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
