import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Alert, Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

dayjs.locale("ru");

function resolveRiskLabel(level) {
  if (level === "critical") return "Критический";
  if (level === "high") return "Высокий";
  if (level === "medium") return "Средний";
  return "Низкий";
}

function resolveLevelLabel(level) {
  if (level === "pro") return "Pro";
  if (level === "advanced") return "Продвинутый";
  if (level === "newbie") return "Новичок";
  return "Базовый";
}

function resolveWholesaleLabel(status) {
  if (status === "approved") return "Одобрено";
  if (status === "pending") return "На рассмотрении";
  if (status === "rejected") return "Отклонено";
  return "Не запрошено";
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
        p: 1.2,
        borderRadius: 2.8,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Stack spacing={0.55}>
        <Stack direction="row" spacing={0.7} alignItems="center">
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
  const wholesaleDiscount = Number(user?.wholesale_discount_percent || 0);
  const [serviceForm, setServiceForm] = useState({
    wholesale_company_name: user?.wholesale_company_name || "",
    wholesale_comment: user?.wholesale_comment || "",
    wholesale_service_details: user?.wholesale_service_details || "",
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

  const riskLabel = resolveRiskLabel(stats.risk_level);
  const levelLabel = resolveLevelLabel(stats.level);
  const wholesaleLabel = resolveWholesaleLabel(user?.wholesale_status);
  const isWholesaleApproved = user?.wholesale_status === "approved";
  const hasExistingServicePhoto = Boolean(user?.wholesale_service_photo_1_url || user?.wholesale_service_photo_2_url);

  const updateServiceField = (key, value) => {
    setServiceForm((prev) => ({ ...prev, [key]: value }));
    if (requestError) {
      setRequestError("");
    }
    if (requestSuccess) {
      setRequestSuccess("");
    }
  };

  const submitWholesaleRequest = async () => {
    const company = (serviceForm.wholesale_company_name || "").trim();
    const details = (serviceForm.wholesale_service_details || "").trim();
    if (!company) {
      setRequestError("Укажите название сервисного центра");
      return;
    }
    if (details.length < 20) {
      setRequestError("Добавьте описание сервиса минимум 20 символов");
      return;
    }
    if (!serviceForm.wholesale_service_photo_1 && !serviceForm.wholesale_service_photo_2 && !hasExistingServicePhoto) {
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
      payload.append("wholesale_comment", (serviceForm.wholesale_comment || "").trim());
      payload.append("wholesale_service_details", details);
      if (serviceForm.wholesale_service_photo_1) {
        payload.append("wholesale_service_photo_1", serviceForm.wholesale_service_photo_1);
      }
      if (serviceForm.wholesale_service_photo_2) {
        payload.append("wholesale_service_photo_2", serviceForm.wholesale_service_photo_2);
      }
      await authApi.requestWholesale(payload);
      await reloadMe();
      setRequestSuccess("Заявка на оптовый статус отправлена. Ожидайте проверку администратора.");
      setServiceForm((prev) => ({
        ...prev,
        wholesale_service_photo_1: null,
        wholesale_service_photo_2: null,
      }));
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setRequestError(detail || "Не удалось отправить заявку на оптовый статус");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Paper
        sx={{
          p: { xs: 1.5, md: 2.2 },
          borderRadius: 3.6,
          border: "1px solid",
          borderColor: "divider",
          background: isDark
            ? "linear-gradient(145deg, rgba(10,19,31,0.95) 0%, rgba(17,31,51,0.92) 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.92) 100%)",
        }}
      >
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1.1} alignItems="center">
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
                background: "linear-gradient(135deg, #0e74ff 0%, #38a1ff 100%)",
                boxShadow: "0 10px 22px rgba(14,116,255,0.32)",
              }}
            >
              {avatarText}
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
            <Chip size="small" label={`Риск: ${riskLabel}`} variant="outlined" />
            <Chip
              size="small"
              icon={<StorefrontRoundedIcon />}
              label={`Опт: ${wholesaleLabel}${wholesaleDiscount > 0 ? ` (${wholesaleDiscount}%)` : ""}`}
              variant={user?.wholesale_status === "approved" ? "filled" : "outlined"}
              color={user?.wholesale_status === "approved" ? "success" : "default"}
            />
            {user?.telegram_username ? (
              <Chip size="small" label={`Telegram: @${user.telegram_username}`} variant="outlined" />
            ) : null}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            В профиле только главное: прогресс, надежность и быстрые действия.
          </Typography>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
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

      <Paper sx={{ p: 1.4, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h3">Статус сервиса</Typography>
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              icon={<StorefrontRoundedIcon />}
              label={isWholesaleApproved ? "Оптовый сервис" : "Обычный клиент"}
              color={isWholesaleApproved ? "success" : "default"}
              variant={isWholesaleApproved ? "filled" : "outlined"}
            />
            <Chip
              label={`Статус: ${wholesaleLabel}${wholesaleDiscount > 0 ? ` (${wholesaleDiscount}%)` : ""}`}
              variant="outlined"
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {isWholesaleApproved
              ? `Ваш профиль отмечен как оптовый сервис. Мастер видит эту пометку и учитывает условия вручную.`
              : user?.wholesale_status === "pending"
                ? "Заявка на оптовый статус отправлена. После проверки появится пометка в профиле."
                : "Оптовый статус оформляется только в профиле, в заявке этот блок больше не показывается."}
          </Typography>

          {!isWholesaleApproved ? (
            <Stack spacing={1}>
              {requestError ? <Alert severity="error">{requestError}</Alert> : null}
              {requestSuccess ? <Alert severity="success">{requestSuccess}</Alert> : null}
              <TextField
                label="Название сервиса"
                value={serviceForm.wholesale_company_name}
                onChange={(event) => updateServiceField("wholesale_company_name", event.target.value)}
                placeholder="Например: ServiceHub Москва"
              />
              <TextField
                label="Описание сервиса"
                multiline
                minRows={3}
                value={serviceForm.wholesale_service_details}
                onChange={(event) => updateServiceField("wholesale_service_details", event.target.value)}
                placeholder="Какие устройства обслуживаете, средний поток заявок, специализация"
                helperText="Минимум 20 символов"
              />
              <TextField
                label="Комментарий (опционально)"
                multiline
                minRows={2}
                value={serviceForm.wholesale_comment}
                onChange={(event) => updateServiceField("wholesale_comment", event.target.value)}
                placeholder="Город, график, дополнительные данные"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
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
                    onChange={(event) => updateServiceField("wholesale_service_photo_1", event.target.files?.[0] || null)}
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
                    onChange={(event) => updateServiceField("wholesale_service_photo_2", event.target.files?.[0] || null)}
                  />
                </Button>
              </Stack>
              {serviceForm.wholesale_service_photo_1 ? (
                <Typography variant="caption" color="text.secondary">
                  Фото 1: {serviceForm.wholesale_service_photo_1.name}
                </Typography>
              ) : null}
              {serviceForm.wholesale_service_photo_2 ? (
                <Typography variant="caption" color="text.secondary">
                  Фото 2: {serviceForm.wholesale_service_photo_2.name}
                </Typography>
              ) : null}
              {hasExistingServicePhoto ? (
                <Typography variant="caption" color="text.secondary">
                  Фото сервиса уже сохранены в профиле, можно отправить без повторной загрузки.
                </Typography>
              ) : null}
              <Button
                variant="contained"
                onClick={submitWholesaleRequest}
                disabled={requestLoading}
                sx={{ alignSelf: "flex-start" }}
              >
                {requestLoading ? "Отправляем..." : "Отправить заявку на оптовый статус"}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.4, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h3">Быстрые действия</Typography>
          <Typography variant="caption" color="text.secondary">
            Один клик на основное действие, без перегрузки.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
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

      <Paper sx={{ p: 1.3, borderRadius: 3 }}>
        <Stack spacing={0.9}>
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
