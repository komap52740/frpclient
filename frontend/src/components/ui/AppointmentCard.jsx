import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Badge, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Link as RouterLink } from "react-router-dom";

import { getLockTypeLabel } from "../../constants/labels";
import { resolveStatusUI } from "../../theme/status";
import { normalizeRuText } from "../../utils/text";
import PrimaryCTA from "./PrimaryCTA";
import StatusStepper from "./StatusStepper";

dayjs.locale("ru");

function formatLastActivity(item, compact) {
  const source = item.updated_at || item.created_at;
  if (!source) return "—";
  return compact ? dayjs(source).format("HH:mm") : dayjs(source).format("DD.MM.YYYY HH:mm");
}

function riskTone(level) {
  if (level === "critical" || level === "high") {
    return { color: "#b42318", bg: "#fee4e2", label: level === "critical" ? "Риск: критический" : "Риск: высокий" };
  }
  if (level === "medium") {
    return { color: "#b54708", bg: "#fffaeb", label: "Риск: средний" };
  }
  return { color: "#027a48", bg: "#ecfdf3", label: "Риск: низкий" };
}

export default function AppointmentCard({
  item,
  role = "client",
  linkTo,
  onPrimaryAction,
  showWorkflowAction = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";
  const isClient = role === "client";
  const statusUi = resolveStatusUI(item.status, item.sla_breached);
  const unreadCount = item.unread_count || 0;
  const riskUi = riskTone(item.client_risk_level);
  const detailButtonVariant = showWorkflowAction ? (isClient ? "text" : "outlined") : "contained";

  return (
    <Card
      sx={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        background: isDark
          ? "linear-gradient(158deg, rgba(12,20,34,0.92) 0%, rgba(19,30,48,0.88) 100%)"
          : "linear-gradient(158deg, rgba(255,255,255,0.98) 0%, rgba(244,250,255,0.93) 100%)",
        transition: "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
        "&::before": {
          content: "\"\"",
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: statusUi.color,
          opacity: 0.85,
        },
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: isDark ? "0 14px 30px rgba(2,6,23,0.56)" : "0 14px 30px rgba(15,23,42,0.12)",
          borderColor: "rgba(14,116,255,0.3)",
        },
      }}
    >
      <CardContent sx={{ p: isMobile ? 1.35 : 1.9, "&:last-child": { pb: isMobile ? 1.35 : 1.9 } }}>
        <Stack spacing={1.1}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="h4" sx={{ fontSize: isMobile ? "0.98rem" : "1.05rem" }}>
                Заявка #{item.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {normalizeRuText(item.brand)} {normalizeRuText(item.model)} • {getLockTypeLabel(item.lock_type)}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={statusUi.label}
              sx={{
                bgcolor: statusUi.bg,
                color: statusUi.color,
                border: `1px solid ${statusUi.color}33`,
                fontWeight: 760,
              }}
            />
          </Stack>

          <StatusStepper status={item.status} role={role} compact slaBreached={item.sla_breached} />

          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              size="small"
              icon={<ScheduleRoundedIcon />}
              label={isMobile ? formatLastActivity(item, true) : `Обновлено: ${formatLastActivity(item, false)}`}
              variant="outlined"
            />
            <Badge color="primary" badgeContent={unreadCount} max={99}>
              <Chip
                size="small"
                icon={<ChatBubbleOutlineRoundedIcon />}
                label={unreadCount ? "Есть новые" : "Сообщения"}
                variant="outlined"
              />
            </Badge>
            {role === "master" && item.client_risk_level ? (
              <Chip
                size="small"
                icon={<WarningAmberRoundedIcon sx={{ color: riskUi.color }} />}
                label={riskUi.label}
                sx={{ bgcolor: riskUi.bg, color: riskUi.color }}
              />
            ) : null}
            {role === "master" && item.is_wholesale_request ? (
              <Chip
                size="small"
                icon={<StorefrontRoundedIcon fontSize="small" />}
                label="Оптовый клиент"
                color="primary"
                variant="outlined"
              />
            ) : null}
          </Stack>

          {showWorkflowAction ? (
            <PrimaryCTA
              status={item.status}
              role={role}
              onAction={(actionKey) => onPrimaryAction?.(actionKey, item)}
              fullWidth
            />
          ) : null}

          <Button
            component={RouterLink}
            to={linkTo}
            variant={detailButtonVariant}
            size={isClient ? "small" : "medium"}
            fullWidth
            endIcon={showWorkflowAction ? <ChevronRightRoundedIcon fontSize="small" /> : null}
            sx={{ minHeight: isMobile ? 40 : 42 }}
          >
            Открыть заявку
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
