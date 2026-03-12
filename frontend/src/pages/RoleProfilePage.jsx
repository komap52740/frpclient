import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import { authApi } from "../api/client";
import { useAuth } from "../features/auth/hooks/useAuth";

function getRoleTitle(role) {
  if (role === "master") return "Профиль мастера";
  if (role === "admin") return "Профиль администратора";
  return "Профиль пользователя";
}

function getRoleLabel(role) {
  if (role === "master") return "Мастер";
  if (role === "admin") return "Администратор";
  return "Пользователь";
}

export default function RoleProfilePage() {
  const { user, reloadMe } = useAuth();
  const theme = useTheme();

  const [form, setForm] = useState({
    username: "",
    profile_photo: null,
    remove_profile_photo: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm({
      username: user?.username || "",
      profile_photo: null,
      remove_profile_photo: false,
    });
  }, [user?.username]);

  const avatarUrl = user?.profile_photo_url || user?.telegram_photo_url || "";
  const avatarText = useMemo(() => {
    const raw = (user?.username || "Пользователь").trim();
    return raw.slice(0, 2).toUpperCase();
  }, [user?.username]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setSuccess("");
  };

  const submit = async () => {
    const nextUsername = (form.username || "").trim();
    if (nextUsername.length < 3) {
      setError("Ник должен содержать минимум 3 символа.");
      return;
    }

    const usernameChanged = nextUsername !== (user?.username || "");
    const photoChanged = Boolean(form.profile_photo) || Boolean(form.remove_profile_photo);
    if (!usernameChanged && !photoChanged) {
      setError("Нет изменений для сохранения.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload = new FormData();
      payload.append("username", nextUsername);
      if (form.profile_photo) {
        payload.append("profile_photo", form.profile_photo);
      } else if (form.remove_profile_photo) {
        payload.append("remove_profile_photo", "true");
      }
      await authApi.updateProfile(payload);
      await reloadMe();
      setSuccess("Профиль обновлен.");
      setForm((prev) => ({
        ...prev,
        username: nextUsername,
        profile_photo: null,
        remove_profile_photo: false,
      }));
    } catch (requestError) {
      const detail = requestError?.response?.data?.detail;
      const usernameError = requestError?.response?.data?.username?.[0];
      const photoError = requestError?.response?.data?.profile_photo?.[0];
      setError(detail || usernameError || photoError || "Не удалось обновить профиль.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 1.6, md: 2.2 },
          borderRadius: 1.8,
          border: "1px solid",
          borderColor: "divider",
          background: (themeValue) =>
            themeValue.palette.mode === "dark"
              ? "linear-gradient(145deg, rgba(10,19,31,0.95) 0%, rgba(17,31,51,0.92) 100%)"
              : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.92) 100%)",
        }}
      >
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: "0.02em",
                color: "#fff",
                background: avatarUrl
                  ? `url(${avatarUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, #0e74ff 0%, #38a1ff 100%)",
                boxShadow: "0 10px 22px rgba(14,116,255,0.3)",
                overflow: "hidden",
              }}
            >
              {!avatarUrl ? avatarText : null}
            </Box>

            <Stack spacing={0.3} sx={{ minWidth: 0 }}>
              <Typography variant="h2" sx={{ fontSize: { xs: "1.35rem", md: "1.55rem" } }}>
                {user?.username || "Пользователь"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getRoleTitle(user?.role)}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              icon={<BadgeRoundedIcon />}
              label={getRoleLabel(user?.role)}
              sx={{
                bgcolor: (themeValue) => alpha(themeValue.palette.primary.main, 0.12),
                color: "primary.main",
                fontWeight: 760,
              }}
            />
            {user?.is_master_active ? (
              <Chip
                size="small"
                icon={<CheckCircleRoundedIcon />}
                color="success"
                label="Активен"
              />
            ) : null}
            {user?.telegram_username ? (
              <Chip
                size="small"
                label={`Telegram: @${user.telegram_username}`}
                variant="outlined"
              />
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper
        sx={{
          p: { xs: 1.6, md: 1.9 },
          borderRadius: 1.8,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor:
            theme.palette.mode === "dark" ? "rgba(8, 14, 24, 0.86)" : "rgba(255, 255, 255, 0.95)",
        }}
      >
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={0.9} alignItems="center">
            <PersonRoundedIcon fontSize="small" color="primary" />
            <Typography variant="h3">Публичные данные</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Эти данные видны другим участникам платформы в карточках и чатах.
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}

          <TextField
            label="Ник"
            value={form.username}
            onChange={(event) => updateField("username", event.target.value)}
            inputProps={{ maxLength: 150, autoComplete: "off" }}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AddPhotoAlternateRoundedIcon />}
            >
              {form.profile_photo ? "Заменить фото" : "Загрузить фото"}
              <input
                hidden
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  updateField("profile_photo", event.target.files?.[0] || null);
                  if (event.target.files?.[0]) updateField("remove_profile_photo", false);
                }}
              />
            </Button>
            {avatarUrl ? (
              <Button
                variant={form.remove_profile_photo ? "contained" : "outlined"}
                color={form.remove_profile_photo ? "warning" : "inherit"}
                onClick={() => updateField("remove_profile_photo", !form.remove_profile_photo)}
              >
                {form.remove_profile_photo ? "Фото будет удалено" : "Удалить фото"}
              </Button>
            ) : null}
          </Stack>

          {form.profile_photo ? (
            <Typography variant="caption" color="text.secondary">
              Файл: {form.profile_photo.name}
            </Typography>
          ) : null}

          <Button
            variant="contained"
            onClick={submit}
            disabled={loading}
            sx={{ alignSelf: "flex-start" }}
          >
            {loading ? "Сохраняем..." : "Сохранить профиль"}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
