import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";

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
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: 320, sm: 390 }, p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h3">Уведомления</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={onRefresh} disabled={loading}>
              Обновить
            </Button>
            <Button size="small" variant="text" onClick={onMarkAllRead} disabled={loading || !items.length}>
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
            {items.map((notification, index) => (
              <Box key={notification.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    py: 1.1,
                    bgcolor: notification.is_read ? "transparent" : "#eef6ff",
                    borderRadius: 1.5,
                  }}
                  secondaryAction={
                    !notification.is_read ? (
                      <IconButton edge="end" onClick={() => onMarkRead(notification.id)} aria-label="Отметить прочитанным">
                        <CheckCircleOutlineRoundedIcon />
                      </IconButton>
                    ) : null
                  }
                >
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>{notification.title}</Typography>}
                    secondary={
                      <Stack spacing={0.4} sx={{ mt: 0.25 }}>
                        <Typography variant="caption">{notification.message || "Системное уведомление"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(notification.created_at).format("DD.MM.YYYY HH:mm")}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
                {index < items.length - 1 ? <Divider sx={{ my: 0.6 }} /> : null}
              </Box>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
