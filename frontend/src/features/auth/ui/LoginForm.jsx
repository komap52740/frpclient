import { Box, Button, Divider, Stack, TextField } from "@mui/material";

import { authInputSx, authPrimaryButtonSx } from "./authStyles";

export default function LoginForm({ form, loading, onSubmit, onChange, children, footer = null }) {
  return (
    <Stack spacing={1.4}>
      {children}

      <Divider
        sx={{
          color: "rgba(194,214,243,0.66)",
          fontSize: 12,
          "&::before, &::after": { borderColor: "rgba(140,177,229,0.34)" },
        }}
      >
        или вход по логину/паролю
      </Divider>

      <Box component="form" onSubmit={onSubmit} noValidate aria-busy={loading}>
        <Stack spacing={1.2}>
          <TextField
            required
            label="Логин"
            autoComplete="username"
            value={form.username}
            onChange={(event) => onChange("username", event.target.value)}
            sx={authInputSx}
            slotProps={{ htmlInput: { "data-testid": "auth-login-username" } }}
          />
          <TextField
            required
            label="Пароль"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => onChange("password", event.target.value)}
            sx={authInputSx}
            slotProps={{ htmlInput: { "data-testid": "auth-login-password" } }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ mt: 0.5, ...authPrimaryButtonSx }}
            data-testid="auth-login-submit"
          >
            {loading ? "Входим..." : "Войти"}
          </Button>
          {footer}
        </Stack>
      </Box>
    </Stack>
  );
}
