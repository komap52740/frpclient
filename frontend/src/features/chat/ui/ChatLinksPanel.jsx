import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";

export default function ChatLinksPanel({ linkItems, copyLink, isDark, isMobile }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.1,
        borderRadius: 1.4,
        maxHeight: isMobile ? 400 : 460,
        overflowY: "auto",
        bgcolor: isDark ? alpha("#0f172a", 0.7) : alpha("#f8fbff", 0.95),
      }}
    >
      {linkItems.length ? (
        <Stack spacing={0.9}>
          {linkItems.map((item) => (
            <Paper
              key={item.id}
              elevation={0}
              sx={{
                p: 1,
                borderRadius: 1.2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? alpha("#111b2f", 0.8) : "#ffffff",
              }}
            >
              <Stack spacing={0.45}>
                <Typography variant="caption" color="text.secondary">
                  {item.sender_username} · {dayjs(item.created_at).format("DD.MM.YYYY HH:mm")}
                </Typography>
                <Typography
                  component="a"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  variant="body2"
                  sx={{
                    color: "primary.main",
                    fontWeight: 700,
                    textDecoration: "none",
                    wordBreak: "break-all",
                  }}
                >
                  {item.url}
                </Typography>
                <Stack direction="row" spacing={0.8}>
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                    onClick={() => copyLink(item.url)}
                  >
                    Копировать
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Пока нет ссылок от мастера или администратора.
        </Typography>
      )}
    </Paper>
  );
}
