import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

function getTelegramErrorMessage(error) {
  const data = error?.response?.data;
  const status = error?.response?.status;

  if (!data) {
    if (status) {
      return `Ошибка авторизации Telegram (HTTP ${status})`;
    }
    return `Ошибка авторизации Telegram: ${error?.message || "нет ответа от сервера"}`;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data.detail === "string" && data.detail) {
    return data.detail;
  }

  if (Array.isArray(data.non_field_errors) && typeof data.non_field_errors[0] === "string") {
    return data.non_field_errors[0];
  }

  const firstKey = Object.keys(data)[0];
  const firstValue = firstKey ? data[firstKey] : null;
  if (typeof firstValue === "string") {
    return firstValue;
  }
  if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
    return firstValue[0];
  }

  if (status) {
    return `Ошибка авторизации Telegram (HTTP ${status})`;
  }
  return "Ошибка авторизации Telegram";
}

export default function LoginPage() {
  const { loginWithTelegram } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!BOT_USERNAME) {
      return undefined;
    }

    window.onTelegramAuth = async (user) => {
      setLoading(true);
      setError("");
      try {
        await loginWithTelegram(user);
        navigate("/", { replace: true });
      } catch (err) {
        setError(getTelegramErrorMessage(err));
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
    container?.appendChild(script);

    return () => {
      window.onTelegramAuth = null;
      if (container?.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [loginWithTelegram, navigate]);

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
      <Paper sx={{ p: 4, width: "100%", maxWidth: 460 }}>
        <Typography variant="h5" mb={1}>Вход в систему</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Авторизуйтесь через виджет входа Telegram.
        </Typography>

        {!BOT_USERNAME && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Не задан `VITE_TELEGRAM_BOT_USERNAME`.
          </Alert>
        )}

        <Box id="telegram-login-container" sx={{ minHeight: 48 }} />

        {loading && <CircularProgress size={24} sx={{ mt: 2 }} />}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>
    </Box>
  );
}
