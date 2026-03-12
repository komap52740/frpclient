import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../../api/client";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { getB2BStatusMeta } from "../../shared/lib/b2bLabels";

dayjs.locale("ru");

function resolveLevelLabel(level) {
  if (level === "pro") return "Pro";
  if (level === "advanced") return "Продвинутый";
  if (level === "newbie") return "Новичок";
  return "Базовый";
}

function formatPercent(value) {
  if (value == null) return "0%";
  return `${Math.round(Number(value) * 100)}%`;
}

function ProfileKpi({ title, value, helper, icon }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.4, md: 1.6 },
        borderRadius: 1.6,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={0.9} alignItems="center">
          {icon}
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 820 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function ClientProfilePage() {
  const { user, reloadMe } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const stats = user?.client_stats || {};
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    profile_photo: null,
    remove_profile_photo: false,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [serviceForm, setServiceForm] = useState({
    wholesale_company_name: user?.wholesale_company_name || "",
    wholesale_city: user?.wholesale_city || "",
    wholesale_address: user?.wholesale_address || "",
    wholesale_service_photo_1: null,
    wholesale_service_photo_2: null,
  });
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  const avatarText = useMemo(() => {
    const username = (user?.username || "Клиент").trim();
    return username.slice(0, 2).toUpperCase();
  }, [user?.username]);
  const avatarUrl = user?.profile_photo_url || user?.telegram_photo_url || "";

  const levelLabel = resolveLevelLabel(stats.level);
  const b2bStatusMeta = getB2BStatusMeta(user?.wholesale_status);
  const isWholesaleApproved = user?.wholesale_status === "approved";
  const hasExistingServicePhoto = Boolean(
    user?.wholesale_service_photo_1_url || user?.wholesale_service_photo_2_url
  );
  const b2bModeLabel =
    user?.wholesale_status === "approved"
      ? "B2B-партнёр"
      : user?.wholesale_status === "pending"
        ? "B2B-заявка в модерации"
        : user?.wholesale_status === "rejected"
          ? "B2B-заявка отклонена"
          : "Базовый аккаунт";
  const b2bModeColor =
    user?.wholesale_status === "approved"
      ? "success"
      : user?.wholesale_status === "pending"
        ? "warning"
        : user?.wholesale_status === "rejected"
          ? "error"
          : "default";

  const updateServiceField = (key, value) => {
    setServiceForm((prev) => ({ ...prev, [key]: value }));
    setRequestError("");
    setRequestSuccess("");
  };

  const updateProfileField = (key, value) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
    setProfileError("");
    setProfileSuccess("");
  };

  const submitProfileUpdate = async () => {
    const nextUsername = (profileForm.username || "").trim();
    if (nextUsername.length < 3) {
      setProfileError("Ник должен содержать минимум 3 символа.");
      return;
    }
    const hasNicknameChanged = nextUsername !== (user?.username || "");
    const hasPhotoChanged =
      Boolean(profileForm.profile_photo) || Boolean(profileForm.remove_profile_photo);
    if (!hasNicknameChanged && !hasPhotoChanged) {
      setProfileError("Нет изменений для сохранения.");
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const payload = new FormData();
      payload.append("username", nextUsername);
      if (profileForm.profile_photo) {
        payload.append("profile_photo", profileForm.profile_photo);
      } else if (profileForm.remove_profile_photo) {
        payload.append("remove_profile_photo", "true");
      }
      await authApi.updateProfile(payload);
      await reloadMe();
      setProfileSuccess("Профиль обновлен.");
      setProfileForm((prev) => ({
        ...prev,
        username: nextUsername,
        profile_photo: null,
        remove_profile_photo: false,
      }));
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const usernameError = error?.response?.data?.username?.[0];
      const photoError = error?.response?.data?.profile_photo?.[0];
      setProfileError(detail || usernameError || photoError || "Не удалось обновить профиль.");
    } finally {
      setProfileLoading(false);
    }
  };

  const submitWholesaleRequest = async () => {
    const company = (serviceForm.wholesale_company_name || "").trim();
    const city = (serviceForm.wholesale_city || "").trim();
    const address = (serviceForm.wholesale_address || "").trim();
    if (!company) {
      setRequestError("Укажите название сервисного центра");
      return;
    }
    if (!city) {
      setRequestError(
        "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0433\u043e\u0440\u043e\u0434 \u0441\u0435\u0440\u0432\u0438\u0441\u043d\u043e\u0433\u043e \u0446\u0435\u043d\u0442\u0440\u0430"
      );
      return;
    }
    if (!address) {
      setRequestError("Укажите адрес сервисного центра");
      return;
    }
    if (
      !serviceForm.wholesale_service_photo_1 &&
      !serviceForm.wholesale_service_photo_2 &&
      !hasExistingServicePhoto
    ) {
      setRequestError("Добавьте хотя бы одно фото сервиса");
      return;
    }

    setRequestLoading(true);
    setRequestError("");
    setRequestSuccess("");
    try {
      const payload = new FormData();
      payload.append("is_service_center", "true");
      payload.append("wholesale_company_name", company);
      payload.append("wholesale_city", city);
      payload.append("wholesale_address", address);
      if (serviceForm.wholesale_service_photo_1)
        payload.append("wholesale_service_photo_1", serviceForm.wholesale_service_photo_1);
      if (serviceForm.wholesale_service_photo_2)
        payload.append("wholesale_service_photo_2", serviceForm.wholesale_service_photo_2);
      await authApi.requestWholesale(payload);
      await reloadMe();
      setRequestSuccess("Заявка на B2B-статус отправлена. Ожидайте проверку администратора.");
      setServiceForm((prev) => ({
        ...prev,
        wholesale_service_photo_1: null,
        wholesale_service_photo_2: null,
      }));
    } catch (error) {
      const responseData = error?.response?.data;
      const detail = responseData?.detail;

      let fieldError = "";
      if (!detail && responseData && typeof responseData === "object") {
        const preferredFields = [
          "wholesale_company_name",
          "wholesale_city",
          "wholesale_address",
          "wholesale_service_photo_1",
          "wholesale_service_photo_2",
          "is_service_center",
        ];

        for (const field of preferredFields) {
          const value = responseData[field];
          if (typeof value === "string" && value) {
            fieldError = value;
            break;
          }
          if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
            fieldError = value[0];
            break;
          }
        }

        if (!fieldError) {
          for (const value of Object.values(responseData)) {
            if (typeof value === "string" && value) {
              fieldError = value;
              break;
            }
            if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
              fieldError = value[0];
              break;
            }
          }
        }
      }

      setRequestError(detail || fieldError || "Не удалось отправить заявку на B2B-статус");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 1.7, md: 2.4 },
          borderRadius: 1.8,
          border: "1px solid",
          borderColor: "divider",
          background: isDark
            ? "linear-gradient(145deg, rgba(10,19,31,0.95) 0%, rgba(17,31,51,0.92) 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.92) 100%)",
        }}
      >
        <Stack spacing={1.4}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: "0.02em",
                color: "#fff",
                background: avatarUrl
                  ? `url(${avatarUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, #0e74ff 0%, #38a1ff 100%)",
                boxShadow: "0 10px 22px rgba(14,116,255,0.32)",
                overflow: "hidden",
              }}
            >
              {!avatarUrl ? avatarText : null}
            </Box>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="h2" sx={{ fontSize: { xs: "1.4rem", md: "1.6rem" } }}>
                {user?.username || "Клиент"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Личный кабинет клиента
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`Уровень: ${levelLabel}`}
              sx={{
                bgcolor: (themeValue) => alpha(themeValue.palette.primary.main, 0.12),
                color: "primary.main",
                fontWeight: 760,
              }}
            />
            <Chip
              size="small"
              icon={<StorefrontRoundedIcon />}
              label={`B2B: ${b2bStatusMeta.label}`}
              variant={b2bStatusMeta.chipVariant}
              color={b2bStatusMeta.chipColor}
            />
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

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
        <ProfileKpi
          title="Завершено"
          value={stats.completed_orders_count || 0}
          helper="Успешно закрытые заявки"
          icon={<CheckCircleRoundedIcon fontSize="small" color="success" />}
        />
        <ProfileKpi
          title="Средняя оценка"
          value={Number(stats.average_rating || 0).toFixed(1)}
          helper="По отзывам после завершения"
          icon={<TrendingUpRoundedIcon fontSize="small" color="primary" />}
        />
        <ProfileKpi
          title="Доля отмен"
          value={formatPercent(stats.cancellation_rate)}
          helper="Ниже — лучше для приоритета"
          icon={<LockRoundedIcon fontSize="small" color="warning" />}
        />
      </Stack>

      <Paper sx={{ p: { xs: 1.6, md: 1.8 }, borderRadius: 1.8 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <PersonRoundedIcon fontSize="small" color="primary" />
            <Typography variant="h3">Публичный профиль</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Ник и фото видят мастер и админ в карточке клиента.
          </Typography>
          {profileError ? <Alert severity="error">{profileError}</Alert> : null}
          {profileSuccess ? <Alert severity="success">{profileSuccess}</Alert> : null}
          <TextField
            label="Ник"
            value={profileForm.username}
            onChange={(event) => updateProfileField("username", event.target.value)}
            inputProps={{ maxLength: 150 }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AddPhotoAlternateRoundedIcon />}
            >
              {profileForm.profile_photo ? "Заменить фото" : "Загрузить фото"}
              <input
                hidden
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  updateProfileField("profile_photo", event.target.files?.[0] || null);
                  if (event.target.files?.[0]) updateProfileField("remove_profile_photo", false);
                }}
              />
            </Button>
            {avatarUrl ? (
              <Button
                variant={profileForm.remove_profile_photo ? "contained" : "outlined"}
                color={profileForm.remove_profile_photo ? "warning" : "inherit"}
                onClick={() =>
                  updateProfileField("remove_profile_photo", !profileForm.remove_profile_photo)
                }
              >
                {profileForm.remove_profile_photo ? "Фото будет удалено" : "Удалить фото"}
              </Button>
            ) : null}
          </Stack>
          {profileForm.profile_photo ? (
            <Typography variant="caption" color="text.secondary">
              Файл: {profileForm.profile_photo.name}
            </Typography>
          ) : null}
          <Button
            variant="contained"
            onClick={submitProfileUpdate}
            disabled={profileLoading}
            sx={{ alignSelf: "flex-start" }}
          >
            {profileLoading ? "Сохраняем..." : "Сохранить профиль"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.6, md: 1.8 }, borderRadius: 1.8 }}>
        <Stack spacing={1.2}>
          <Typography variant="h3">Партнёрский режим</Typography>
          <Stack direction="row" spacing={0.9} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              icon={<StorefrontRoundedIcon />}
              label={b2bModeLabel}
              color={b2bModeColor}
              variant={user?.wholesale_status === "approved" ? "filled" : "outlined"}
            />
            <Chip label={`Статус: ${b2bStatusMeta.label}`} variant="outlined" />
          </Stack>
          {!isWholesaleApproved ? (
            <Stack spacing={1.15}>
              {requestError ? <Alert severity="error">{requestError}</Alert> : null}
              {requestSuccess ? <Alert severity="success">{requestSuccess}</Alert> : null}
              <TextField
                label="Название сервиса"
                required
                value={serviceForm.wholesale_company_name}
                onChange={(event) =>
                  updateServiceField("wholesale_company_name", event.target.value)
                }
                helperText="Обязательно для заявки на B2B-статус"
              />
              <TextField
                label="Город"
                required
                value={serviceForm.wholesale_city}
                onChange={(event) => updateServiceField("wholesale_city", event.target.value)}
                helperText="Обязательно для заявки на B2B-статус"
              />
              <TextField
                label="Адрес сервиса"
                required
                value={serviceForm.wholesale_address}
                onChange={(event) => updateServiceField("wholesale_address", event.target.value)}
                helperText="Обязательно для заявки на B2B-статус"
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AddPhotoAlternateRoundedIcon />}
                >
                  Фото сервиса 1
                  <input
                    hidden
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(event) =>
                      updateServiceField(
                        "wholesale_service_photo_1",
                        event.target.files?.[0] || null
                      )
                    }
                  />
                </Button>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AddPhotoAlternateRoundedIcon />}
                >
                  Фото сервиса 2
                  <input
                    hidden
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(event) =>
                      updateServiceField(
                        "wholesale_service_photo_2",
                        event.target.files?.[0] || null
                      )
                    }
                  />
                </Button>
              </Stack>
              <Button
                variant="contained"
                onClick={submitWholesaleRequest}
                disabled={requestLoading}
                sx={{ alignSelf: "flex-start" }}
              >
                {requestLoading ? "Отправляем..." : "Отправить заявку на B2B-статус"}
              </Button>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              B2B-пометка активна. Мастер и администратор видят этот статус в карточке клиента.
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.6, md: 1.8 }, borderRadius: 1.8 }}>
        <Stack spacing={1.2}>
          <Typography variant="h3">Быстрые действия</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
            <Button
              variant="contained"
              startIcon={<RocketLaunchRoundedIcon />}
              onClick={() => navigate("/client/create")}
              sx={{ minWidth: { xs: "100%", sm: 180 } }}
            >
              Новая заявка
            </Button>
            <Button
              variant="outlined"
              startIcon={<ChatRoundedIcon />}
              onClick={() => navigate("/client/my")}
              sx={{ minWidth: { xs: "100%", sm: 210 } }}
            >
              Открыть мои заявки и чат
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.5, md: 1.7 }, borderRadius: 1.8 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Краткая памятка
          </Typography>
          <Typography variant="body2" color="text.secondary">
            1) Создайте заявку.
            <br />
            2) Держите связь в чате.
            <br />
            3) После оплаты загрузите чек.
          </Typography>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            Обновлено: {dayjs().format("DD.MM.YYYY HH:mm")}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
