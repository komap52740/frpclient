import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Badge, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
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
  const statusUi = resolveStatusUI(item.status, item.sla_breached);
  const unreadCount = item.unread_count || 0;
  const riskUi = riskTone(item.client_risk_level);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="h4" sx={{ fontSize: "1.02rem" }}>
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

          {item.description ? (
            <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {item.description}
            </Typography>
          ) : null}

          <StatusStepper status={item.status} role={role} compact slaBreached={item.sla_breached} />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip size="small" icon={<ScheduleRoundedIcon />} label={`Обновлено: ${formatLastActivity(item)}`} variant="outlined" />
            <Badge color="primary" badgeContent={unreadCount} max={99}>
              <Chip size="small" icon={<ChatBubbleOutlineRoundedIcon />} label="Сообщения" variant="outlined" />
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

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {showWorkflowAction ? (
              <PrimaryCTA
                status={item.status}
                role={role}
                onAction={(actionKey) => onPrimaryAction?.(actionKey, item)}
                fullWidth
              />
            ) : null}
            <Button component={RouterLink} to={linkTo} variant={showWorkflowAction ? "outlined" : "contained"} fullWidth>
              Открыть заявку
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
