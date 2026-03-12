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
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import dayjs from "dayjs";
import "dayjs/locale/ru";

import { rewriteLegacyB2BNotification } from "../../shared/lib/b2bLabels";
import { accessibleFocusRingSx } from "../../shared/ui/focusStyles";
import { normalizeRuText } from "../../utils/text";

dayjs.locale("ru");

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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";
  const unreadCount = items.filter((item) => !item.is_read).length;
  const markAllLabel = isMobile ? "Прочитать" : "Прочитать все";

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        id: "notifications-drawer",
        role: "dialog",
        "aria-labelledby": "notifications-drawer-title",
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
          direction="row"
          alignItems={{ xs: "stretch", sm: "center" }}
          flexWrap="wrap"
          gap={0.9}
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
          <Stack
            direction="row"
            spacing={0.8}
            alignItems="center"
            justifyContent="space-between"
            sx={{ minWidth: 0, flex: "1 1 190px", flexWrap: "wrap", rowGap: 0.6 }}
          >
            <Typography id="notifications-drawer-title" variant="h3">
              Уведомления
            </Typography>
            <Chip
              size="small"
              label={unreadCount ? `Новых: ${unreadCount}` : "Без новых"}
              color={unreadCount ? "primary" : "default"}
              variant={unreadCount ? "filled" : "outlined"}
            />
          </Stack>
          <Stack
            direction="row"
            spacing={0.8}
            sx={{
              width: { xs: "100%", sm: "auto" },
              flexWrap: "wrap",
              justifyContent: { xs: "stretch", sm: "flex-end" },
              ml: { sm: "auto" },
            }}
          >
            <Button
              size="small"
              variant="outlined"
              onClick={onRefresh}
              disabled={loading}
              sx={{ flex: { xs: "1 1 0", sm: "0 1 auto" }, whiteSpace: "nowrap", minWidth: 0 }}
            >
              Обновить
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={onMarkAllRead}
              disabled={loading || !items.length}
              sx={{ flex: { xs: "1 1 0", sm: "0 1 auto" }, whiteSpace: "nowrap", minWidth: 0 }}
            >
              {markAllLabel}
            </Button>
          </Stack>
        </Stack>

        {error ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        ) : null}

        {!items.length && !loading ? (
          <Stack spacing={1} alignItems="center" sx={{ py: 8, color: "text.secondary" }}>
            <NotificationsNoneRoundedIcon />
            <Typography variant="body2">Пока нет уведомлений</Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {items.map((notification, index) => {
              const display = rewriteLegacyB2BNotification(
                normalizeRuText(notification.title || ""),
                normalizeRuText(notification.message || "")
              );
              const itemDescription = display.message || "Системное уведомление";

              return (
                <Box key={notification.id}>
                  <ListItem
                    disablePadding
                    secondaryAction={
                      !notification.is_read ? (
                        <IconButton
                          edge="end"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMarkRead(notification.id);
                          }}
                          aria-label="Отметить уведомление прочитанным"
                          sx={accessibleFocusRingSx}
                        >
                          <CheckCircleOutlineRoundedIcon />
                        </IconButton>
                      ) : null
                    }
                  >
                    <ListItemButton
                      alignItems="flex-start"
                      disabled={notification.is_read}
                      onClick={() => {
                        if (!notification.is_read) {
                          onMarkRead(notification.id);
                        }
                      }}
                      aria-label={
                        notification.is_read
                          ? `Уведомление: ${display.title}`
                          : `Открыть и отметить прочитанным: ${display.title}`
                      }
                      sx={{
                        py: 1.1,
                        px: 1,
                        pr: notification.is_read ? 1 : 6.5,
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
                        ...accessibleFocusRingSx,
                        "&.Mui-disabled": {
                          opacity: 1,
                          color: "inherit",
                          WebkitTextFillColor: "inherit",
                        },
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
                    >
                      <ListItemText
                        secondaryTypographyProps={{ component: "div" }}
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {display.title}
                          </Typography>
                        }
                        secondary={
                          <Stack spacing={0.4} sx={{ mt: 0.25 }}>
                            <Typography variant="caption">{itemDescription}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(notification.created_at).format("DD.MM.YYYY HH:mm")}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
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
