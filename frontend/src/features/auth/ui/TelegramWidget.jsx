import TelegramIcon from "@mui/icons-material/Telegram";
import { Box, Button, Stack, Typography } from "@mui/material";

import {
  AUTH_PROVIDER_BUTTON_HEIGHT,
  oauthTelegramFallbackButtonSx,
  oauthTelegramShellSx,
} from "./authStyles";

export default function TelegramWidget({
  botUsername,
  containerRef,
  loading,
  widgetError,
  onRetry,
}) {
  if (!botUsername) {
    return (
      <Typography variant="caption" color="rgba(196,219,246,0.88)" sx={{ px: 0.2 }}>
        Telegram-вход временно недоступен: не задано имя бота.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <Box sx={oauthTelegramShellSx}>
        <Box
          id="telegram-login-container"
          ref={containerRef}
          sx={{
            width: "100%",
            minHeight: AUTH_PROVIDER_BUTTON_HEIGHT - 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 2.2,
            overflow: "hidden",
            "& > *": {
              maxWidth: "100% !important",
            },
            "& iframe": {
              display: "block",
              margin: "0 auto",
              minHeight: `${AUTH_PROVIDER_BUTTON_HEIGHT - 10}px !important`,
              borderRadius: "10px !important",
            },
            "& a": {
              display: "inline-flex !important",
              margin: "0 auto !important",
            },
          }}
        />
      </Box>

      {widgetError ? (
        <Stack spacing={1}>
          <Typography variant="caption" color="rgba(205,223,245,0.9)" sx={{ px: 0.25 }}>
            {widgetError}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TelegramIcon sx={{ fontSize: 18 }} />}
              onClick={onRetry}
              disabled={loading}
              sx={{ ...oauthTelegramFallbackButtonSx, minHeight: 44, flex: 1 }}
            >
              Перезагрузить Telegram вход
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TelegramIcon sx={{ fontSize: 18 }} />}
              component="a"
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              sx={{
                flex: 1,
                minHeight: 44,
                borderRadius: 2.2,
                px: 1.4,
                fontWeight: 700,
                borderColor: "rgba(121,195,255,0.72)",
                color: "#b6e2ff",
                background:
                  "linear-gradient(145deg, rgba(17,45,82,0.45) 0%, rgba(12,33,63,0.45) 100%)",
                "&:hover": {
                  borderColor: "rgba(150,214,255,0.94)",
                  background:
                    "linear-gradient(145deg, rgba(25,62,108,0.65) 0%, rgba(16,46,84,0.65) 100%)",
                },
              }}
            >
              Открыть @{botUsername}
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
