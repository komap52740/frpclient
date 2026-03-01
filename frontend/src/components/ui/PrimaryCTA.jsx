import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Button, Stack, Typography } from "@mui/material";

const ACTION_MAP = {
  client: {
    NEW: { key: "open_chat", label: "Открыть чат", icon: ChatRoundedIcon, helper: "Что делать дальше: дождитесь мастера" },
    IN_REVIEW: { key: "open_chat", label: "Открыть чат", icon: ChatRoundedIcon, helper: "Обычно занимает 5-15 минут" },
    AWAITING_PAYMENT: {
      key: "open_payment",
      label: "Перейти к оплате",
      icon: PaymentsRoundedIcon,
      helper: "Что делать дальше: оплатите и прикрепите чек",
    },
    PAYMENT_PROOF_UPLOADED: {
      key: "open_chat",
      label: "Открыть чат",
      icon: ChatRoundedIcon,
      helper: "Чек на проверке. Если не получается — напишите в чат",
    },
    PAID: { key: "open_chat", label: "Открыть чат", icon: ChatRoundedIcon, helper: "Мастер уже может начать работу" },
    IN_PROGRESS: { key: "open_chat", label: "Открыть чат", icon: ChatRoundedIcon, helper: "Работа идет, статус обновится автоматически" },
    COMPLETED: {
      key: "leave_review",
      label: "Оценить результат",
      icon: CheckCircleRoundedIcon,
      helper: "Проверьте устройство и оставьте отзыв",
    },
    DECLINED_BY_MASTER: { key: "create_new", label: "Создать новую заявку", icon: ArrowForwardRoundedIcon },
    CANCELLED: { key: "create_new", label: "Создать новую заявку", icon: ArrowForwardRoundedIcon },
  },
  master: {
    NEW: { key: "take", label: "Взять заявку", icon: PlayArrowRoundedIcon, helper: "Главное действие: взять в работу" },
    IN_REVIEW: { key: "set_price", label: "Назначить цену", icon: ArrowForwardRoundedIcon },
    AWAITING_PAYMENT: { key: "open_chat", label: "Открыть чат", icon: ChatRoundedIcon },
    PAYMENT_PROOF_UPLOADED: { key: "confirm_payment", label: "Подтвердить оплату", icon: PaymentsRoundedIcon },
    PAID: { key: "start_work", label: "Начать работу", icon: PlayArrowRoundedIcon },
    IN_PROGRESS: { key: "complete_work", label: "Завершить работу", icon: TaskAltRoundedIcon },
    COMPLETED: { key: "open_chat", label: "Открыть чат", icon: ChatRoundedIcon },
    DECLINED_BY_MASTER: { key: "open_details", label: "Открыть заявку", icon: ArrowForwardRoundedIcon },
    CANCELLED: { key: "open_details", label: "Открыть заявку", icon: ArrowForwardRoundedIcon },
  },
  admin: {
    PAYMENT_PROOF_UPLOADED: { key: "confirm_payment_admin", label: "Подтвердить оплату", icon: PaymentsRoundedIcon },
    default: { key: "manage_status", label: "Управлять статусом", icon: ArrowForwardRoundedIcon },
  },
};

function resolveAction(status, role) {
  const roleMap = ACTION_MAP[role] || ACTION_MAP.client;
  return roleMap[status] || roleMap.default || { key: "open_details", label: "Открыть заявку", icon: ArrowForwardRoundedIcon };
}

export default function PrimaryCTA({
  status,
  role,
  onAction,
  fullWidth = true,
  size = "medium",
  variant = "contained",
  sx,
  actionOverride = null,
  disabled = false,
}) {
  const action = actionOverride || resolveAction(status, role);
  const Icon = action.icon || ArrowForwardRoundedIcon;

  return (
    <Stack spacing={0.75}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        disabled={disabled || action.disabled}
        startIcon={<Icon />}
        onClick={() => onAction?.(action.key, action)}
        sx={sx}
      >
        {action.label}
      </Button>
      {action.helper ? (
        <Typography variant="caption" color="text.secondary">
          {action.helper}
        </Typography>
      ) : null}
    </Stack>
  );
}
