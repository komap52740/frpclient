import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

export function RuDesktopStatusPanel({ hasRuDesktopCard, isDark, ruDesktopId, ruDesktopPassword }) {
  if (!hasRuDesktopCard) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1.3,
        borderColor: "divider",
        bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
      }}
    >
      <Stack spacing={0.7}>
        <Typography variant="caption" color="text.secondary">
          RuDesktop доступ
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          <b>Логин/ID:</b> {ruDesktopId || "не указан"}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          <b>Пароль:</b> {ruDesktopPassword || "не указан"}
        </Typography>
      </Stack>
    </Paper>
  );
}

export function RuDesktopEditorPanel({
  canEditRuDesktop,
  isDark,
  ruDesktopForm,
  ruDesktopError,
  ruDesktopSuccess,
  ruDesktopSaving,
  updateRuDesktopField,
  saveRuDesktopInline,
}) {
  if (!canEditRuDesktop) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1.3,
        borderColor: "divider",
        bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
      }}
    >
      <Stack spacing={0.8}>
        <Stack direction="row" spacing={0.7} alignItems="center">
          <ComputerRoundedIcon fontSize="small" color="primary" />
          <Typography variant="caption" color="text.secondary">
            Данные RuDesktop (не чат)
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Здесь указываются только логин/ID и пароль RuDesktop. Сообщение пишите в поле «Сообщение
          мастеру» ниже.
        </Typography>
        {ruDesktopError ? (
          <Alert severity="error" sx={{ py: 0, "& .MuiAlert-message": { py: 0.25 } }}>
            {ruDesktopError}
          </Alert>
        ) : null}
        {ruDesktopSuccess ? (
          <Alert severity="success" sx={{ py: 0, "& .MuiAlert-message": { py: 0.25 } }}>
            {ruDesktopSuccess}
          </Alert>
        ) : null}
        <TextField
          size="small"
          label="Логин/ID RuDesktop"
          placeholder="Например: 123 456 789"
          value={ruDesktopForm.rustdesk_id}
          onChange={(event) =>
            updateRuDesktopField("rustdesk_id", event.target.value.replace(/[^\d\s-]/g, ""))
          }
          autoComplete="off"
        />
        <TextField
          size="small"
          label="Пароль RuDesktop"
          placeholder="Пароль для подключения"
          value={ruDesktopForm.rustdesk_password}
          onChange={(event) => updateRuDesktopField("rustdesk_password", event.target.value)}
          autoComplete="off"
        />
        <Button
          size="small"
          variant="contained"
          onClick={saveRuDesktopInline}
          disabled={ruDesktopSaving}
          sx={{ alignSelf: "flex-start", borderRadius: 1.1 }}
        >
          {ruDesktopSaving ? "Сохраняем..." : "Сохранить RuDesktop"}
        </Button>
      </Stack>
    </Paper>
  );
}
