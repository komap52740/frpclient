import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { normalizeRuText } from "../../utils/text";

dayjs.locale("ru");

function sanitizeWholesaleText(title, message) {
  const titleText = normalizeRuText(title || "");
  const messageText = normalizeRuText(message || "");
  const combined = `${titleText} ${messageText}`.toLowerCase();

  if (!combined.includes("оптов") || !combined.includes("скид")) {
    return { title: titleText, message: messageText };
  }
  if (combined.includes("отклон")) {
    return {
      title: "Решение по оптовому статусу",
      message: "Оптовый статус отклонен. Уточните детали в чате с поддержкой.",
    };
  }
  return {
    title: "Решение по оптовому статусу",
    message: "Оптовый статус одобрен. Ваш аккаунт отмечен как оптовый сервис.",
  };
}

export default function NotificationsDrawer({
  open,
  onClose,
  items,
  loading,
  error,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const unreadCount = items.filter((item) => !item.is_read).length;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 410 },
          maxWidth: 410,
          borderLeft: "1px solid",
          borderColor: "divider",
          background: isDark
            ? "linear-gradient(165deg, rgba(9,14,24,0.98) 0%, rgba(15,23,42,0.96) 100%)"
            : "linear-gradient(165deg, rgba(255,255,255,0.97) 0%, rgba(244,250,255,0.95) 100%)",
        },
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={{ xs: 1, sm: 0 }}
          sx={{
            mb: 1,
            p: 1,
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: isDark ? alpha("#0f172a", 0.76) : alpha("#ffffff", 0.8),
            backdropFilter: "blur(10px) saturate(125%)",
            position: "sticky",
            top: 8,
            zIndex: 2,
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
            <Typography variant="h3">Уведомления</Typography>
            <Chip
              size="small"
              label={unreadCount ? `Новых: ${unreadCount}` : "Без новых"}
              color={unreadCount ? "primary" : "default"}
              variant={unreadCount ? "filled" : "outlined"}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Button
              size="small"
              variant="outlined"
              onClick={onRefresh}
              disabled={loading}
              sx={{ flex: { xs: 1, sm: "unset" }, whiteSpace: "nowrap" }}
            >
              Обновить
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={onMarkAllRead}
              disabled={loading || !items.length}
              sx={{ flex: { xs: 1, sm: "unset" }, whiteSpace: "nowrap" }}
            >
              Прочитать все
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

        {!items.length && !loading ? (
          <Stack spacing={1} alignItems="center" sx={{ py: 8, color: "text.secondary" }}>
            <NotificationsNoneRoundedIcon />
            <Typography variant="body2">Пока нет уведомлений</Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {items.map((notification, index) => {
              const display = sanitizeWholesaleText(notification.title, notification.message);
              return (
                <Box key={notification.id}>
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => {
                      if (!notification.is_read) {
                        onMarkRead(notification.id);
                      }
                    }}
                    sx={{
                      py: 1.1,
                      px: 1,
                      bgcolor: notification.is_read
                        ? "transparent"
                        : isDark
                          ? alpha("#123356", 0.46)
                          : alpha("#eaf4ff", 0.95),
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: notification.is_read
                        ? "transparent"
                        : isDark
                          ? alpha("#5aa9ff", 0.34)
                          : alpha("#0284c7", 0.2),
                      cursor: notification.is_read ? "default" : "pointer",
                      transition: "all 200ms ease",
                      "&:hover": {
                        bgcolor: notification.is_read
                          ? isDark
                            ? alpha("#0f172a", 0.68)
                            : alpha("#f7fbff", 0.98)
                          : isDark
                            ? alpha("#17406a", 0.5)
                            : alpha("#e4f1ff", 0.98),
                      },
                    }}
                    secondaryAction={
                      !notification.is_read ? (
                        <IconButton
                          edge="end"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMarkRead(notification.id);
                          }}
                          aria-label="Отметить прочитанным"
                        >
                          <CheckCircleOutlineRoundedIcon />
                        </IconButton>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>{display.title}</Typography>}
                      secondary={
                        <Stack spacing={0.4} sx={{ mt: 0.25 }}>
                          <Typography variant="caption">{display.message || "Системное уведомление"}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(notification.created_at).format("DD.MM.YYYY HH:mm")}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                  {index < items.length - 1 ? <Divider sx={{ my: 0.6 }} /> : null}
                </Box>
              );
            })}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
