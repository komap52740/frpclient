import { Alert, Box, Button, CircularProgress, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
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
  if (typeof data === "string" && data) {
    return data;
  }
  return fallback;
}

export default function LoginPage() {
  const { loginWithTelegram, loginWithPassword } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupLoading, setSetupLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [authMode, setAuthMode] = useState("password");

  const [passwordForm, setPasswordForm] = useState({ username: "", password: "" });
  const [setupForm, setSetupForm] = useState({
    username: "",
    password: "",
    passwordConfirm: "",
    first_name: "",
    last_name: "",
  });

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
    try {
      await loginWithPassword(passwordForm);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Ошибка входа по логину и паролю"));
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        px: 2,
        background: "radial-gradient(circle at top, #e0f4f2 0%, #f8f6f2 60%)",
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 520 }}>
        {setupLoading ? (
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={28} />
            <Typography>Проверка состояния системы...</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h5">{requiresSetup ? "Первичная настройка" : "Вход в систему"}</Typography>

            {error && <Alert severity="error">{error}</Alert>}

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
                  <Button type="submit" variant="contained" disabled={loading}>
                    {loading ? "Выполняется..." : "Создать администратора и войти"}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <>
                <Tabs value={authMode} onChange={(_, value) => setAuthMode(value)}>
                  <Tab value="password" label="Логин и пароль" />
                  <Tab value="telegram" label="Telegram" />
                </Tabs>

                {authMode === "password" ? (
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
                      <Button type="submit" variant="contained" disabled={loading}>
                        {loading ? "Выполняется..." : "Войти"}
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      Авторизуйтесь через Telegram‑виджет.
                    </Typography>
                    {!BOT_USERNAME ? (
                      <Alert severity="warning">Не задано значение `VITE_TELEGRAM_BOT_USERNAME`.</Alert>
                    ) : (
                      <Box id="telegram-login-container" sx={{ minHeight: 48 }} />
                    )}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
