import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";

export default function BannedPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const reason = (user?.ban_reason || "").trim();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper sx={{ p: 3, width: "100%", maxWidth: 560, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BlockRoundedIcon color="error" />
            <Typography variant="h5">Аккаунт заблокирован</Typography>
          </Stack>

          <Alert severity="error">
            Ваш аккаунт заблокирован администратором. Функционал платформы недоступен.
          </Alert>

          {reason ? (
            <Box>
              <Typography variant="subtitle2">Причина блокировки</Typography>
              <Typography variant="body2" color="text.secondary">
                {reason}
              </Typography>
            </Box>
          ) : null}

          <Typography variant="body2" color="text.secondary">
            Если считаете блокировку ошибочной, обратитесь в поддержку и укажите ваш логин:{" "}
            <b>{user?.username || "-"}</b>
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" onClick={onLogout}>
              Выйти из аккаунта
            </Button>
            <Button variant="outlined" onClick={() => window.location.reload()}>
              Обновить страницу
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
