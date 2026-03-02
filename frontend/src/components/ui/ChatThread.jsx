import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { normalizeRuText } from "../../utils/text";

dayjs.locale("ru");

export default function ChatThread({
  items,
  currentUserId,
  currentUserRole,
  onDeleteMessage,
  containerRef,
  onScroll,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

  return (
    <Stack
      ref={containerRef}
      onScroll={onScroll}
      spacing={1}
      sx={{
        maxHeight: isMobile ? 420 : 460,
        overflowY: "auto",
        pr: 0.6,
        pl: 0.1,
      }}
    >
      {items.map((item) => {
        if (item.type === "system_event") {
          return (
            <Box
              key={item.id}
              sx={{
                alignSelf: "center",
                px: 1.2,
                py: 0.55,
                borderRadius: 999,
                border: "1px solid",
                borderColor: isDark ? alpha("#74d7ff", 0.35) : alpha("#0284c7", 0.2),
                bgcolor: isDark ? alpha("#0b2538", 0.66) : alpha("#e7f4ff", 0.9),
                maxWidth: "96%",
              }}
            >
              <Stack direction="row" spacing={0.55} alignItems="center" justifyContent="center">
                <InfoOutlinedIcon sx={{ fontSize: 14, color: "info.main" }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                  {normalizeRuText(item.text)}
                </Typography>
              </Stack>
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
              maxWidth: isMobile ? "94%" : "84%",
              borderRadius: 2.4,
              p: 1.15,
              border: "1px solid",
              borderColor: own
                ? isDark
                  ? alpha("#5aa9ff", 0.42)
                  : alpha("#0284c7", 0.2)
                : "divider",
              bgcolor: own
                ? isDark
                  ? "rgba(17,48,84,0.92)"
                  : "rgba(227,243,255,0.95)"
                : isDark
                  ? "rgba(15,23,42,0.92)"
                  : "rgba(248,251,255,0.96)",
              boxShadow: own
                ? isDark
                  ? "0 8px 18px rgba(2,6,23,0.45)"
                  : "0 8px 18px rgba(14,116,144,0.14)"
                : isDark
                  ? "0 6px 14px rgba(2,6,23,0.35)"
                  : "0 6px 14px rgba(15,23,42,0.08)",
              opacity: message.is_pending ? 0.78 : 1,
              transition: "transform .2s ease, box-shadow .2s ease, opacity .2s ease",
              "&:hover": {
                transform: "translateY(-1px)",
              },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.8}>
              <Typography variant="caption" color="text.secondary">
                {normalizeRuText(message.sender_username)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {dayjs(message.created_at).format("HH:mm")}
              </Typography>
            </Stack>

            <Typography variant="body2" sx={{ mt: 0.35, color: message.is_deleted ? "text.secondary" : "text.primary" }}>
              {message.is_deleted ? "Сообщение удалено" : normalizeRuText(message.text)}
            </Typography>

            {message.file_url && !message.is_deleted ? (
              <Box
                component="a"
                href={message.file_url}
                target="_blank"
                rel="noreferrer"
                sx={{
                  mt: 0.7,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.45,
                  color: "primary.main",
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  px: 1,
                  py: 0.4,
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: own
                    ? isDark
                      ? alpha("#8ec6ff", 0.42)
                      : alpha("#0284c7", 0.22)
                    : "divider",
                  bgcolor: own
                    ? isDark
                      ? alpha("#0c2036", 0.5)
                      : alpha("#ffffff", 0.75)
                    : isDark
                      ? alpha("#0f172a", 0.7)
                      : alpha("#f7fbff", 0.96),
                }}
              >
                <AttachFileRoundedIcon sx={{ fontSize: 14 }} />
                Открыть файл
              </Box>
            ) : null}

            {message.is_pending ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                Отправляется...
              </Typography>
            ) : null}

            {canDelete ? (
              <IconButton
                size="small"
                onClick={() => onDeleteMessage?.(message.id)}
                sx={{
                  mt: 0.2,
                  color: "text.secondary",
                  "&:hover": { color: "error.main" },
                }}
              >
                <DeleteOutlineIcon fontSize="inherit" />
              </IconButton>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}
