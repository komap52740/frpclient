import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";

dayjs.locale("ru");

export default function ChatThread({ items, currentUserId, currentUserRole, onDeleteMessage }) {
  return (
    <Stack spacing={1} sx={{ maxHeight: 420, overflowY: "auto", pr: 1 }}>
      {items.map((item) => {
        if (item.type === "system_event") {
          return (
            <Box key={item.id} sx={{ alignSelf: "center", px: 1.25, py: 0.6, borderRadius: 999, bgcolor: "#eef3fb" }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {item.text}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center" }}>
                {dayjs(item.created_at).format("DD.MM.YYYY HH:mm")}
              </Typography>
            </Box>
          );
        }

        const message = item;
        const own = message.sender === currentUserId;
        const canDelete = !message.is_pending && !message.is_deleted && (own || currentUserRole === "admin");

        return (
          <Box
            key={message.id}
            sx={{
              alignSelf: own ? "flex-end" : "flex-start",
              maxWidth: "88%",
              bgcolor: own ? "#e8f6ff" : "#f4f7fb",
              borderRadius: 2,
              p: 1.15,
              border: "1px solid #dce6f0",
              opacity: message.is_pending ? 0.8 : 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {message.sender_username}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.2 }}>
              {dayjs(message.created_at).format("DD.MM.YYYY HH:mm")}
            </Typography>

            <Typography variant="body2">
              {message.is_deleted ? "Сообщение удалено" : message.text}
            </Typography>

            {message.file_url && !message.is_deleted ? (
              <Typography component="a" href={message.file_url} target="_blank" rel="noreferrer" sx={{ display: "block", mt: 0.4 }}>
                Открыть файл
              </Typography>
            ) : null}

            {message.is_pending ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                Отправляется...
              </Typography>
            ) : null}

            {canDelete ? (
              <IconButton size="small" onClick={() => onDeleteMessage?.(message.id)} sx={{ mt: 0.2 }}>
                <DeleteOutlineIcon fontSize="inherit" />
              </IconButton>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}
