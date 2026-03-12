import { Alert, Box, Button, Stack, TextField } from "@mui/material";

import { authInputSx, authPrimaryButtonSx } from "./authStyles";

export default function BootstrapAdminCard({ form, loading, onSubmit, onChange }) {
  return (
    <Box component="form" onSubmit={onSubmit}>
      <Stack spacing={1.35}>
        <Alert severity="info">После создания администратора вход будет доступен всем ролям.</Alert>
        <TextField
          required
          label="Логин администратора"
          value={form.username}
          onChange={(event) => onChange("username", event.target.value)}
          sx={authInputSx}
        />
        <TextField
          required
          label="Пароль"
          type="password"
          value={form.password}
          onChange={(event) => onChange("password", event.target.value)}
          sx={authInputSx}
        />
        <TextField
          required
          label="Подтверждение пароля"
          type="password"
          value={form.passwordConfirm}
          onChange={(event) => onChange("passwordConfirm", event.target.value)}
          sx={authInputSx}
        />
        <TextField
          label="Имя"
          value={form.first_name}
          onChange={(event) => onChange("first_name", event.target.value)}
          sx={authInputSx}
        />
        <TextField
          label="Фамилия"
          value={form.last_name}
          onChange={(event) => onChange("last_name", event.target.value)}
          sx={authInputSx}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{ mt: 0.5, ...authPrimaryButtonSx }}
        >
          {loading ? "Создаем администратора..." : "Создать администратора и войти"}
        </Button>
      </Stack>
    </Box>
  );
}
