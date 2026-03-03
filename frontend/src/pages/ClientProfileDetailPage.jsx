import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { authApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";

dayjs.locale("ru");

function formatDate(value) {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD.MM.YYYY HH:mm") : String(value);
}

function formatPercent(value) {
  if (value == null) return "0%";
  return `${Math.round(Number(value) * 100)}%`;
}

function resolveRiskLabel(level) {
  if (level === "critical") return "Критический";
  if (level === "high") return "Высокий";
  if (level === "medium") return "Средний";
  return "Низкий";
}

function resolveRiskColor(level) {
  if (level === "critical") return "error";
  if (level === "high") return "warning";
  if (level === "medium") return "info";
  return "success";
}

function resolveWholesaleStatusLabel(status) {
  if (status === "approved") return "Оптовый сервис подтвержден";
  if (status === "pending") return "Оптовый статус на проверке";
  if (status === "rejected") return "Оптовый статус отклонен";
  return "Обычный клиент";
}

function StatCard({ title, value, helper }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 2.2,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.35, fontWeight: 800 }}>
        {value}
      </Typography>
      {helper ? (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}

export default function ClientProfileDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.clientProfile(clientId);
      setProfile(data);
    } catch (requestError) {
      const detail = requestError?.response?.data?.detail;
      setError(detail || "Не удалось загрузить профиль клиента");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const stats = profile?.client_stats || {};
  const riskLabel = resolveRiskLabel(stats.risk_level);
  const riskColor = resolveRiskColor(stats.risk_level);
  const wholesaleLabel = resolveWholesaleStatusLabel(profile?.wholesale_status);
  const backPath = user?.role === "admin" ? "/admin/clients" : "/master/active";

  const servicePhotoLinks = useMemo(
    () => [profile?.wholesale_service_photo_1_url, profile?.wholesale_service_photo_2_url].filter(Boolean),
    [profile?.wholesale_service_photo_1_url, profile?.wholesale_service_photo_2_url]
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: "42vh", display: "grid", placeItems: "center" }}>
        <Stack spacing={1} alignItems="center">
          <CircularProgress size={30} />
          <Typography variant="body2" color="text.secondary">
            Загружаем профиль клиента...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Stack spacing={1.2}>
        <Alert severity="error">{error}</Alert>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={loadProfile}>
            Повторить
          </Button>
          <Button variant="text" onClick={() => navigate(backPath)}>
            Назад
          </Button>
        </Stack>
      </Stack>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <Stack spacing={1.5} sx={{ width: "100%", minWidth: 0, overflowX: "clip" }}>
      <Paper sx={{ p: 2, borderRadius: 2.8 }}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Stack spacing={0.4}>
              <Typography variant="h2" sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" } }}>
                Профиль клиента: {profile.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Создан: {formatDate(profile.created_at)}
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackRoundedIcon fontSize="small" />}
              onClick={() => navigate(backPath)}
            >
              Назад
            </Button>
          </Stack>

          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              icon={<ShieldRoundedIcon fontSize="small" />}
              color={riskColor}
              label={`Риск: ${riskLabel}${stats.risk_score != null ? ` (${stats.risk_score})` : ""}`}
            />
            <Chip
              size="small"
              icon={<StorefrontRoundedIcon fontSize="small" />}
              label={wholesaleLabel}
              color={profile.wholesale_status === "approved" ? "success" : "default"}
              variant={profile.wholesale_status === "approved" ? "filled" : "outlined"}
            />
            {profile.is_banned ? (
              <Chip size="small" icon={<BlockRoundedIcon fontSize="small" />} color="error" label="Клиент забанен" />
            ) : (
              <Chip size="small" label="Клиент активен" color="success" variant="outlined" />
            )}
            {profile.telegram_username ? (
              <Chip size="small" label={`Telegram: @${profile.telegram_username}`} variant="outlined" />
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
          width: "100%",
          minWidth: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <StatCard title="Всего заявок" value={profile.appointments_total || 0} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatCard title="Активные" value={profile.appointments_active || 0} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatCard title="Завершенные" value={profile.appointments_completed || 0} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatCard title="Последняя активность" value={formatDate(profile.last_appointment_at)} />
        </Box>
      </Box>

      <Paper
        sx={{
          p: 2,
          borderRadius: 2.8,
          "& .MuiTypography-body2": { overflowWrap: "anywhere" },
        }}
      >
        <Stack spacing={0.75}>
          <Typography variant="h3">Риск и поведение</Typography>
          <Typography variant="body2">
            Уровень риска: <b>{riskLabel}</b>
            {stats.risk_score != null ? ` • score ${stats.risk_score}` : ""}
          </Typography>
          <Typography variant="body2">
            Средняя оценка: <b>{Number(stats.average_rating || 0).toFixed(1)}</b>
          </Typography>
          <Typography variant="body2">
            Доля отмен: <b>{formatPercent(stats.cancellation_rate)}</b>
          </Typography>
          <Typography variant="body2">
            Завершено: <b>{stats.completed_orders_count || 0}</b> • Отменено: <b>{stats.cancelled_orders_count || 0}</b>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Обновлено: {formatDate(stats.risk_updated_at)}
          </Typography>
        </Stack>
      </Paper>

      <Paper
        sx={{
          p: 2,
          borderRadius: 2.8,
          "& .MuiTypography-body2": { overflowWrap: "anywhere" },
        }}
      >
        <Stack spacing={0.8}>
          <Typography variant="h3">Данные сервисного центра</Typography>
          <Typography variant="body2">
            Режим: <b>{profile.is_service_center ? "Сервисный центр" : "Обычный клиент"}</b>
          </Typography>
          <Typography variant="body2">
            Компания: <b>{profile.wholesale_company_name || "—"}</b>
          </Typography>
          <Typography variant="body2">
            Комментарий: <b>{profile.wholesale_comment || "—"}</b>
          </Typography>
          <Typography variant="body2">
            Описание сервиса: <b>{profile.wholesale_service_details || "—"}</b>
          </Typography>
          <Typography variant="body2">
            Запросил опт: <b>{formatDate(profile.wholesale_requested_at)}</b>
          </Typography>
          <Typography variant="body2">
            Проверено админом: <b>{formatDate(profile.wholesale_reviewed_at)}</b>
          </Typography>
          <Typography variant="body2">
            Комментарий проверки: <b>{profile.wholesale_review_comment || "—"}</b>
          </Typography>
          {servicePhotoLinks.length ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {servicePhotoLinks.map((link, index) => (
                <Button
                  key={link}
                  variant="outlined"
                  size="small"
                  component="a"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Фото сервиса {index + 1}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {profile.is_banned ? (
        <Alert severity="error" icon={<WarningAmberRoundedIcon />}>
          Клиент заблокирован.
          {profile.ban_reason ? ` Причина: ${profile.ban_reason}` : ""}
          {profile.banned_at ? ` (${formatDate(profile.banned_at)})` : ""}
        </Alert>
      ) : null}
    </Stack>
  );
}
