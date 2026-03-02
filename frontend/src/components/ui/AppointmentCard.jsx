import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Badge, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Link as RouterLink } from "react-router-dom";

import { getLockTypeLabel } from "../../constants/labels";
import { resolveStatusUI } from "../../theme/status";
import PrimaryCTA from "./PrimaryCTA";
import StatusStepper from "./StatusStepper";

dayjs.locale("ru");

function formatLastActivity(item) {
  const source = item.updated_at || item.created_at;
  if (!source) return "—";
  return dayjs(source).format("DD.MM.YYYY HH:mm");
}

function riskTone(level) {
  if (level === "critical" || level === "high") {
    return { color: "#b42318", bg: "#fee4e2", label: `Риск: ${level === "critical" ? "критический" : "высокий"}` };
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

  return (
    <Card
      sx={{
        transition: "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
        border: "1px solid",
        borderColor: "divider",
        background: isDark
          ? "linear-gradient(156deg, rgba(15,23,42,0.88) 0%, rgba(20,29,46,0.85) 100%)"
          : "linear-gradient(156deg, rgba(255,255,255,0.96) 0%, rgba(247,251,255,0.92) 100%)",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: isDark ? "0 14px 30px rgba(2,6,23,0.55)" : 6,
          borderColor: "rgba(2,132,199,0.28)",
        },
      }}
    >
      <CardContent sx={{ p: isMobile ? 1.35 : 2, "&:last-child": { pb: isMobile ? 1.35 : 2 } }}>
        <Stack spacing={isClient ? 1 : 1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="h4" sx={{ fontSize: isMobile ? "0.97rem" : "1.02rem" }}>
                Заявка #{item.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.brand} {item.model} • {getLockTypeLabel(item.lock_type)}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={statusUi.label}
              sx={{
                bgcolor: statusUi.bg,
                color: statusUi.color,
                border: `1px solid ${statusUi.color}33`,
              }}
            />
          </Stack>

          {item.description && !isClient ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {item.description}
            </Typography>
          ) : null}

          <StatusStepper status={item.status} role={role} compact slaBreached={item.sla_breached} />

          {!isClient ? <PaperHint hint={statusUi.hint} /> : null}

          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              size="small"
              icon={<ScheduleRoundedIcon />}
              label={isMobile ? dayjs(item.updated_at || item.created_at).format("HH:mm") : `Обновлено: ${formatLastActivity(item)}`}
              variant="outlined"
            />
            <Badge color="primary" badgeContent={unreadCount} max={99}>
              <Chip
                size="small"
                icon={<ChatBubbleOutlineRoundedIcon />}
                label={unreadCount ? (isMobile ? "Новые" : "Есть новые") : "Сообщения"}
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
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={0.9}>
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
              variant={showWorkflowAction ? "outlined" : "contained"}
              size={isClient ? "small" : "medium"}
              fullWidth
            >
              Открыть заявку
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PaperHint({ hint }) {
  if (!hint) {
    return null;
  }

  return (
    <Box
      sx={{
        p: 1,
        borderRadius: 2,
        bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(30,41,59,0.62)" : "#f3f8fd"),
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Что делать дальше: {hint}
      </Typography>
    </Box>
  );
}
