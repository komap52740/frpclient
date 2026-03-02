import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const stats = user?.client_stats || {};

  const avatarText = useMemo(() => {
    const username = (user?.username || "Клиент").trim();
    return username.slice(0, 2).toUpperCase();
  }, [user?.username]);

  const riskLabel = resolveRiskLabel(stats.risk_level);
  const levelLabel = resolveLevelLabel(stats.level);

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
            {user?.telegram_username ? (
              <Chip size="small" label={`Telegram: @${user.telegram_username}`} variant="outlined" />
            ) : null}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Профиль показывает только главное: прогресс, надежность и быстрые действия.
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
