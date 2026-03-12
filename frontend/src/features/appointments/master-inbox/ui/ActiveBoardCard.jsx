import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Button, Checkbox, Chip, Paper, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";

import { normalizeRuText } from "../../../../utils/text";

function getRiskChip(level) {
  if (level === "critical") {
    return { color: "error", label: "Риск: критический" };
  }
  if (level === "high") {
    return { color: "warning", label: "Риск: высокий" };
  }
  if (level === "medium") {
    return { color: "default", label: "Риск: средний" };
  }
  return null;
}

function getMessagePreview(item) {
  const text = (item.latest_message_text || "").trim();
  if (text) {
    return text;
  }
  if (item.latest_message_created_at) {
    return "Последнее сообщение без текста";
  }
  return "Пока нет сообщений";
}

export default function ActiveBoardCard({ item, selected, onSelect, onOpenCard, onOpenChat }) {
  const riskChip = getRiskChip(item.client_risk_level);
  const unreadCount = item.unread_count || 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.15,
        borderRadius: 2,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
      }}
    >
      <Stack spacing={0.85}>
        <Stack direction="row" spacing={0.8} alignItems="flex-start">
          <Checkbox
            size="small"
            checked={selected}
            onChange={() => onSelect(item.id)}
            sx={{ mt: -0.5, ml: -0.5 }}
          />
          <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              #{item.id} {normalizeRuText(item.brand)} {normalizeRuText(item.model)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Клиент: {normalizeRuText(item.client_username) || "—"} •{" "}
              {dayjs(item.updated_at).format("DD.MM HH:mm")}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={unreadCount ? "primary" : "default"}
            variant={unreadCount ? "filled" : "outlined"}
            icon={<ChatBubbleOutlineRoundedIcon fontSize="small" />}
            label={`Новых: ${unreadCount}`}
          />
          {item.sla_breached ? (
            <Chip
              size="small"
              color="error"
              icon={<WarningAmberRoundedIcon fontSize="small" />}
              label="SLA"
            />
          ) : null}
          {item.is_wholesale_request ? (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              icon={<StorefrontRoundedIcon fontSize="small" />}
              label="B2B"
            />
          ) : null}
          {riskChip ? (
            <Chip size="small" color={riskChip.color} variant="outlined" label={riskChip.label} />
          ) : null}
        </Stack>

        <Box
          sx={{
            px: 1,
            py: 0.8,
            borderRadius: 1.5,
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
            {getMessagePreview(item)}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.8}>
          <Button fullWidth size="small" variant="outlined" onClick={() => onOpenChat(item)}>
            Чат
          </Button>
          <Button
            fullWidth
            size="small"
            variant="contained"
            endIcon={<OpenInNewRoundedIcon fontSize="small" />}
            onClick={() => onOpenCard(item)}
          >
            Карточка
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
